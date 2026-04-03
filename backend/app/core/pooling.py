"""
Credit Aggregation (Pooling) Engine
=====================================
Bundles small farm carbon credits into Verra-compliant batches.

The carbon market requires 10,000+ t CO2/yr minimum per project.
CarbonMicro pools 200+ small farms to clear this threshold,
then distributes earnings pro-rata by tonnes contributed.

Reference:
  Verra VMD0042 Improved Agricultural Land Management
  https://verra.org/methodology/vmd0042/
"""

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from app.models.farm import Farm
from app.models.credit import PoolBundle
from app.config import settings

_PLATFORM_FEE_RATE = 0.06          # 6% transaction fee
_TOTAL_MRV_COST_USD = 40_000.0     # shared Verra verification cost
_VERRA_MINIMUM_TONNES = 10_000.0


async def get_pool_bundle(session: AsyncSession) -> PoolBundle:
    """Build a PoolBundle summary from all farms currently in the pool."""
    result = await session.exec(select(Farm).where(Farm.in_pool == True))
    farms = result.all()

    total_tonnes = sum(f.estimated_tonnes_co2 or 0.0 for f in farms)
    total_farms = len(farms)

    price_avg = (settings.carbon_price_min + settings.carbon_price_max) / 2
    gross_usd = total_tonnes * price_avg
    platform_fee = gross_usd * _PLATFORM_FEE_RATE
    mrv_cost_per_farm = _TOTAL_MRV_COST_USD / max(total_farms, 1)
    total_mrv_cost = mrv_cost_per_farm * total_farms
    net_to_farmers_usd = gross_usd - platform_fee - total_mrv_cost
    net_to_farmers_lkr = net_to_farmers_usd * settings.usd_to_lkr

    members = []
    for farm in farms:
        tonnes = farm.estimated_tonnes_co2 or 0.0
        share_pct = (tonnes / total_tonnes * 100) if total_tonnes > 0 else 0.0
        payout_usd = (tonnes / total_tonnes * net_to_farmers_usd) if total_tonnes > 0 else 0.0
        members.append({
            "farm_id": farm.id,
            "farmer_name": farm.farmer_name,
            "district": farm.district,
            "crop_type": farm.crop_type,
            "tonnes_co2": round(tonnes, 2),
            "share_pct": round(share_pct, 4),
            "payout_usd": round(payout_usd, 2),
            "payout_lkr": round(payout_usd * settings.usd_to_lkr, 0),
            "latitude": farm.latitude,
            "longitude": farm.longitude,
        })

    return PoolBundle(
        total_farms=total_farms,
        total_tonnes_co2=round(total_tonnes, 2),
        gross_value_usd=round(gross_usd, 2),
        platform_fee_usd=round(platform_fee, 2),
        shared_mrv_cost_usd=round(total_mrv_cost, 2),
        net_to_farmers_usd=round(net_to_farmers_usd, 2),
        net_to_farmers_lkr=round(net_to_farmers_lkr, 0),
        meets_verra_minimum=total_tonnes >= _VERRA_MINIMUM_TONNES,
        verra_minimum_tonnes=_VERRA_MINIMUM_TONNES,
        pool_members=members,
    )
