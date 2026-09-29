"""Fund X-Ray engine.

Plain Python, no web or UI code, so the same package runs in the API, the nightly jobs and tests.
Modules arrive by day: kite (Day 4-5), sectors (Day 6), prices (Day 6), rotation (week 2), alignment (week 3).
"""

from .defaults import DEFAULT_SETTINGS, UserSettings
from .portfolio import build_snapshot, company_name

__all__ = ["DEFAULT_SETTINGS", "UserSettings", "build_snapshot", "company_name"]
__version__ = "0.1.0"
