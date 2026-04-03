import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.config import settings
from app.db.database import init_db
from app.api.routes import mrv, farms, credits, marketplace

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    if settings.use_real_blockchain:
        if not settings.deployer_private_key:
            logger.warning(
                "USE_REAL_BLOCKCHAIN=true but DEPLOYER_PRIVATE_KEY is empty — "
                "blockchain features will be unavailable"
            )
        elif not settings.carbon_credit_contract_address:
            logger.warning(
                "USE_REAL_BLOCKCHAIN=true but CARBON_CREDIT_CONTRACT_ADDRESS is empty — "
                "blockchain features will be unavailable"
            )
        else:
            from app.core.blockchain import init_blockchain_service

            svc = init_blockchain_service(
                rpc_url=settings.polygon_amoy_rpc,
                private_key=settings.deployer_private_key,
                contract_address=settings.carbon_credit_contract_address,
            )
            info = await svc.check_connection()
            if info["connected"]:
                logger.info(
                    "Blockchain connected — chain=%s verifier=%s balance=%.4f POL",
                    info["chain_id"],
                    info["verifier_address"],
                    info["verifier_balance_pol"],
                )
            else:
                logger.warning("Blockchain RPC not reachable at %s", settings.polygon_amoy_rpc)
    else:
        logger.info("Blockchain disabled (USE_REAL_BLOCKCHAIN=false) — using simulated mode")

    yield


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
