import logging
import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.config import settings
from app.db.database import init_db
from app.api.routes import mrv, farms, credits, marketplace, admin

# ── Logging setup ─────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("carbonlanka")

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("=== CarbonLanka API starting up ===")
    log.info("DB  : %s", settings.database_url)
    log.info("GEE : project=%s  key_set=%s",
             settings.gee_project_id or "(not set)",
             bool(settings.gee_service_account_key))
    log.info("Price range: $%.0f – $%.0f / t CO2  |  1 USD = %.0f LKR",
             settings.carbon_price_min, settings.carbon_price_max, settings.usd_to_lkr)
    await init_db()
    log.info("Database initialised")

    # Initialize Google Earth Engine
    try:
        from app.core.gee_client import init_gee
        gee_ok = init_gee()
        log.info("GEE  : %s", "connected (live Sentinel-2)" if gee_ok else "demo mode (no credentials)")
    except Exception as exc:
        log.warning("GEE  : init failed (%s) — running in demo mode", exc)

    # Load KGML model
    try:
        from app.core.kgml_model import _load_model, is_model_loaded
        _load_model()
        log.info("KGML : %s", "model loaded" if is_model_loaded() else "model not found (run notebooks to train)")
    except Exception as exc:
        log.warning("KGML : load failed (%s) — endpoint disabled", exc)

    # Initialize blockchain service
    if settings.use_real_blockchain:
        try:
            from app.core.blockchain import init_blockchain_service
            svc = init_blockchain_service(
                rpc_url=settings.polygon_amoy_rpc,
                private_key=settings.deployer_private_key,
                contract_address=settings.carbon_credit_contract_address,
            )
            health = await svc.check_connection()
            log.info(
                "Chain: connected  chain_id=%s  verifier=%s  balance=%.4f POL  contract=%s",
                health.get("chain_id"),
                health.get("verifier_address"),
                health.get("verifier_balance_pol", 0),
                settings.carbon_credit_contract_address,
            )
        except Exception as exc:
            log.warning("Chain: init failed (%s) — minting will use simulation", exc)
    else:
        log.info("Chain: blockchain not configured (set DEPLOYER_PRIVATE_KEY + CARBON_CREDIT_CONTRACT_ADDRESS)")

    yield
    log.info("=== CarbonLanka API shutting down ===")


app = FastAPI(
    title="CarbonLanka API",
    description=(
        "Carbon Credit Micro-Marketplace for Sri Lankan SMEs. "
        "AI Measurement · Blockchain Tokenisation · Satellite Verification"
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mrv.router)
app.include_router(farms.router)
app.include_router(credits.router)
app.include_router(marketplace.router)
app.include_router(admin.router)

# Serve uploaded proof documents via a normal route (inherits CORS from the app)
_uploads_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(_uploads_dir, exist_ok=True)


@app.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve uploaded proof documents with proper CORS headers."""
    from fastapi.responses import FileResponse
    filepath = os.path.join(_uploads_dir, filename)
    if not os.path.isfile(filepath):
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="File not found")
    media_types = {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    ext = os.path.splitext(filename)[1].lower()
    return FileResponse(filepath, media_type=media_types.get(ext, "application/octet-stream"))


@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.perf_counter()
    response = await call_next(request)
    ms = (time.perf_counter() - t0) * 1000
    log.info("%s %s  →  %d  (%.0f ms)",
             request.method, request.url.path, response.status_code, ms)
    return response


@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "service": "CarbonLanka API"}


@app.get("/")
async def root() -> dict:
    return {
        "service": "CarbonLanka",
        "tagline": "Carbon Credit Micro-Marketplace for Sri Lankan SMEs",
        "docs": "/docs",
        "health": "/health",
    }
