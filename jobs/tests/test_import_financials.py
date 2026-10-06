"""The financials importer, end to end with NSE and the database replaced by stand-ins."""

from datetime import date
from pathlib import Path

import import_financials as imp

FIX = Path(__file__).resolve().parents[2] / "engine" / "tests" / "fixtures"
NEW_URL = "https://nsearchives.nseindia.com/corporate/xbrl/NEW.xml"
OLD_URL = "https://nsearchives.nseindia.com/corporate/xbrl/OLD.xml"
BAD_URL = "https://nsearchives.nseindia.com/corporate/xbrl/BAD.xml"


class FakeClient:
    def __init__(self):
        self.headers = {}

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


def setup(monkeypatch, stored_rows=(), skipped=()):
    writes = {"upsert": [], "insert": []}
    old = [{"toDate": "30-Sep-2024", "consolidated": "Consolidated", "cumulative": "Non-cumulative",
            "broadCastDate": "10-Oct-2024 18:59:44", "xbrl": OLD_URL}]
    new = {"data": [{"qe_Date": "30-SEP-2025", "consolidated": "Consolidated", "type_Sub": "Original",
                     "broadcast_Date": "09-Oct-2025 17:56:24", "xbrl": NEW_URL},
                    {"qe_Date": "30-JUN-2025", "consolidated": "Consolidated", "type_Sub": "Original",
                     "broadcast_Date": "10-Jul-2025 18:40:11", "xbrl": BAD_URL}], "totalCount": 2}

    def fetch_json(client, path):
        return old if "corporates-financial-results" in path else new

    def fetch_text(client, url):
        return {OLD_URL: (FIX / "tcs_2024_09_old_format.xml").read_text(),
                NEW_URL: (FIX / "tcs_2025_09_consolidated.xml").read_text(),
                BAD_URL: "<html>Access denied</html>"}[url]

    def select_all(table, params):
        return list(stored_rows) if table == "company_financials" else [{"source_url": u} for u in skipped]

    monkeypatch.setattr(imp, "nse_api_client", FakeClient)
    monkeypatch.setattr(imp, "fetch_json", fetch_json)
    monkeypatch.setattr(imp, "fetch_text", fetch_text)
    monkeypatch.setattr(imp, "db_select_all", select_all)
    monkeypatch.setattr(imp, "db_upsert", lambda t, rows, on_conflict: writes["upsert"].extend(rows))
    monkeypatch.setattr(imp, "db_insert", lambda t, rows: writes["insert"].extend(rows))
    return writes


def test_imports_both_feeds_and_notes_unreadable_files(monkeypatch):
    w = setup(monkeypatch)
    res = imp.import_symbols(["TCS"], since=date(2024, 1, 1), pause=0)
    got = {r["period_end"]: r for r in w["upsert"]}
    assert set(got) == {"2024-09-30", "2025-09-30"}
    assert got["2025-09-30"]["eps_q"] == 33.37 and got["2025-09-30"]["source_url"] == NEW_URL
    assert got["2025-09-30"]["filed_at"] == "2025-10-09T17:56:24+05:30"
    assert got["2024-09-30"]["ytd_months"] == 6 and got["2024-09-30"]["eps_ytd"] == 66.20
    assert [r["source_url"] for r in w["insert"]] == [BAD_URL]
    assert res["files"] == 2 and res["unreadable"] == 1


def test_resumes_skipping_stored_and_skipped_files(monkeypatch):
    w = setup(monkeypatch, stored_rows=[{"period_end": "2024-09-30", "consolidated": True, "source_url": OLD_URL}], skipped=[BAD_URL])
    imp.import_symbols(["TCS"], since=date(2024, 1, 1), pause=0)
    assert [r["period_end"] for r in w["upsert"]] == ["2025-09-30"]
    assert w["insert"] == []


def test_window_drops_old_quarters(monkeypatch):
    w = setup(monkeypatch)
    imp.import_symbols(["TCS"], since=date(2025, 7, 1), pause=0)
    assert [r["period_end"] for r in w["upsert"]] == ["2025-09-30"]
