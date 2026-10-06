"""Shared bits for the data jobs that run on GitHub Actions.

These jobs write reference data everyone reads (sectors, index prices), so they use the Supabase
secret key, which lives only in GitHub Actions secrets: never on Cloud Run, never in the web app.
"""

from __future__ import annotations

import os
import sys
import time
import weakref

import httpx

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://dgjbladcfysjncciukhg.supabase.co").rstrip("/")

# NSE serves its files to browsers; a bare client gets stalled or refused.
BROWSER = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
    "Accept": "text/csv,text/plain,application/json,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": "https://www.nseindia.com/",
}


def nse_client() -> httpx.Client:
    return httpx.Client(headers=BROWSER, timeout=httpx.Timeout(20.0, connect=10.0), follow_redirects=True)


def fetch_text(client: httpx.Client, url: str, tries: int = 3) -> str | None:
    """The file's text, None for 404 (e.g. a market holiday). Retries slow or refused requests."""
    last = ""
    for attempt in range(tries):
        try:
            r = client.get(url)
            if r.status_code == 404:
                return None
            if r.status_code == 200 and r.text.strip():
                return r.text
            last = f"HTTP {r.status_code}"
        except httpx.HTTPError as e:
            last = type(e).__name__
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{url}: {last}")


NSE_WWW = "https://www.nseindia.com"


_WARM: "weakref.WeakSet[httpx.Client]" = weakref.WeakSet()
NSE_PAGE = f"{NSE_WWW}/companies-listing/corporate-integrated-filing"


def nse_api_client() -> httpx.Client:
    """A client for NSE's JSON API (www.nseindia.com/api/...). Use it in a `with` block; the first
    fetch_json opens an NSE page first, since the API answers only browsers holding its cookies."""
    c = nse_client()
    c.headers["Accept"] = "application/json,text/plain,*/*"
    return c


def _warm(client: httpx.Client) -> None:
    try:
        client.get(NSE_PAGE)
    except httpx.HTTPError:
        pass  # the API call reports the failure
    _WARM.add(client)


def fetch_json(client: httpx.Client, path: str, tries: int = 3):
    """GET an NSE API path ("/api/...") and parse the JSON. Opens the page again if the cookies
    have expired (NSE answers 401/403 then)."""
    if client not in _WARM:
        _warm(client)
    last = ""
    for attempt in range(tries):
        try:
            r = client.get(f"{NSE_WWW}{path}")
            if r.status_code == 200:
                try:
                    return r.json()
                except ValueError:
                    last = "not JSON"
            else:
                last = f"HTTP {r.status_code}"
                if r.status_code in (401, 403):
                    _warm(client)
        except httpx.HTTPError as e:
            last = type(e).__name__
        time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{path}: {last}")


def _db_headers() -> dict[str, str]:
    key = os.environ.get("SUPABASE_SECRET_KEY", "")
    if not key:
        sys.exit("SUPABASE_SECRET_KEY is not set (GitHub → Settings → Secrets and variables → Actions → Secrets).")
    return {"apikey": key, "Content-Type": "application/json"}


def db_upsert(table: str, rows: list[dict], on_conflict: str) -> None:
    if not rows:
        return
    r = httpx.post(
        f"{SUPABASE_URL}/rest/v1/{table}",
        params={"on_conflict": on_conflict},
        headers={**_db_headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
        json=rows,
        timeout=60,
    )
    if r.status_code >= 300:
        raise RuntimeError(f"upsert {table}: HTTP {r.status_code} {r.text[:300]}")


def db_select(table: str, params: dict) -> list[dict]:
    r = httpx.get(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers=_db_headers(), timeout=60)
    if r.status_code >= 300:
        raise RuntimeError(f"select {table}: HTTP {r.status_code} {r.text[:300]}")
    return r.json()


def db_delete(table: str, params: dict) -> None:
    """Delete the rows matching PostgREST filters, e.g. {"index_key": "eq.nifty-it"}."""
    if not params:
        raise ValueError("refusing to delete without a filter")
    r = httpx.delete(f"{SUPABASE_URL}/rest/v1/{table}", params=params, headers={**_db_headers(), "Prefer": "return=minimal"}, timeout=60)
    if r.status_code >= 300:
        raise RuntimeError(f"delete {table}: HTTP {r.status_code} {r.text[:300]}")


def db_select_all(table: str, params: dict, page: int = 1000) -> list[dict]:
    """Every matching row, fetched in pages (PostgREST returns at most 1,000 rows per request).
    `params` must include an "order" so pages don't overlap."""
    out: list[dict] = []
    offset = 0
    while True:
        rows = db_select(table, {**params, "limit": str(page), "offset": str(offset)})
        out += rows
        if len(rows) < page:
            return out
        offset += page


def log_run(job: str, started_at: str, status: str, summary_line: str, details: dict | None = None) -> None:
    """One row in job_runs, which the app's footer reads to show how fresh the data is."""
    try:
        db_insert("job_runs", [{"job": job, "started_at": started_at, "status": status,
                                      "summary": summary_line[:500], "details": details or {}}])
    except Exception as e:  # noqa: BLE001  (logging must never hide the job's own result)
        print(f"Couldn't log the run: {e}")


def db_insert(table: str, rows: list[dict]) -> None:
    r = httpx.post(f"{SUPABASE_URL}/rest/v1/{table}", headers={**_db_headers(), "Prefer": "return=minimal"}, json=rows, timeout=60)
    if r.status_code >= 300:
        raise RuntimeError(f"insert {table}: HTTP {r.status_code} {r.text[:300]}")


def summary(line: str) -> None:
    """A line in the GitHub Actions run summary (and the log)."""
    print(line)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
