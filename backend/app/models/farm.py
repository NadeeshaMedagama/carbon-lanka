from typing import Optional
from datetime import datetime
from sqlmodel import SQLModel, Field


class FarmInput(SQLModel):
    """Input payload for carbon estimation."""
    land_area_ha: float = Field(..., gt=0, description="Farm area in hectares")
    crop_type: str = Field(..., description="Crop type key from IPCC emission factors DB")
    practice_change: str = Field(..., description="e.g. organic_conversion, agroforestry_adoption, solar_install")
    years_since_change: int = Field(default=1, ge=1, description="Years since practice change was adopted")
    fertiliser_kg_ha_yr: float = Field(default=0.0, ge=0, description="Synthetic fertiliser applied (kg/ha/yr)")
    fuel_litres_yr: float = Field(default=0.0, ge=0, description="Fossil fuel used per year (litres)")
    solar_kw_installed: Optional[float] = Field(default=None, description="For solar co-ops: installed kW capacity")
    farmer_name: Optional[str] = None
    district: Optional[str] = Field(default="Nuwara Eliya")
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class Farm(SQLModel, table=True):
    """Persisted farm record."""
    id: Optional[int] = Field(default=None, primary_key=True)
    farmer_name: str = Field(default="Anonymous")
    district: str = Field(default="Nuwara Eliya")
    land_area_ha: float
    crop_type: str
    practice_change: str
    years_since_change: int = 1
    fertiliser_kg_ha_yr: float = 0.0
    fuel_litres_yr: float = 0.0
    solar_kw_installed: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    estimated_tonnes_co2: Optional[float] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    in_pool: bool = False


class FarmResponse(SQLModel):
    id: int
    farmer_name: str
    district: str
    land_area_ha: float
    crop_type: str
    estimated_tonnes_co2: Optional[float]
    in_pool: bool
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: datetime
