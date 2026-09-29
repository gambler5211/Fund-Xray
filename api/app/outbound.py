"""One shared HTTP client for calls to Kite and Supabase. Tests swap it for a fake."""

import httpx

_client: httpx.Client | None = None


def client() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(timeout=httpx.Timeout(10.0, connect=5.0))
    return _client


def set_client(c: httpx.Client | None) -> None:
    global _client
    _client = c
