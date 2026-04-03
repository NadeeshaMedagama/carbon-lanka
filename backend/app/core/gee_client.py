"""
Google Earth Engine Client
============================
Provides live Sentinel-2 NDVI, ERA5 weather, and SoilGrids soil data
for the CarbonLanka MRV pipeline.

Every function gracefully returns None when GEE is not initialized or
if any API call fails — the caller falls back to pre-computed demo data.

References:
  Gorelick et al. (2017). Google Earth Engine: Planetary-scale geospatial
  analysis. Remote Sensing of Environment, 202, 18-27.
"""

import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import ee

log = logging.getLogger("carbonlanka.gee")

_gee_initialized: bool = False


def init_gee() -> bool:
    """
    Initialize GEE with the service account credentials from .env.
    Safe to call multiple times — returns cached state after first call.
    """
    global _gee_initialized
    if _gee_initialized:
        return True

    from app.config import settings

    key_path = settings.gee_service_account_key
    project_id = settings.gee_project_id

    if not key_path or not project_id:
        log.warning("[GEE] Missing gee_service_account_key or gee_project_id in .env")
        return False

    try:
        key_file = Path(key_path)
        if not key_file.is_absolute():
            key_file = Path(__file__).parent.parent.parent / key_path

        if not key_file.exists():
            log.error("[GEE] Key file not found: %s", key_file)
            return False

        with open(key_file) as f:
            key_data = json.load(f)
        email = key_data.get("client_email", "")

        credentials = ee.ServiceAccountCredentials(email, str(key_file))
        # Note: some service accounts fail with project= param due to missing
        # serviceusage.serviceUsageConsumer role. Initialize without it first,
        # then try with project if the basic init succeeds.
        try:
            ee.Initialize(credentials, project=project_id)
        except Exception:
            log.warning("[GEE] Init with project=%s failed, retrying without project param", project_id)
            ee.Initialize(credentials)

        _gee_initialized = True
        log.info("[GEE] Initialized successfully — project=%s  email=%s", project_id, email)
        return True

    except Exception as exc:
        log.error("[GEE] Initialization failed: %s", exc)
        return False


def fetch_ndvi(
    lat: float,
    lng: float,
    buffer_m: int = 2500,
    months_back: int = 12,
) -> Optional[dict]:
    """
    Fetch real Sentinel-2 NDVI for a farm location.
    Returns mean NDVI over a median composite of the last N months.
    """
    if not _gee_initialized:
        return None

    try:
        point = ee.Geometry.Point([lng, lat])
        aoi = point.buffer(buffer_m)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=months_back * 30)

        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterDate(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
            .filterBounds(aoi)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        )

        t0 = time.perf_counter()
        count = collection.size().getInfo()
        log.info("[GEE] fetch_ndvi: found %d Sentinel-2 images  date_range=%s to %s",
                 count, start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
        if count == 0:
            log.warning("[GEE] No Sentinel-2 images found for (%.4f, %.4f)  buffer=%dm  cloud<20%%",
                        lat, lng, buffer_m)
            return None

        ndvi_collection = collection.map(
            lambda img: img.normalizedDifference(["B8", "B4"])
                .rename("NDVI")
                .copyProperties(img, ["system:time_start"])
        )

        log.info("[GEE] Computing NDVI median composite from %d images...", count)
        median = ndvi_collection.median()

        stats = median.reduceRegion(
            reducer=ee.Reducer.mean().combine(ee.Reducer.count(), sharedInputs=True),
            geometry=aoi,
            scale=10,
            maxPixels=1e6,
        ).getInfo()

        ndvi_mean = stats.get("NDVI_mean")
        pixel_count = stats.get("NDVI_count", 0)

        if ndvi_mean is None:
            log.warning("[GEE] NDVI reduction returned None for (%.4f, %.4f) — no valid pixels?", lat, lng)
            return None

        ms = (time.perf_counter() - t0) * 1000
        log.info("[GEE] NDVI fetched: mean=%.4f  pixels=%d  images=%d  (%.0f ms)  for (%.4f, %.4f)",
                 ndvi_mean, pixel_count, count, ms, lat, lng)

        return {
            "ndvi_mean": round(ndvi_mean, 4),
            "pixel_count": int(pixel_count),
            "image_count": count,
            "date_range": f"{start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}",
            "source": "Sentinel-2 SR Harmonized via GEE",
        }

    except Exception as exc:
        log.error("[GEE] fetch_ndvi failed: %s", exc)
        return None


def fetch_ndvi_trend(
    lat: float,
    lng: float,
    buffer_m: int = 2500,
    years: int = 3,
) -> Optional[dict]:
    """
    Compute NDVI trend (slope) over N years using linear regression.
    Implements Lasaponara et al. (2022) approach.
    """
    if not _gee_initialized:
        return None

    try:
        point = ee.Geometry.Point([lng, lat])
        aoi = point.buffer(buffer_m)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=years * 365)

        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterDate(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
            .filterBounds(aoi)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        )

        def add_ndvi_and_time(img):
            ndvi = img.normalizedDifference(["B8", "B4"]).rename("NDVI")
            # Time in fractional years since epoch for regression
            time_band = img.metadata("system:time_start").divide(1e3 * 86400 * 365.25).rename("time")
            return ndvi.addBands(time_band)

        t0 = time.perf_counter()
        count = collection.size().getInfo()
        log.info("[GEE] fetch_ndvi_trend: %d images over %d years  for (%.4f, %.4f)",
                 count, years, lat, lng)

        ndvi_time = collection.map(add_ndvi_and_time)

        log.info("[GEE] Running linearFit regression on NDVI time series...")
        trend = ndvi_time.select(["time", "NDVI"]).reduce(ee.Reducer.linearFit())

        stats = trend.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=aoi,
            scale=10,
            maxPixels=1e6,
        ).getInfo()

        slope = stats.get("scale")  # linearFit returns 'scale' (slope) and 'offset'
        if slope is None:
            log.warning("[GEE] NDVI trend returned None for (%.4f, %.4f) — insufficient data?", lat, lng)
            return None

        if slope > 0.001:
            direction = "positive"
        elif slope < -0.001:
            direction = "negative"
        else:
            direction = "stable"

        ms = (time.perf_counter() - t0) * 1000
        log.info("[GEE] NDVI trend: slope=%.6f  direction=%s  offset=%.4f  (%.0f ms)  for (%.4f, %.4f) over %d years",
                 slope, direction, stats.get("offset", 0.0), ms, lat, lng, years)

        return {
            "slope": round(slope, 6),
            "direction": direction,
            "offset": round(stats.get("offset", 0.0), 4),
            "years": years,
        }

    except Exception as exc:
        log.error("[GEE] fetch_ndvi_trend failed: %s", exc)
        return None


def fetch_era5_daily(
    lat: float,
    lng: float,
    days: int = 365,
) -> Optional[list]:
    """
    Fetch daily ERA5-Land weather data for KGML model input.
    Returns list of dicts with temperature, precipitation, radiation.
    """
    if not _gee_initialized:
        return None

    try:
        point = ee.Geometry.Point([lng, lat])

        # ERA5-Land has ~10 day latency — end 10 days ago to ensure data exists
        end_date = datetime.utcnow() - timedelta(days=10)
        start_date = end_date - timedelta(days=days)

        bands = [
            "temperature_2m",
            "total_precipitation_sum",
            "surface_solar_radiation_downwards_sum",
        ]

        collection = (
            ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
            .filterDate(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
            .select(bands)
        )

        # Use getRegion for efficient point extraction across time series
        region_data = collection.getRegion(point, scale=11132).getInfo()

        t0 = time.perf_counter()
        log.info("[GEE] ERA5 request: %s to %s  bands=%s",
                 start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"), bands)

        if not region_data or len(region_data) < 2:
            log.warning("[GEE] No ERA5 data returned for (%.4f, %.4f)  date_range=%s to %s",
                        lat, lng, start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
            return None

        # region_data[0] is headers, rest are rows
        headers = region_data[0]
        time_idx = headers.index("time")
        temp_idx = headers.index("temperature_2m") if "temperature_2m" in headers else None
        precip_idx = headers.index("total_precipitation_sum") if "total_precipitation_sum" in headers else None
        rad_idx = headers.index("surface_solar_radiation_downwards_sum") if "surface_solar_radiation_downwards_sum" in headers else None

        daily = []
        for row in region_data[1:]:
            ts_ms = row[time_idx]
            date_str = datetime.utcfromtimestamp(ts_ms / 1000).strftime("%Y-%m-%d")
            t_kelvin = row[temp_idx] if temp_idx and row[temp_idx] else 293.15
            precip = row[precip_idx] if precip_idx and row[precip_idx] else 0.0
            rad = row[rad_idx] if rad_idx and row[rad_idx] else 0.0

            daily.append({
                "date": date_str,
                "temperature_c": round(t_kelvin - 273.15, 2),
                "precipitation_mm": round(precip * 1000, 2),
                "radiation_wm2": round(rad / 86400, 2),
            })

        ms = (time.perf_counter() - t0) * 1000
        if daily:
            t_vals = [d["temperature_c"] for d in daily]
            p_vals = [d["precipitation_mm"] for d in daily]
            log.info("[GEE] ERA5 fetched: %d days  T=[%.1f, %.1f]°C  P_annual=%.0f mm  (%.0f ms)  for (%.4f, %.4f)",
                     len(daily), min(t_vals), max(t_vals), sum(p_vals), ms, lat, lng)
        else:
            log.warning("[GEE] ERA5 parsed 0 valid rows for (%.4f, %.4f)", lat, lng)
        return daily

    except Exception as exc:
        log.error("[GEE] fetch_era5_daily failed: %s", exc)
        return None


def fetch_soilgrids(lat: float, lng: float) -> Optional[dict]:
    """
    Fetch SoilGrids 250m soil properties at 0-30cm depth.
    Returns SOC, bulk density, pH, clay%.
    """
    if not _gee_initialized:
        return None

    try:
        point = ee.Geometry.Point([lng, lat])

        # OpenLandMap datasets (globally available via GEE)
        # Bands b0=0-5cm, b10=5-15cm, b30=15-30cm — average for 0-30cm
        layers = {
            "soc": "OpenLandMap/SOL/SOL_ORGANIC-CARBON_USDA-6A1C_M/v02",
            "bdod": "OpenLandMap/SOL/SOL_BULKDENS-FINEEARTH_USDA-4A1H_M/v02",
            "ph": "OpenLandMap/SOL/SOL_PH-H2O_USDA-4C1A2A_M/v02",
            "clay": "OpenLandMap/SOL/SOL_CLAY-WFRACTION_USDA-3A1A1A_M/v02",
        }
        depth_bands = ["b0", "b10", "b30"]  # 0-5cm, 5-15cm, 15-30cm

        t0 = time.perf_counter()
        log.info("[GEE] fetch_soilgrids: querying %d OpenLandMap layers at (%.4f, %.4f)",
                 len(layers), lat, lng)
        result = {}
        for name, asset_id in layers.items():
            try:
                img = ee.Image(asset_id).select(depth_bands).reduce(ee.Reducer.mean())
                val = img.reduceRegion(
                    reducer=ee.Reducer.mean(),
                    geometry=point,
                    scale=250,
                ).getInfo()

                for v in val.values():
                    if v is not None:
                        result[name] = round(float(v), 2)
                        log.info("[GEE]   %-6s raw=%.3f  (%s)", name, result[name], asset_id.split("/")[-1])
                        break
            except Exception as layer_exc:
                log.warning("[GEE]   %-6s FAILED: %s", name, layer_exc)

        if not result:
            log.warning("[GEE] SoilGrids returned no data for (%.4f, %.4f) — all layers failed", lat, lng)
            return None

        # OpenLandMap units: SOC in g/kg, bulk density in kg/m3 (×10), pH ×10, clay in %
        soil = {
            "soc_g_kg": result.get("soc", 0.0),              # g/kg organic carbon
            "bulk_density_kg_dm3": result.get("bdod", 0.0) / 1000.0,  # kg/m3 → kg/dm3
            "ph": result.get("ph", 0.0) / 10.0,              # pH × 10 → pH
            "clay_pct": result.get("clay", 0.0),              # already in %
        }

        ms = (time.perf_counter() - t0) * 1000
        log.info("[GEE] SoilGrids done: soc=%.1f g/kg  bd=%.2f kg/dm3  pH=%.1f  clay=%.0f%%  (%.0f ms)  at (%.4f, %.4f)",
                 soil["soc_g_kg"], soil["bulk_density_kg_dm3"],
                 soil["ph"], soil["clay_pct"], ms, lat, lng)
        return soil

    except Exception as exc:
        log.error("[GEE] fetch_soilgrids failed: %s", exc)
        return None


def get_ndvi_map_tiles(
    lat: float,
    lng: float,
    buffer_m: int = 5000,
    months_back: int = 12,
) -> Optional[str]:
    """
    Get a GEE tile URL for NDVI overlay on Leaflet map.
    Returns a tile URL template string ({z}/{x}/{y}).
    """
    if not _gee_initialized:
        return None

    try:
        point = ee.Geometry.Point([lng, lat])
        aoi = point.buffer(buffer_m)

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=months_back * 30)

        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterDate(start_date.strftime("%Y-%m-%d"), end_date.strftime("%Y-%m-%d"))
            .filterBounds(aoi)
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        )

        ndvi = collection.map(
            lambda img: img.normalizedDifference(["B8", "B4"]).rename("NDVI")
        ).median().clip(aoi)

        vis_params = {
            "min": 0.0,
            "max": 1.0,
            "palette": ["#d73027", "#fc8d59", "#fee08b", "#d9ef8b", "#91cf60", "#1a9850"],
        }

        map_id = ndvi.getMapId(vis_params)
        tile_url = map_id["tile_fetcher"].url_format

        log.info("[GEE] NDVI tile URL generated for (%.4f, %.4f)", lat, lng)
        return tile_url

    except Exception as exc:
        log.error("[GEE] get_ndvi_map_tiles failed: %s", exc)
        return None
