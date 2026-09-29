"""Day 5: pull holdings from (fake) Kite, compute totals, save and read back the snapshot."""

from tests.test_kite import H, client, world  # noqa: F401  (world is a pytest fixture)


def connect():
    assert client.post("/kite/session", json={"request_token": "requestZZ"}, headers=H()).status_code == 200


def test_refresh_builds_and_saves_snapshot(world):  # noqa: F811
    connect()
    r = client.post("/holdings/refresh", headers=H())
    assert r.status_code == 200, r.text
    body = r.json()
    t = body["totals"]
    # 10*900 + 25*400 invested; 10*950 + 25*380 value; T1 shares included
    assert t["invested"] == 19000.0 and t["value"] == 19000.0 and t["pnl"] == 0.0
    assert t["day_change"] == -150.0     # +100 on Tata Motors, −250 on KPI Green
    names = {h["symbol"]: h["name"] for h in body["holdings"]}
    assert names == {"TATAMOTORS": "Tata Motors", "KPIGREEN": "KPI Green Energy"}
    assert body["taken_at"]
    latest = client.get("/holdings", headers=H()).json()
    assert latest["totals"] == t and len(latest["holdings"]) == 2


def test_exits_and_new_buys_follow_kite(world):  # noqa: F811
    connect()
    client.post("/holdings/refresh", headers=H())
    world.holdings = [world.holdings[0], {"tradingsymbol": "NEWBUY", "exchange": "NSE", "quantity": 3, "average_price": 10, "last_price": 11, "close_price": 10}]
    syms = [h["symbol"] for h in client.post("/holdings/refresh", headers=H()).json()["holdings"]]
    assert syms == ["TATAMOTORS", "NEWBUY"]


def test_refresh_without_kite_is_409(world):  # noqa: F811
    r = client.post("/holdings/refresh", headers=H())
    assert r.status_code == 409 and r.json()["detail"]["code"] == "kite_not_connected"


def test_refresh_after_kite_revokes_says_reconnect(world):  # noqa: F811
    connect()
    world.kite_valid.clear()
    r = client.post("/holdings/refresh", headers=H())
    assert r.status_code == 409 and r.json()["detail"]["code"] == "kite_expired"


def test_names_missing_still_loads(world):  # noqa: F811
    connect()
    world.instruments_down = True
    body = client.post("/holdings/refresh", headers=H()).json()
    assert {h["name"] for h in body["holdings"]} == {"TATAMOTORS", "KPIGREEN"}


def test_empty_before_first_pull(world):  # noqa: F811
    assert client.get("/holdings", headers=H()).json()["totals"] is None
