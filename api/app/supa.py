"""Calls Supabase's database API *as the signed-in user*.

Sending the user's own sign-in token means row-level security applies to everything here, exactly
as it does in the browser: the API can only ever read or change that user's rows, and it needs no
Supabase secret key. Only the public publishable key is required.
"""

import httpx

from app import outbound
from app.auth import User
from app.config import settings
from app.errors import not_configured, problem


def _headers(user: User) -> dict[str, str]:
    if not (settings.supabase_url and settings.supabase_publishable_key):
        raise not_configured("SUPABASE_PUBLISHABLE_KEY")
    return {
        "apikey": settings.supabase_publishable_key,
        "Authorization": f"Bearer {user.token}",
        "Content-Type": "application/json",
    }


def rpc(user: User, fn: str, args: dict | None = None):
    """Call a Postgres function from supabase/migrations. Returns its JSON result."""
    url = f"{settings.supabase_url.rstrip('/')}/rest/v1/rpc/{fn}"
    try:
        r = outbound.client().post(url, headers=_headers(user), json=args or {})
    except httpx.HTTPError:
        raise problem(503, "database_down", "Couldn't reach the database. Try again in a moment.") from None
    if r.status_code >= 400:
        raise problem(502, "database_error", f"The database refused {fn} ({r.status_code}).")
    return r.json() if r.content else None
