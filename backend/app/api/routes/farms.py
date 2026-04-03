from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession
from typing import List

from app.db.database import get_session
from app.models.farm import Farm, FarmInput, FarmResponse
from app.core.mrv_engine import calculate_carbon

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
