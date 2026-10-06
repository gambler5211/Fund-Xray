"""Let the job tests import the jobs (flat modules in jobs/) and the engine package without installing them."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
for p in (ROOT / "jobs", ROOT / "engine"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))
