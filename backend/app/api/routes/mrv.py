from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from app.models.farm import FarmInput
from app.models.credit import MRVResult
from app.core.mrv_engine import calculate_carbon
from app.core.satellite import verify_with_satellite, get_ndvi_tile_url

router = APIRouter(prefix="/mrv", tags=["MRV"])


@router.post("/calculate", response_model=MRVResult)
async def calculate_mrv(farm: FarmInput) -> MRVResult:
    """
    Run IPCC Tier-2 carbon estimation for a farm.

    Returns net CO2 tonnes, value range (USD + LKR), uncertainty bounds,
    confidence score, and methodology reference.
    """
    try:
        result = calculate_carbon(farm)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/verify-satellite", response_model=MRVResult)
async def verify_satellite(
    farm: FarmInput,
    latitude: Optional[float] = Query(default=None),
    longitude: Optional[float] = Query(default=None),
) -> MRVResult:
    """
    Run MRV calculation then cross-check against Sentinel-2 NDVI via GEE.

    Large discrepancies (>10%) set anomaly_flag=true for manual review.
    """
    try:
        mrv_result = calculate_carbon(farm)
        lat = latitude or farm.latitude
        lng = longitude or farm.longitude
        verified = verify_with_satellite(mrv_result, lat, lng)
        return verified
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/ndvi-tile")
async def get_ndvi_tile(
    crop_type: str = Query(...),
    latitude: float = Query(default=6.9271),
    longitude: float = Query(default=80.7718),
) -> dict:
    """
    Return NDVI tile overlay data for the Leaflet map.
    Includes NDVI score, bounding box, and color scale metadata.
    """
    return get_ndvi_tile_url(crop_type, latitude, longitude)


@router.get("/crop-types")
async def list_crop_types() -> list[dict]:
    """List all supported crop types with labels."""
    import json
    from pathlib import Path
    ef_path = Path(__file__).parent.parent.parent / "data" / "ipcc_emission_factors.json"
    with open(ef_path) as f:
        efs = json.load(f)
    return [
        {"key": k, "label": v["label"], "description": v["description"]}
        for k, v in efs.items()
        if not k.startswith("_")
    ]
