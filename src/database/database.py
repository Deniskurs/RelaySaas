"""Database connection and session management."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from .models import Base
from ..config import settings
from ..utils.logger import log

# Convert sqlite:/// to sqlite+aiosqlite:/// for async support
database_url = settings.database_url.replace("sqlite:///", "sqlite+aiosqlite:///")

engine = create_async_engine(
    database_url,
    echo=False,
    future=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("Database initialized", url=settings.database_url)


async def get_session() -> AsyncSession:
    """Get an async database session.

    Yields:
        AsyncSession: Database session for queries.
    """
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def close_db():
    """Close database connections."""
    await engine.dispose()
    log.info("Database connections closed")
