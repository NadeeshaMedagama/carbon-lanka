"""
Satellite Verification via Google Earth Engine
================================================
Cross-checks farm-reported sequestration against Sentinel-2 NDVI.
Large discrepancies (>10%) trigger an anomaly flag for manual review.

Reference:
  Gorelick et al. (2017). Google Earth Engine: Planetary-scale geospatial analysis.
  Remote Sensing of Environment, 202, 18–27.
  https://doi.org/10.1016/j.rse.2017.06.031

For the MVP/hackathon: returns pre-computed NDVI scores and a demo
tile URL. Production integration uses the GEE Python API.
"""

import hashlib
from datetime import datetime
from typing import Optional

from app.models.credit import MRVResult


# Pre-computed NDVI scores by crop type (derived from GEE exports over
# representative Sri Lankan farm polygons — used for hackathon demo).
_DEMO_NDVI_SCORES: dict[str, float] = {
    "tea_organic": 0.74,
    "tea_conventional": 0.61,
    "paddy_rice": 0.58,
    "rubber_agroforestry": 0.81,
    "spice_cinnamon": 0.69,
    "solar_cooperative": 0.15,
    "forest_regen": 0.86,
    "coconut_organic": 0.72,
}

# NDVI → expected sequestration range (t CO2/ha/yr) mapping
_NDVI_SEQ_RANGE: dict[str, tuple[float, float]] = {
    "tea_organic": (6.5, 10.5),
    "tea_conventional": (3.0, 5.5),
    "paddy_rice": (2.0, 4.5),
    "rubber_agroforestry": (9.0, 16.0),
    "spice_cinnamon": (5.5, 10.0),
    "solar_cooperative": (0.0, 1.0),
    "forest_regen": (14.0, 23.0),
    "coconut_organic": (4.5, 8.0),
}

_ANOMALY_THRESHOLD = 0.10  # flag if self-reported > satellite-expected by >10%


def verify_with_satellite(
    mrv_result: MRVResult,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> MRVResult:
    """
    Cross-check MRV estimate against Sentinel-2 NDVI.

    In production this calls GEE API. For MVP it uses pre-computed
    demo values and generates a deterministic satellite hash.
    """
    crop = mrv_result.crop_type
    ndvi = _DEMO_NDVI_SCORES.get(crop, 0.60)

    # Estimate expected sequestration range from NDVI
    seq_range = _NDVI_SEQ_RANGE.get(crop, (0.0, 30.0))
    expected_mid = (seq_range[0] + seq_range[1]) / 2.0
    reported_per_ha = (
        mrv_result.tonnes_co2_net / mrv_result.land_area_ha
        if mrv_result.land_area_ha > 0
        else 0.0
    )

    # Check for anomaly: reported significantly above satellite expectation
    anomaly = False
    if expected_mid > 0 and reported_per_ha > expected_mid * (1 + _ANOMALY_THRESHOLD):
        anomaly = True

    # Generate a deterministic satellite verification hash
    # In production: keccak256(NDVI_export_file_bytes + farm_id + timestamp)
    hash_input = f"{crop}:{ndvi}:{latitude}:{longitude}:{datetime.utcnow().date()}"
    sat_hash = "0x" + hashlib.sha256(hash_input.encode()).hexdigest()[:64]

    mrv_result.satellite_verified = True
    mrv_result.satellite_ndvi_score = ndvi
    mrv_result.anomaly_flag = anomaly

    return mrv_result


def get_ndvi_tile_url(
    crop_type: str,
    latitude: float = 6.9271,
    longitude: float = 80.7718,  # Nuwara Eliya default
) -> dict:
    """
    Returns NDVI tile overlay data for the frontend Leaflet map.
    MVP: returns a pre-computed GEE export URL and bounding box.
    Production: generates signed GEE map tile URL via Earth Engine API.
    """
    ndvi_score = _DEMO_NDVI_SCORES.get(crop_type, 0.65)

    # Bounding box: ±0.05° around the farm point (~5.5 km radius)
    bbox = {
        "south": latitude - 0.05,
        "west": longitude - 0.05,
        "north": latitude + 0.05,
        "east": longitude + 0.05,
    }

    return {
        "ndvi_score": ndvi_score,
        "center": {"lat": latitude, "lng": longitude},
        "bbox": bbox,
        "color_scale": "RdYlGn",
        "legend": {
            "min": 0.0,
            "max": 1.0,
            "label": "NDVI (Vegetation Index)",
            "low": "Sparse / bare soil",
            "high": "Dense / healthy vegetation",
        },
        "source": "Copernicus Sentinel-2, Google Earth Engine",
        "date": "2026-03",
        "note": "MVP: pre-computed GEE export. Production: live Sentinel-2 tile.",
    }
