"""Tests for the trade validator."""
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, patch, MagicMock

from src.trading.validator import TradeValidator
from src.parser.models import ParsedSignal, ValidationResult


class TestTradeValidator:
    """Test cases for TradeValidator."""

    @pytest.fixture
    def validator(self):
        """Create a validator instance."""
        mock_connection = MagicMock()
        return TradeValidator(mock_connection)

    @pytest.fixture
    def valid_buy_signal(self):
        """Create a valid BUY signal."""
        return ParsedSignal(
            direction="BUY",
            symbol="EURUSD",
            entry_price=1.0850,
            stop_loss=1.0800,
            take_profits=[1.0900, 1.0950],
            confidence=0.9,
            original_message="Test signal",
            parsed_at=datetime.utcnow(),
            warnings=[],
        )

    @pytest.fixture
    def valid_sell_signal(self):
        """Create a valid SELL signal."""
        return ParsedSignal(
            direction="SELL",
            symbol="GBPUSD",
            entry_price=1.2750,
            stop_loss=1.2800,
            take_profits=[1.2700, 1.2650],
            confidence=0.85,
            original_message="Test signal",
            parsed_at=datetime.utcnow(),
            warnings=[],
        )

    @pytest.fixture
    def account_info(self):
        """Create mock account info."""
        return {
            "balance": 10000,
            "equity": 10050,
            "margin": 100,
            "freeMargin": 9950,
            "positions": [],
        }

    @pytest.mark.asyncio
    async def test_validate_valid_buy_signal(self, validator, valid_buy_signal, account_info):
        """Test validation of a valid BUY signal."""
        validator.connection.get_symbol_price = AsyncMock(
            return_value={"bid": 1.0848, "ask": 1.0850}
        )

        with patch("src.trading.validator.settings") as mock_settings:
            mock_settings.symbol_whitelist = []
            mock_settings.max_risk_percent = 2.0
            mock_settings.default_lot_size = 0.1
            mock_settings.max_lot_size = 1.0
            mock_settings.max_open_trades = 5

            result = await validator.validate(valid_buy_signal, account_info)

        assert result.passed is True
        assert len(result.errors) == 0

    @pytest.mark.asyncio
    async def test_validate_rejects_wrong_direction_buy(self, validator, account_info):
        """Test that BUY with SL above entry is rejected."""
        bad_signal = ParsedSignal(
            direction="BUY",
            symbol="EURUSD",
            entry_price=1.0850,
            stop_loss=1.0900,  # SL above entry - wrong for BUY
            take_profits=[1.0950],
            confidence=0.9,
            original_message="Test",
            parsed_at=datetime.utcnow(),
            warnings=[],
        )

        validator.connection.get_symbol_price = AsyncMock(
            return_value={"bid": 1.0848, "ask": 1.0850}
        )

        with patch("src.trading.validator.settings") as mock_settings:
            mock_settings.symbol_whitelist = []
            mock_settings.max_risk_percent = 2.0
            mock_settings.default_lot_size = 0.1
            mock_settings.max_lot_size = 1.0
            mock_settings.max_open_trades = 5

            result = await validator.validate(bad_signal, account_info)

        assert result.passed is False
        assert any("SL must be below" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_validate_rejects_low_confidence(self, validator, account_info):
        """Test that low confidence signals are rejected."""
        low_conf_signal = ParsedSignal(
            direction="BUY",
            symbol="EURUSD",
            entry_price=1.0850,
            stop_loss=1.0800,
            take_profits=[1.0900],
            confidence=0.4,  # Too low
            original_message="Test",
            parsed_at=datetime.utcnow(),
            warnings=[],
        )

        validator.connection.get_symbol_price = AsyncMock(
            return_value={"bid": 1.0848, "ask": 1.0850}
        )

        with patch("src.trading.validator.settings") as mock_settings:
            mock_settings.symbol_whitelist = []
            mock_settings.max_risk_percent = 2.0
            mock_settings.default_lot_size = 0.1
            mock_settings.max_lot_size = 1.0
            mock_settings.max_open_trades = 5

            result = await validator.validate(low_conf_signal, account_info)

        assert result.passed is False
        assert any("confidence too low" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_validate_rejects_max_trades_exceeded(self, validator, valid_buy_signal):
        """Test that max open trades limit is enforced."""
        account_with_trades = {
            "balance": 10000,
            "equity": 10050,
            "positions": [{"id": i} for i in range(5)],  # 5 open positions
        }

        validator.connection.get_symbol_price = AsyncMock(
            return_value={"bid": 1.0848, "ask": 1.0850}
        )

        with patch("src.trading.validator.settings") as mock_settings:
            mock_settings.symbol_whitelist = []
            mock_settings.max_risk_percent = 2.0
            mock_settings.default_lot_size = 0.1
            mock_settings.max_lot_size = 1.0
            mock_settings.max_open_trades = 5

            result = await validator.validate(valid_buy_signal, account_with_trades)

        assert result.passed is False
        assert any("Max open trades" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_validate_symbol_whitelist(self, validator, valid_buy_signal, account_info):
        """Test that symbol whitelist is enforced."""
        validator.connection.get_symbol_price = AsyncMock(
            return_value={"bid": 1.0848, "ask": 1.0850}
        )

        with patch("src.trading.validator.settings") as mock_settings:
            mock_settings.symbol_whitelist = ["GBPUSD", "USDJPY"]  # EURUSD not in list
            mock_settings.max_risk_percent = 2.0
            mock_settings.default_lot_size = 0.1
            mock_settings.max_lot_size = 1.0
            mock_settings.max_open_trades = 5

            result = await validator.validate(valid_buy_signal, account_info)

        assert result.passed is False
        assert any("not in allowed list" in e for e in result.errors)

    @pytest.mark.asyncio
    async def test_validate_adjusts_lot_size_for_risk(self, validator, account_info):
        """Test that lot size is adjusted based on risk."""
        large_sl_signal = ParsedSignal(
            direction="BUY",
            symbol="EURUSD",
            entry_price=1.0850,
            stop_loss=1.0750,  # 100 pip SL
            take_profits=[1.0950],
            confidence=0.9,
            original_message="Test",
            parsed_at=datetime.utcnow(),
            warnings=[],
        )

        validator.connection.get_symbol_price = AsyncMock(
            return_value={"bid": 1.0848, "ask": 1.0850}
        )

        with patch("src.trading.validator.settings") as mock_settings:
            mock_settings.symbol_whitelist = []
            mock_settings.max_risk_percent = 1.0  # Low risk tolerance
            mock_settings.default_lot_size = 1.0  # Large default
            mock_settings.max_lot_size = 1.0
            mock_settings.max_open_trades = 5

            result = await validator.validate(large_sl_signal, account_info)

        assert result.passed is True
        assert result.adjusted_lot_size is not None
        # Lot size should be reduced due to risk limits
