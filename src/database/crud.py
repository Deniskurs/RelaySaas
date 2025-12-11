"""Database CRUD operations."""
from datetime import datetime, timedelta
from typing import Optional, List
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Signal, Trade, AccountSnapshot, AppState


# Signal operations
async def create_signal(
    session: AsyncSession,
    raw_message: str,
    channel_name: str,
    channel_id: Optional[str] = None,
    message_id: Optional[int] = None,
    user_id: Optional[str] = None,
) -> Signal:
    """Create a new signal record."""
    signal = Signal(
        user_id=user_id,
        raw_message=raw_message,
        channel_name=channel_name,
        channel_id=channel_id,
        message_id=message_id,
        status="received",
        received_at=datetime.utcnow(),
    )
    session.add(signal)
    await session.commit()
    await session.refresh(signal)
    return signal


async def get_signal(session: AsyncSession, signal_id: int) -> Optional[Signal]:
    """Get a signal by ID."""
    result = await session.execute(select(Signal).where(Signal.id == signal_id))
    return result.scalar_one_or_none()


async def update_signal(
    session: AsyncSession,
    signal_id: int,
    **kwargs,
) -> Optional[Signal]:
    """Update a signal with the given fields."""
    result = await session.execute(select(Signal).where(Signal.id == signal_id))
    signal = result.scalar_one_or_none()
    if signal:
        for key, value in kwargs.items():
            if hasattr(signal, key):
                setattr(signal, key, value)
        await session.commit()
        await session.refresh(signal)
    return signal


async def get_signals(
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[Signal]:
    """Get signals with optional filtering."""
    query = select(Signal).order_by(desc(Signal.received_at))
    if status:
        query = query.where(Signal.status == status)
    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    return list(result.scalars().all())


# Trade operations
async def create_trade(
    session: AsyncSession,
    signal_id: int,
    order_id: str,
    symbol: str,
    direction: str,
    lot_size: float,
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    tp_index: int,
    user_id: Optional[str] = None,
) -> Trade:
    """Create a new trade record."""
    trade = Trade(
        user_id=user_id,
        signal_id=signal_id,
        order_id=order_id,
        symbol=symbol,
        direction=direction,
        lot_size=lot_size,
        entry_price=entry_price,
        stop_loss=stop_loss,
        take_profit=take_profit,
        tp_index=tp_index,
        status="pending",
        opened_at=datetime.utcnow(),
    )
    session.add(trade)
    await session.commit()
    await session.refresh(trade)
    return trade


async def get_trade(session: AsyncSession, trade_id: int) -> Optional[Trade]:
    """Get a trade by ID."""
    result = await session.execute(select(Trade).where(Trade.id == trade_id))
    return result.scalar_one_or_none()


async def get_trade_by_order_id(
    session: AsyncSession, order_id: str
) -> Optional[Trade]:
    """Get a trade by order ID."""
    result = await session.execute(select(Trade).where(Trade.order_id == order_id))
    return result.scalar_one_or_none()


async def update_trade(
    session: AsyncSession,
    trade_id: int,
    **kwargs,
) -> Optional[Trade]:
    """Update a trade with the given fields."""
    result = await session.execute(select(Trade).where(Trade.id == trade_id))
    trade = result.scalar_one_or_none()
    if trade:
        for key, value in kwargs.items():
            if hasattr(trade, key):
                setattr(trade, key, value)
        await session.commit()
        await session.refresh(trade)
    return trade


async def get_open_trades(session: AsyncSession) -> List[Trade]:
    """Get all open trades."""
    query = (
        select(Trade)
        .where(Trade.status.in_(["pending", "open"]))
        .order_by(desc(Trade.opened_at))
    )
    result = await session.execute(query)
    return list(result.scalars().all())


async def get_trades(
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
) -> List[Trade]:
    """Get trades with optional filtering."""
    query = select(Trade).order_by(desc(Trade.opened_at))
    if status:
        query = query.where(Trade.status == status)
    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    return list(result.scalars().all())


# Statistics operations
async def get_stats(session: AsyncSession) -> dict:
    """Get trading statistics."""
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    # Signal counts
    total_signals = await session.scalar(select(func.count(Signal.id)))
    signals_today = await session.scalar(
        select(func.count(Signal.id)).where(Signal.received_at >= today)
    )

    # Trade counts
    total_trades = await session.scalar(select(func.count(Trade.id)))
    open_trades = await session.scalar(
        select(func.count(Trade.id)).where(Trade.status.in_(["pending", "open"]))
    )
    closed_trades = await session.scalar(
        select(func.count(Trade.id)).where(Trade.status == "closed")
    )

    # Win/loss
    winning_trades = await session.scalar(
        select(func.count(Trade.id)).where(Trade.status == "closed", Trade.profit > 0)
    )
    losing_trades = await session.scalar(
        select(func.count(Trade.id)).where(Trade.status == "closed", Trade.profit < 0)
    )

    win_rate = (winning_trades / closed_trades * 100) if closed_trades > 0 else 0

    # Profit
    total_profit = (
        await session.scalar(
            select(func.sum(Trade.profit)).where(Trade.status == "closed")
        )
        or 0
    )

    today_profit = (
        await session.scalar(
            select(func.sum(Trade.profit)).where(
                Trade.status == "closed", Trade.closed_at >= today
            )
        )
        or 0
    )

    return {
        "total_signals": total_signals or 0,
        "signals_today": signals_today or 0,
        "total_trades": total_trades or 0,
        "open_trades": open_trades or 0,
        "closed_trades": closed_trades or 0,
        "winning_trades": winning_trades or 0,
        "losing_trades": losing_trades or 0,
        "win_rate": round(win_rate, 1),
        "total_profit": round(total_profit, 2),
        "today_profit": round(today_profit, 2),
    }


# App state operations
async def get_app_state(session: AsyncSession, key: str) -> Optional[str]:
    """Get an app state value."""
    result = await session.execute(select(AppState).where(AppState.key == key))
    state = result.scalar_one_or_none()
    return state.value if state else None


async def set_app_state(session: AsyncSession, key: str, value: str):
    """Set an app state value."""
    result = await session.execute(select(AppState).where(AppState.key == key))
    state = result.scalar_one_or_none()
    if state:
        state.value = value
        state.updated_at = datetime.utcnow()
    else:
        session.add(AppState(key=key, value=value))
    await session.commit()


async def is_paused(session: AsyncSession) -> bool:
    """Check if signal processing is paused."""
    value = await get_app_state(session, "paused")
    return value == "true"


# Account snapshot operations
async def create_account_snapshot(
    session: AsyncSession,
    balance: float,
    equity: float,
    margin: float,
    free_margin: float,
    open_positions: int,
) -> AccountSnapshot:
    """Create an account snapshot."""
    snapshot = AccountSnapshot(
        balance=balance,
        equity=equity,
        margin=margin,
        free_margin=free_margin,
        open_positions=open_positions,
    )
    session.add(snapshot)
    await session.commit()
    return snapshot


async def get_account_snapshots(
    session: AsyncSession,
    hours: int = 24,
) -> List[AccountSnapshot]:
    """Get account snapshots from the last N hours."""
    since = datetime.utcnow() - timedelta(hours=hours)
    query = (
        select(AccountSnapshot)
        .where(AccountSnapshot.recorded_at >= since)
        .order_by(AccountSnapshot.recorded_at)
    )
    result = await session.execute(query)
    return list(result.scalars().all())
