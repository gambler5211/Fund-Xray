"""Day 4: the Kite connect flow against fake Kite and fake Supabase servers."""

import hashlib
import json
import time
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import auth, crypto, kite, outbound
from app.config import settings
from app.main import app

SUPABASE = "https://example-ref.supabase.co"
KEY = ec.generate_private_key(ec.SECP256R1())
API_KEY, API_SECRET = "testapikey123456", "s" * 32
FERNET_KEY = Fernet.generate_key().decode()


class FakeJWKS:
    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": KEY.public_key()})()


def sign_in(sub="11111111-2222-3333-4444-555555555555"):
    now = int(time.time())
    return jwt.encode({"sub": sub, "email": "r@example.com", "aud": "authenticated", "iss": f"{SUPABASE}/auth/v1",
                       "iat": now, "exp": now + 3600}, KEY, algorithm="ES256", headers={"kid": "t"})


class World:
    """Fake Kite + Supabase. Rows are keyed by the signed-in user, like row-level security."""

    def __init__(self):
        self.rows: dict[str, dict] = {}
        self.kite_valid: set[str] = set()
        self.kite_down = False
        self.used_request_tokens: set[str] = set()
        self.calls: list[str] = []

    def handler(self, req: httpx.Request) -> httpx.Response:
        url = str(req.url)
        self.calls.append(f"{req.method} {req.url.path}")
        if url.startswith(SUPABASE):
            assert req.headers["apikey"] == "sb_publishable_test"
            sub = jwt.decode(req.headers["authorization"].split()[1], options={"verify_signature": False})["sub"]
            fn = req.url.path.rsplit("/", 1)[-1]
            args = json.loads(req.content or b"{}")
            if fn == "save_kite_token":
                self.rows[sub] = {"access_token_enc": args["p_enc"], "kite_user_id": args["p_kite_user_id"],
                                  "expires_at": args["p_expires_at"], "updated_at": datetime.now(timezone.utc).isoformat()}
                return httpx.Response(204)
            if fn == "get_kite_token":
                return httpx.Response(200, json=[self.rows[sub]] if sub in self.rows else [])
            if fn == "delete_kite_token":
                self.rows.pop(sub, None)
                return httpx.Response(204)
            return httpx.Response(404, json={"message": "no such function"})
        if self.kite_down:
            raise httpx.ConnectError("down")
        assert req.headers["x-kite-version"] == "3"
        if req.url.path == "/session/token" and req.method == "POST":
            form = parse_qs(req.content.decode())
            rt = form["request_token"][0]
            want = hashlib.sha256(f"{API_KEY}{rt}{API_SECRET}".encode()).hexdigest()
            if form["checksum"][0] != want or rt in self.used_request_tokens:
                return httpx.Response(403, json={"status": "error", "error_type": "TokenException", "message": "Token is invalid or has expired."})
            self.used_request_tokens.add(rt)
            access = f"access-{rt}"
            self.kite_valid.add(access)
            return httpx.Response(200, json={"status": "success", "data": {"user_id": "AB1234", "user_name": "Reader", "access_token": access}})
        if req.url.path == "/session/token" and req.method == "DELETE":
            self.kite_valid.discard(req.url.params["access_token"])
            return httpx.Response(200, json={"status": "success", "data": True})
        if req.url.path == "/user/profile":
            tok = req.headers["authorization"].split(":", 1)[1]
            if tok not in self.kite_valid:
                return httpx.Response(403, json={"status": "error", "error_type": "TokenException", "message": "Incorrect api_key or access_token."})
            return httpx.Response(200, json={"status": "success", "data": {"user_id": "AB1234", "user_name": "Reader", "broker": "ZERODHA"}})
        return httpx.Response(404, json={"status": "error", "error_type": "GeneralException"})


@pytest.fixture
def world(monkeypatch):
    w = World()
    for k, v in {"supabase_url": SUPABASE, "supabase_publishable_key": "sb_publishable_test", "kite_api_key": API_KEY,
                 "kite_api_secret": API_SECRET, "token_encryption_key": FERNET_KEY}.items():
        monkeypatch.setattr(settings, k, v)
    monkeypatch.setattr(auth, "jwks_client", lambda: FakeJWKS())
    crypto._fernet.cache_clear()
    outbound.set_client(httpx.Client(transport=httpx.MockTransport(w.handler)))
    yield w
    outbound.set_client(None)
    crypto._fernet.cache_clear()


client = TestClient(app)
H = lambda sub="11111111-2222-3333-4444-555555555555": {"Authorization": f"Bearer {sign_in(sub)}"}  # noqa: E731


def test_login_url_carries_api_key_and_state(world):
    r = client.get("/kite/login-url", params={"state": "x" * 24}, headers=H())
    u = urlparse(r.json()["url"])
    q = parse_qs(u.query)
    assert (u.netloc, u.path) == ("kite.zerodha.com", "/connect/login")
    assert q["api_key"] == [API_KEY] and q["v"] == ["3"]
    assert parse_qs(q["redirect_params"][0]) == {"state": ["x" * 24]}


def test_all_kite_routes_need_sign_in(world):
    for method, path in [("GET", "/kite/status"), ("GET", "/kite/login-url?state=" + "x" * 20), ("POST", "/kite/session"), ("GET", "/kite/profile"), ("DELETE", "/kite/session")]:
        assert client.request(method, path).status_code == 401, path


def test_round_trip_twice(world):
    assert client.get("/kite/status", headers=H()).json() == {"state": "never"}
    for n in (1, 2):
        r = client.post("/kite/session", json={"request_token": f"request{n}"}, headers=H())
        assert r.status_code == 200, r.text
        assert r.json()["state"] == "connected" and r.json()["kite_user_id"] == "AB1234"
        stored = world.rows["11111111-2222-3333-4444-555555555555"]["access_token_enc"]
        assert f"access-request{n}" not in stored  # never stored in the clear
        assert Fernet(FERNET_KEY.encode()).decrypt(stored.encode()).decode() == f"access-request{n}"
        s = client.get("/kite/status", headers=H()).json()
        assert s["state"] == "connected"
        assert client.get("/kite/profile", headers=H()).json()["user_name"] == "Reader"


def test_reused_request_token_is_a_clean_error(world):
    client.post("/kite/session", json={"request_token": "requestA"}, headers=H())
    r = client.post("/kite/session", json={"request_token": "requestA"}, headers=H())
    assert r.status_code == 400 and r.json()["detail"]["code"] == "login_expired"


def test_expired_token_says_reconnect(world):
    client.post("/kite/session", json={"request_token": "requestB"}, headers=H())
    world.rows["11111111-2222-3333-4444-555555555555"]["expires_at"] = (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()
    assert client.get("/kite/status", headers=H()).json()["state"] == "expired"
    r = client.get("/kite/profile", headers=H())
    assert r.status_code == 409 and r.json()["detail"]["code"] == "kite_expired"


def test_token_revoked_early_by_kite_marks_expired(world):
    client.post("/kite/session", json={"request_token": "requestC"}, headers=H())
    world.kite_valid.clear()  # e.g. logged out of all sessions on Zerodha
    r = client.get("/kite/profile", headers=H())
    assert r.status_code == 409 and r.json()["detail"]["code"] == "kite_expired"
    assert client.get("/kite/status", headers=H()).json()["state"] == "expired"


def test_kite_down(world):
    world.kite_down = True
    r = client.post("/kite/session", json={"request_token": "requestD"}, headers=H())
    assert r.status_code == 503 and r.json()["detail"]["code"] == "kite_down"


def test_rotated_encryption_key_asks_to_reconnect(world, monkeypatch):
    client.post("/kite/session", json={"request_token": "requestE"}, headers=H())
    monkeypatch.setattr(settings, "token_encryption_key", Fernet.generate_key().decode())
    crypto._fernet.cache_clear()
    r = client.get("/kite/profile", headers=H())
    assert r.status_code == 409 and r.json()["detail"]["code"] == "kite_expired"


def test_bad_encryption_key_is_not_configured(world, monkeypatch):
    monkeypatch.setattr(settings, "token_encryption_key", "a" * 64)  # the mistake made during setup
    crypto._fernet.cache_clear()
    assert "64 characters" in crypto.key_status()
    r = client.post("/kite/session", json={"request_token": "requestF"}, headers=H())
    assert r.status_code == 503 and r.json()["detail"]["code"] == "not_configured"


def test_disconnect(world):
    client.post("/kite/session", json={"request_token": "requestG"}, headers=H())
    assert client.delete("/kite/session", headers=H()).json() == {"state": "never"}
    assert "DELETE /session/token" in world.calls
    assert client.get("/kite/status", headers=H()).json() == {"state": "never"}


def test_users_never_see_each_other(world):
    client.post("/kite/session", json={"request_token": "requestH"}, headers=H("aaaaaaaa-0000-0000-0000-000000000001"))
    assert client.get("/kite/status", headers=H("bbbbbbbb-0000-0000-0000-000000000002")).json() == {"state": "never"}


@pytest.mark.parametrize("now_ist,expected", [
    ("2026-09-29T21:30", "2026-09-30T06:00"),
    ("2026-09-30T05:59", "2026-09-30T06:00"),
    ("2026-09-30T06:00", "2026-10-01T06:00"),
    ("2026-09-30T09:12", "2026-10-01T06:00"),
])
def test_expiry_is_next_6am_ist(now_ist, expected):
    now = datetime.fromisoformat(now_ist).replace(tzinfo=kite.IST)
    assert kite.next_expiry(now).strftime("%Y-%m-%dT%H:%M") == expected
