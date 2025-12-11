"""SQLAlchemy database models."""
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, ForeignKey, Boolean
from sqlalchemy.orm import relationship, DeclarativeBase, Mapped, mapped_column
from datetime import datetime
from typing import List, Optional


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


class Signal(Base):
    """Trading signal received from Telegram."""

    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(primary_key=True)
    raw_message: Mapped[str] = mapped_column(String)
    channel_name: Mapped[str] = mapped_column(String)
    channel_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    message_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Parsed data
    direction: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # BUY or SELL
    symbol: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    entry_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stop_loss: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    take_profits: Mapped[dict] = mapped_column(JSON, default=list)

    # Metadata
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    warnings: Mapped[dict] = mapped_column(JSON, default=list)

    # Status tracking
    status: Mapped[str] = mapped_column(
        String, default="received"
    )  # received, parsed, validated, executed, failed, skipped
    failure_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    # Timestamps
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    parsed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    trades: Mapped[List["Trade"]] = relationship(
        back_populates="signal", cascade="all, delete-orphan"
    )

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "raw_message": self.raw_message,
            "channel_name": self.channel_name,
            "channel_id": self.channel_id,
            "direction": self.direction,
            "symbol": self.symbol,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "take_profits": self.take_profits,
            "confidence": self.confidence,
            "warnings": self.warnings,
            "status": self.status,
            "failure_reason": self.failure_reason,
            "received_at": self.received_at.isoformat() if self.received_at else None,
            "parsed_at": self.parsed_at.isoformat() if self.parsed_at else None,
            "executed_at": self.executed_at.isoformat() if self.executed_at else None,
        }


class Trade(Base):
    """Individual trade order executed from a signal."""

    __tablename__ = "trades"

    id: Mapped[int] = mapped_column(primary_key=True)
    signal_id: Mapped[int] = mapped_column(ForeignKey("signals.id"))

    # Order details
    order_id: Mapped[str] = mapped_column(String)
    position_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    symbol: Mapped[str] = mapped_column(String)
    direction: Mapped[str] = mapped_column(String)  # BUY or SELL
    lot_size: Mapped[float] = mapped_column(Float)

    # Price levels
    entry_price: Mapped[float] = mapped_column(Float)
    stop_loss: Mapped[float] = mapped_column(Float)
    take_profit: Mapped[float] = mapped_column(Float)
    tp_index: Mapped[int] = mapped_column(Integer)  # TP1, TP2, etc.

    # Execution details
    status: Mapped[str] = mapped_column(
        String, default="pending"
    )  # pending, open, closed, cancelled
    open_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    close_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    profit: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    pips: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Timestamps
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationship
    signal: Mapped["Signal"] = relationship(back_populates="trades")

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "signal_id": self.signal_id,
            "order_id": self.order_id,
            "position_id": self.position_id,
            "symbol": self.symbol,
            "direction": self.direction,
            "lot_size": self.lot_size,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "take_profit": self.take_profit,
            "tp_index": self.tp_index,
            "status": self.status,
            "open_price": self.open_price,
            "close_price": self.close_price,
            "profit": self.profit,
            "pips": self.pips,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
        }


class AccountSnapshot(Base):
    """Periodic snapshot of account status."""

    __tablename__ = "account_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True)
    balance: Mapped[float] = mapped_column(Float)
    equity: Mapped[float] = mapped_column(Float)
    margin: Mapped[float] = mapped_column(Float)
    free_margin: Mapped[float] = mapped_column(Float)
    open_positions: Mapped[int] = mapped_column(Integer)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "balance": self.balance,
            "equity": self.equity,
            "margin": self.margin,
            "free_margin": self.free_margin,
            "open_positions": self.open_positions,
            "recorded_at": self.recorded_at.isoformat() if self.recorded_at else None,
        }


class AppState(Base):
    """Key-value store for application state."""

    __tablename__ = "app_state"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String, unique=True)
    value: Mapped[str] = mapped_column(String)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
