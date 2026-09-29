"""Shared bits for the data jobs that run on GitHub Actions.

These jobs write reference data everyone reads (sectors, index prices), so they use the Supabase
secret key, which lives only in GitHub Actions secrets: never on Cloud Run, never in the web app.
"""

from __future__ import annotations

import os
import sys
import time

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


def summary(line: str) -> None:
    """A line in the GitHub Actions run summary (and the log)."""
    print(line)
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
