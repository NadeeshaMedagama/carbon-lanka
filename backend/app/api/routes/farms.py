import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from app.db.database import get_session
from app.models.farm import Farm, FarmInput, FarmResponse
from app.core.mrv_engine import calculate_carbon

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/farms", tags=["Farms"])


@router.post("", response_model=FarmResponse, status_code=201)
async def register_farm(
    farm_input: FarmInput,
    session: AsyncSession = Depends(get_session),
) -> FarmResponse:
    """Register a new farm, run MRV calculation, and store the result."""
    try:
        mrv = calculate_carbon(farm_input)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    farm = Farm(
        farmer_name=farm_input.farmer_name or "Anonymous",
        district=farm_input.district or "Nuwara Eliya",
        land_area_ha=farm_input.land_area_ha,
        crop_type=farm_input.crop_type,
        practice_change=farm_input.practice_change,
        years_since_change=farm_input.years_since_change,
        fertiliser_kg_ha_yr=farm_input.fertiliser_kg_ha_yr,
        fuel_litres_yr=farm_input.fuel_litres_yr,
        solar_kw_installed=farm_input.solar_kw_installed,
        latitude=farm_input.latitude,
        longitude=farm_input.longitude,
        estimated_tonnes_co2=mrv.tonnes_co2_net,
        in_pool=False,
        claim_status=farm_input.claim_status or "UNVERIFIED",
        claim_status_reason=farm_input.claim_status_reason,
        anomaly_flag=farm_input.anomaly_flag or False,
    )
    session.add(farm)
    await session.commit()
    await session.refresh(farm)
    return FarmResponse(**farm.model_dump())


@router.get("", response_model=List[FarmResponse])
async def list_farms(
    session: AsyncSession = Depends(get_session),
    in_pool: bool | None = None,
) -> List[FarmResponse]:
    """List all farms, optionally filtered by pool membership."""
    query = select(Farm)
    if in_pool is not None:
        query = query.where(Farm.in_pool == in_pool)
    result = await session.exec(query)
    return [FarmResponse(**f.model_dump()) for f in result.all()]


@router.get("/{farm_id}", response_model=FarmResponse)
async def get_farm(
    farm_id: int,
    session: AsyncSession = Depends(get_session),
) -> FarmResponse:
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    return FarmResponse(**farm.model_dump())


@router.post("/{farm_id}/upload-proof")
async def upload_land_proof(
    farm_id: int,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_session),
) -> dict:
    """Upload a land ownership proof document for a farm."""
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    ext = os.path.splitext(file.filename or "doc")[1] or ".pdf"
    allowed = {".pdf", ".jpg", ".jpeg", ".png", ".webp"}
    if ext.lower() not in allowed:
        raise HTTPException(status_code=422, detail=f"File type {ext} not allowed. Use: {', '.join(allowed)}")

    filename = f"farm_{farm_id}_{uuid.uuid4().hex[:8]}{ext.lower()}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    farm.land_proof_url = f"/uploads/{filename}"
    session.add(farm)
    await session.commit()

    return {"success": True, "farm_id": farm_id, "land_proof_url": farm.land_proof_url}


@router.post("/{farm_id}/join-pool", response_model=FarmResponse)
async def join_pool(
    farm_id: int,
    session: AsyncSession = Depends(get_session),
) -> FarmResponse:
    """Add a farm to the aggregation pool."""
    farm = await session.get(Farm, farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    farm.in_pool = True
    session.add(farm)
    await session.commit()
    await session.refresh(farm)
    return FarmResponse(**farm.model_dump())
