from sqlmodel import SQLModel
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.engine import make_url

from app.config import settings


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


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def get_session():
    async with AsyncSessionLocal() as session:
        yield session
