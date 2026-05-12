"""Runtime config. Read from env once at import."""
from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

DATA_DIR = Path(os.environ.get("SIGPEN_DATA_DIR") or (REPO_ROOT / "data")).resolve()

DISABLE_SCHEDULER = os.environ.get("SIGPEN_DISABLE_SCHEDULER", "0") not in ("", "0", "false", "False")


def goes_xrays_poll_seconds() -> int:
    return int(os.environ.get("SIGPEN_GOES_XRAYS_POLL", "60"))
