"""Tests for the signal parser."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import json

from src.parser.llm_parser import SignalParser
from src.parser.models import ParsedSignal
from .sample_signals import SAMPLE_SIGNALS, NON_SIGNAL_MESSAGES


class TestSignalParser:
    """Test cases for SignalParser."""

    @pytest.fixture
    def parser(self):
        """Create a parser instance."""
        with patch("src.parser.llm_parser.settings") as mock_settings:
            mock_settings.anthropic_api_key = "test-key"
            mock_settings.llm_model = "claude-haiku-4-5-20250929"
            return SignalParser()

    @pytest.mark.asyncio
    async def test_parse_valid_buy_signal(self, parser):
        """Test parsing a valid BUY signal."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                text=json.dumps({
                    "is_signal": True,
                    "direction": "BUY",
                    "symbol": "XAUUSD",
                    "entry_price": 2645.50,
                    "stop_loss": 2640.00,
                    "take_profits": [2650.0, 2655.0, 2660.0],
                    "confidence": 0.9,
                    "warnings": [],
                })
            )
        ]

        parser.client.messages.create = AsyncMock(return_value=mock_response)

        result = await parser.parse("GOLD BUY @ 2645.50 SL 2640 TP 2650/2655/2660")

        assert result is not None
        assert result.direction == "BUY"
        assert result.symbol == "XAUUSD"
        assert result.entry_price == 2645.50
        assert result.stop_loss == 2640.00
        assert len(result.take_profits) == 3

    @pytest.mark.asyncio
    async def test_parse_direction_correction(self, parser):
        """Test that mislabeled direction is corrected."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                text=json.dumps({
                    "is_signal": True,
                    "direction": "SELL",  # Corrected from BUY
                    "symbol": "EURNOK",
                    "entry_price": 11.79446,
                    "stop_loss": 11.80300,
                    "take_profits": [11.785, 11.782],
                    "confidence": 0.95,
                    "warnings": ["Direction corrected from BUY to SELL"],
                })
            )
        ]

        parser.client.messages.create = AsyncMock(return_value=mock_response)

        result = await parser.parse(SAMPLE_SIGNALS[0]["input"])

        assert result is not None
        assert result.direction == "SELL"
        assert len(result.warnings) > 0

    @pytest.mark.asyncio
    async def test_parse_non_signal(self, parser):
        """Test that non-signals return None."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(text=json.dumps({"is_signal": False}))
        ]

        parser.client.messages.create = AsyncMock(return_value=mock_response)

        result = await parser.parse("Market looking bullish today")

        assert result is None

    @pytest.mark.asyncio
    async def test_parse_handles_json_in_code_block(self, parser):
        """Test handling of JSON wrapped in markdown code blocks."""
        mock_response = MagicMock()
        mock_response.content = [
            MagicMock(
                text="""```json
{
    "is_signal": true,
    "direction": "BUY",
    "symbol": "EURUSD",
    "entry_price": 1.0850,
    "stop_loss": 1.0800,
    "take_profits": [1.0900],
    "confidence": 0.85,
    "warnings": []
}
```"""
            )
        ]

        parser.client.messages.create = AsyncMock(return_value=mock_response)

        result = await parser.parse("EURUSD BUY 1.0850")

        assert result is not None
        assert result.symbol == "EURUSD"

    @pytest.mark.asyncio
    async def test_parse_retries_on_error(self, parser):
        """Test that parser retries on failure."""
        call_count = 0

        async def mock_create(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise Exception("API Error")

            mock_response = MagicMock()
            mock_response.content = [
                MagicMock(
                    text=json.dumps({
                        "is_signal": True,
                        "direction": "BUY",
                        "symbol": "EURUSD",
                        "entry_price": 1.0850,
                        "stop_loss": 1.0800,
                        "take_profits": [1.0900],
                        "confidence": 0.85,
                        "warnings": [],
                    })
                )
            ]
            return mock_response

        parser.client.messages.create = mock_create

        result = await parser.parse("EURUSD BUY", retries=3)

        assert result is not None
        assert call_count == 3
