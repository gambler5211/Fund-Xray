"""Token checks, using a locally generated key in place of Supabase's published one."""

import time

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from app import auth
from app.config import settings
from app.main import app

SUPABASE = "https://example-ref.supabase.co"
KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())


class FakeJWKS:
    """Stands in for PyJWKClient: always hands back our test public key."""

    def get_signing_key_from_jwt(self, token):
        return type("K", (), {"key": KEY.public_key()})()


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", SUPABASE)
    monkeypatch.setattr(auth, "jwks_client", lambda: FakeJWKS())


def token(key=KEY, **over):
    now = int(time.time())
    claims = {
        "sub": "11111111-2222-3333-4444-555555555555",
        "email": "reader@example.com",
        "aud": "authenticated",
        "iss": f"{SUPABASE}/auth/v1",
        "role": "authenticated",
        "iat": now,
        "exp": now + 3600,
    } | over
    return jwt.encode(claims, key, algorithm="ES256", headers={"kid": "test"})


client = TestClient(app)


def get_me(tok=None):
    headers = {"Authorization": f"Bearer {tok}"} if tok else {}
    return client.get("/me", headers=headers)


def test_valid_token_returns_user():
    r = get_me(token())
    assert r.status_code == 200
    assert r.json() == {"id": "11111111-2222-3333-4444-555555555555", "email": "reader@example.com"}


def test_missing_token_is_401():
    r = get_me()
    assert r.status_code == 401
    assert r.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "tok",
    [
        pytest.param(lambda: token(exp=int(time.time()) - 120), id="expired"),
        pytest.param(lambda: token(aud="anon"), id="wrong-audience"),
        pytest.param(lambda: token(iss="https://evil.supabase.co/auth/v1"), id="wrong-issuer"),
        pytest.param(lambda: token(key=OTHER_KEY), id="wrong-key"),
        pytest.param(lambda: "not.a.jwt", id="garbage"),
        pytest.param(lambda: jwt.encode({"sub": "x", "aud": "authenticated", "exp": int(time.time()) + 60}, "s" * 32, algorithm="HS256"), id="hs256-shared-secret"),
    ],
)
def test_bad_tokens_are_401(tok):
    assert get_me(tok()).status_code == 401


def test_health_stays_public():
    assert client.get("/health").status_code == 200


def test_not_configured_is_503(monkeypatch):
    monkeypatch.setattr(settings, "supabase_url", None)
    assert get_me(token()).status_code == 503
