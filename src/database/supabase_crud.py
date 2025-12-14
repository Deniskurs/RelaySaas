"""Supabase CRUD operations for signals and trades."""
from datetime import datetime, timedelta
from typing import Optional, List
from .supabase import get_supabase_admin


async def create_signal(
    raw_message: str,
    channel_name: str,
    channel_id: Optional[str] = None,
    message_id: Optional[int] = None,
    user_id: str = None,
) -> dict:
    """Create a new signal record in Supabase.

    Args:
        raw_message: The raw message text from Telegram.
        channel_name: Name of the Telegram channel.
        channel_id: ID of the Telegram channel.
        message_id: Telegram message ID (for deduplication).
        user_id: User UUID (REQUIRED in multi-tenant mode).

    Returns:
        The created signal record, or None if duplicate.

    Raises:
        ValueError: If user_id is not provided.
    """
    if not user_id:
        raise ValueError("user_id is required for creating signals")

    supabase = get_supabase_admin()

    # Check for duplicate message to prevent double-processing
    if message_id and channel_id:
        existing = supabase.table("signals_v2") \
            .select("id") \
            .eq("channel_id", channel_id) \
            .eq("message_id", message_id) \
            .execute()
        if existing.data and len(existing.data) > 0:
            # Already processed this message
            return None

    data = {
        "user_id": user_id,
        "raw_message": raw_message,
        "channel_name": channel_name,
        "channel_id": channel_id,
        "message_id": message_id,
        "status": "received",
        "received_at": datetime.utcnow().isoformat(),
        "take_profits": [],
        "warnings": [],
    }

    result = supabase.table("signals_v2").insert(data).execute()
    return result.data[0] if result.data else None


async def get_signal(signal_id: int) -> Optional[dict]:
    """Get a signal by ID."""
    supabase = get_supabase_admin()
    result = supabase.table("signals_v2").select("*").eq("id", signal_id).execute()
    return result.data[0] if result.data else None


async def update_signal(signal_id: int, **kwargs) -> Optional[dict]:
    """Update a signal with the given fields."""
    supabase = get_supabase_admin()

    # Filter out None values
    updates = {k: v for k, v in kwargs.items() if v is not None}
    if not updates:
        return await get_signal(signal_id)

    result = supabase.table("signals_v2").update(updates).eq("id", signal_id).execute()
    return result.data[0] if result.data else None


async def get_signals(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    include_dismissed: bool = False,
) -> List[dict]:
    """Get signals with optional filtering.

    Args:
        limit: Maximum number of signals to return.
        offset: Number of signals to skip.
        status: Filter by status (e.g., 'executed', 'pending_confirmation').
        user_id: Filter by user ID.
        include_dismissed: If False (default), exclude dismissed signals.
    """
    supabase = get_supabase_admin()

    query = supabase.table("signals_v2").select("*")

    if status:
        query = query.eq("status", status)
    if user_id:
        query = query.eq("user_id", user_id)

    # By default, exclude dismissed signals
    if not include_dismissed:
        query = query.eq("dismissed", False)

    query = query.order("received_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data or []


async def dismiss_signal(signal_id: int, user_id: str) -> Optional[dict]:
    """Mark a signal as dismissed.

    Args:
        signal_id: The signal ID to dismiss.
        user_id: The user ID (for authorization check).

    Returns:
        The updated signal record, or None if not found/unauthorized.
    """
    supabase = get_supabase_admin()

    # Update only if the signal belongs to the user
    result = supabase.table("signals_v2").update({
        "dismissed": True,
        "dismissed_at": datetime.utcnow().isoformat(),
    }).eq("id", signal_id).eq("user_id", user_id).execute()

    return result.data[0] if result.data else None


async def dismiss_signals_bulk(
    signal_ids: List[int] = None,
    user_id: str = None,
    completed_only: bool = False,
) -> int:
    """Dismiss multiple signals at once.

    Args:
        signal_ids: List of signal IDs to dismiss. If None and completed_only=True,
                    dismisses all completed signals for the user.
        user_id: The user ID (required for authorization).
        completed_only: If True and signal_ids is None, dismiss all completed signals.

    Returns:
        Number of signals dismissed.
    """
    if not user_id:
        raise ValueError("user_id is required")

    supabase = get_supabase_admin()
    dismissed_at = datetime.utcnow().isoformat()

    if signal_ids:
        # Dismiss specific signals
        result = supabase.table("signals_v2").update({
            "dismissed": True,
            "dismissed_at": dismissed_at,
        }).in_("id", signal_ids).eq("user_id", user_id).execute()
        return len(result.data) if result.data else 0
    elif completed_only:
        # Dismiss all completed signals for this user
        completed_statuses = ["executed", "rejected", "failed", "skipped"]
        result = supabase.table("signals_v2").update({
            "dismissed": True,
            "dismissed_at": dismissed_at,
        }).eq("user_id", user_id).eq("dismissed", False).in_("status", completed_statuses).execute()
        return len(result.data) if result.data else 0

    return 0


async def create_trade(
    signal_id: int,
    order_id: str,
    symbol: str,
    direction: str,
    lot_size: float,
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    tp_index: int,
    user_id: str = None,
) -> dict:
    """Create a new trade record in Supabase.

    Args:
        signal_id: The ID of the associated signal.
        order_id: The broker order ID.
        symbol: Trading symbol (e.g., XAUUSD).
        direction: Trade direction (BUY/SELL).
        lot_size: Position size in lots.
        entry_price: Entry price.
        stop_loss: Stop loss price.
        take_profit: Take profit price.
        tp_index: Take profit index (for split TPs).
        user_id: User UUID (REQUIRED in multi-tenant mode).

    Returns:
        The created trade record.

    Raises:
        ValueError: If user_id is not provided.
    """
    if not user_id:
        raise ValueError("user_id is required for creating trades")

    supabase = get_supabase_admin()

    data = {
        "user_id": user_id,
        "signal_id": signal_id,
        "order_id": order_id,
        "symbol": symbol,
        "direction": direction,
        "lot_size": lot_size,
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "tp_index": tp_index,
        "status": "pending",
        "created_at": datetime.utcnow().isoformat(),
    }

    result = supabase.table("trades_v2").insert(data).execute()
    return result.data[0] if result.data else None


async def get_trade(trade_id: int) -> Optional[dict]:
    """Get a trade by ID."""
    supabase = get_supabase_admin()
    result = supabase.table("trades_v2").select("*").eq("id", trade_id).execute()
    return result.data[0] if result.data else None


async def get_trade_by_order_id(order_id: str) -> Optional[dict]:
    """Get a trade by order ID."""
    supabase = get_supabase_admin()
    result = supabase.table("trades_v2").select("*").eq("order_id", order_id).execute()
    return result.data[0] if result.data else None


async def update_trade(trade_id: int, **kwargs) -> Optional[dict]:
    """Update a trade with the given fields."""
    supabase = get_supabase_admin()

    updates = {k: v for k, v in kwargs.items() if v is not None}
    if not updates:
        return await get_trade(trade_id)

    result = supabase.table("trades_v2").update(updates).eq("id", trade_id).execute()
    return result.data[0] if result.data else None


async def get_open_trades(user_id: Optional[str] = None) -> List[dict]:
    """Get all open trades."""
    supabase = get_supabase_admin()

    query = supabase.table("trades_v2").select("*").in_("status", ["pending", "open"])

    if user_id:
        query = query.eq("user_id", user_id)

    query = query.order("created_at", desc=True)
    result = query.execute()
    return result.data or []


async def get_trades(
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
) -> List[dict]:
    """Get trades with optional filtering."""
    supabase = get_supabase_admin()

    query = supabase.table("trades_v2").select("*")

    if status:
        query = query.eq("status", status)
    if user_id:
        query = query.eq("user_id", user_id)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()
    return result.data or []


async def get_stats(user_id: Optional[str] = None) -> dict:
    """Get trading statistics."""
    supabase = get_supabase_admin()
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    # Build base queries
    signals_query = supabase.table("signals_v2").select("id", count="exact")
    trades_query = supabase.table("trades_v2").select("*")

    if user_id:
        signals_query = signals_query.eq("user_id", user_id)
        trades_query = trades_query.eq("user_id", user_id)

    # Signal counts
    total_signals_result = signals_query.execute()
    total_signals = total_signals_result.count or 0

    signals_today_query = supabase.table("signals_v2").select("id", count="exact").gte("received_at", today)
    if user_id:
        signals_today_query = signals_today_query.eq("user_id", user_id)
    signals_today_result = signals_today_query.execute()
    signals_today = signals_today_result.count or 0

    # Get all trades for calculations
    all_trades_result = trades_query.execute()
    all_trades = all_trades_result.data or []

    total_trades = len(all_trades)
    open_trades = len([t for t in all_trades if t.get("status") in ["pending", "open"]])
    closed_trades = [t for t in all_trades if t.get("status") == "closed"]
    closed_count = len(closed_trades)

    winning_trades = len([t for t in closed_trades if (t.get("profit") or 0) > 0])
    losing_trades = len([t for t in closed_trades if (t.get("profit") or 0) < 0])

    win_rate = (winning_trades / closed_count * 100) if closed_count > 0 else 0

    total_profit = sum(t.get("profit") or 0 for t in closed_trades)

    # Today's profit
    today_closed = [t for t in closed_trades if t.get("closed_at") and t["closed_at"] >= today]
    today_profit = sum(t.get("profit") or 0 for t in today_closed)

    return {
        "total_signals": total_signals,
        "signals_today": signals_today,
        "total_trades": total_trades,
        "open_trades": open_trades,
        "closed_trades": closed_count,
        "winning_trades": winning_trades,
        "losing_trades": losing_trades,
        "win_rate": round(win_rate, 1),
        "total_profit": round(total_profit, 2),
        "today_profit": round(today_profit, 2),
    }


async def get_last_trade(user_id: Optional[str] = None) -> Optional[dict]:
    """Get the most recent trade."""
    supabase = get_supabase_admin()

    query = supabase.table("trades_v2").select("*").order("created_at", desc=True).limit(1)

    if user_id:
        query = query.eq("user_id", user_id)

    result = query.execute()
    return result.data[0] if result.data else None


async def get_open_trades_for_sync(user_id: Optional[str] = None) -> List[dict]:
    """Get all trades with status pending/open for sync checking.

    Returns trades that might need to be marked as closed when
    their positions no longer exist in MetaApi.
    """
    supabase = get_supabase_admin()

    query = (
        supabase.table("trades_v2")
        .select("id, order_id, symbol, status, created_at")
        .in_("status", ["pending", "open"])
    )

    if user_id:
        query = query.eq("user_id", user_id)

    result = query.execute()
    return result.data or []


async def mark_trade_closed(
    trade_id: int,
    close_price: float,
    profit: float,
    closed_at: str,
    open_price: Optional[float] = None,
) -> Optional[dict]:
    """Mark a trade as closed with final P&L data.

    Args:
        trade_id: Database trade ID.
        close_price: Price at which position was closed.
        profit: Final profit/loss amount.
        closed_at: ISO timestamp when position closed.
        open_price: Actual open price if different from entry.

    Returns:
        Updated trade record.
    """
    supabase = get_supabase_admin()

    updates = {
        "status": "closed",
        "close_price": close_price,
        "profit": profit,
        "closed_at": closed_at,
    }

    if open_price is not None:
        updates["open_price"] = open_price

    result = supabase.table("trades_v2").update(updates).eq("id", trade_id).execute()

    return result.data[0] if result.data else None
