import logging
from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.engine import make_url
from sqlalchemy import text

from app.config import settings

log = logging.getLogger("carbonlanka")


def _validate_async_database_url(database_url: str) -> None:
    driver_name = make_url(database_url).drivername
    allowed_async_drivers = {"sqlite+aiosqlite", "postgresql+asyncpg"}
    if driver_name not in allowed_async_drivers:
        raise ValueError(
            "DATABASE_URL must use an async SQLAlchemy driver "
            "(supported: sqlite+aiosqlite or postgresql+asyncpg)."
        )


_validate_async_database_url(settings.database_url)
engine = create_async_engine(settings.database_url, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# Columns added after initial schema — migrate automatically on startup
_MIGRATIONS = [
    # (table, column, definition)
    ("credittoken", "on_chain", "INTEGER NOT NULL DEFAULT 0"),
    ("credittoken", "claim_status", "VARCHAR DEFAULT 'UNVERIFIED'"),
    ("credittoken", "claim_status_reason", "VARCHAR"),
    ("farm", "latitude", "FLOAT"),
    ("farm", "longitude", "FLOAT"),
    ("farm", "claim_status", "VARCHAR DEFAULT 'UNVERIFIED'"),
    ("farm", "claim_status_reason", "VARCHAR"),
    ("farm", "anomaly_flag", "INTEGER NOT NULL DEFAULT 0"),
    ("farm", "practice_change", "VARCHAR DEFAULT 'conventional_management'"),
    ("farm", "years_since_change", "INTEGER DEFAULT 1"),
    ("farm", "land_proof_url", "VARCHAR"),
    ("farm", "admin_approved", "INTEGER NOT NULL DEFAULT 0"),
]


async def _run_migrations(conn) -> None:
    """Add missing columns to existing tables without dropping data."""
    for table, column, definition in _MIGRATIONS:
        try:
            await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            log.info("Migration: added column %s.%s", table, column)
        except Exception:
            pass  # Column already exists — safe to ignore


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
        await _run_migrations(conn)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
