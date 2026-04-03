"""Shared cached loader for ipcc_soc_factors.json."""
import json
from pathlib import Path

_SOC_PATH = Path(__file__).parent / "data" / "ipcc_soc_factors.json"
_cache: dict | None = None


def load_soc_factors() -> dict:
    global _cache
    if _cache is None:
        with open(_SOC_PATH, "r") as f:
            _cache = json.load(f)
    return _cache
