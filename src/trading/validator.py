"""Trade validation before execution."""
from typing import Optional, Dict, Any, List

from ..parser.models import ParsedSignal, ValidationResult
from ..config import settings
from ..utils.logger import log


class TradeValidator:
    """Validate signals before execution."""

    def __init__(self, metaapi_connection=None):
        """Initialize validator.

        Args:
            metaapi_connection: MetaApi RPC connection for price checks.
        """
        self.connection = metaapi_connection

    async def validate(
        self,
        signal: ParsedSignal,
        account_info: Dict[str, Any],
    ) -> ValidationResult:
        """Validate a signal for execution.

        Args:
            signal: Parsed signal to validate.
            account_info: Current account information.

        Returns:
            ValidationResult with pass/fail status and any errors/warnings.
        """
        errors: List[str] = []
        warnings: List[str] = []
        adjusted_lot_size = settings.default_lot_size

        # 1. Symbol whitelist check
        if settings.symbol_whitelist and signal.symbol not in settings.symbol_whitelist:
            errors.append(f"Symbol {signal.symbol} not in allowed list")

        # 2. Get current price and validate entry
        broker_symbol = signal.symbol + settings.symbol_suffix
        if self.connection:
            try:
                price = await self.connection.get_symbol_price(broker_symbol)
                current_price = (
                    price["bid"] if signal.direction == "SELL" else price["ask"]
                )

                # Check if entry is within 1% of current price
                price_diff_percent = (
                    abs(signal.entry_price - current_price) / current_price * 100
                )
                if price_diff_percent > 1:
                    warnings.append(
                        f"Entry price {signal.entry_price} is {price_diff_percent:.2f}% "
                        f"from current {current_price}"
                    )
            except Exception as e:
                # Price fetch failure is a warning, not an error - allow trade to proceed
                warnings.append(f"Could not fetch price for {broker_symbol}: {str(e)}")

        # 3. Stop loss distance check
        sl_distance_percent = (
            abs(signal.entry_price - signal.stop_loss) / signal.entry_price * 100
        )
        if sl_distance_percent > 5:
            warnings.append(
                f"Stop loss is {sl_distance_percent:.2f}% from entry - large risk"
            )

        # 4. Risk calculation and lot size adjustment
        balance = account_info.get("balance", 0)
        if balance > 0:
            pip_value = self._get_pip_value(signal.symbol)
            sl_pips = abs(signal.entry_price - signal.stop_loss) / pip_value

            max_risk_amount = balance * (settings.max_risk_percent / 100)
            # Approximate pip value per lot (varies by pair and account currency)
            pip_value_per_lot = self._estimate_pip_value_per_lot(signal.symbol)
            risk_per_lot = sl_pips * pip_value_per_lot

            if risk_per_lot > 0:
                calculated_lot = max_risk_amount / risk_per_lot
                if calculated_lot < settings.default_lot_size:
                    adjusted_lot_size = max(0.01, round(calculated_lot, 2))
                    warnings.append(
                        f"Lot size adjusted from {settings.default_lot_size} to "
                        f"{adjusted_lot_size} for risk management"
                    )
                elif settings.default_lot_size * risk_per_lot > max_risk_amount:
                    adjusted_lot_size = max(0.01, round(calculated_lot, 2))
                    warnings.append(
                        f"Lot size adjusted to {adjusted_lot_size} for risk management"
                    )

        # Ensure lot size is within bounds
        adjusted_lot_size = max(0.01, min(adjusted_lot_size, settings.max_lot_size))

        # 5. Position limit check
        open_positions = account_info.get("positions", [])
        if len(open_positions) >= settings.max_open_trades:
            errors.append(
                f"Max open trades ({settings.max_open_trades}) reached - "
                f"currently have {len(open_positions)}"
            )

        # 6. Duplicate position check
        for pos in open_positions:
            pos_symbol = pos.get("symbol", "")
            pos_type = pos.get("type", "").upper()
            if pos_symbol == signal.symbol:
                if pos_type == signal.direction:
                    warnings.append(
                        f"Already have {signal.direction} position on {signal.symbol}"
                    )
                else:
                    warnings.append(
                        f"Have opposite {pos_type} position on {signal.symbol}"
                    )

        # 7. Confidence check
        if signal.confidence < 0.6:
            errors.append(f"Signal confidence too low: {signal.confidence:.2f}")

        # 8. TP/SL sanity check
        if signal.direction == "BUY":
            if signal.stop_loss >= signal.entry_price:
                errors.append("BUY signal: SL must be below entry price")
            if any(tp <= signal.entry_price for tp in signal.take_profits):
                errors.append("BUY signal: All TPs must be above entry price")
        else:  # SELL
            if signal.stop_loss <= signal.entry_price:
                errors.append("SELL signal: SL must be above entry price")
            if any(tp >= signal.entry_price for tp in signal.take_profits):
                errors.append("SELL signal: All TPs must be below entry price")

        passed = len(errors) == 0

        return ValidationResult(
            passed=passed,
            errors=errors,
            warnings=warnings,
            adjusted_lot_size=adjusted_lot_size if passed else None,
        )

    def _get_pip_value(self, symbol: str) -> float:
        """Get pip size for a symbol.

        Args:
            symbol: Trading symbol.

        Returns:
            Pip size (e.g., 0.0001 for EURUSD, 0.01 for USDJPY).
        """
        symbol = symbol.upper()
        if "JPY" in symbol:
            return 0.01
        elif symbol in ["XAUUSD", "GOLD"]:
            return 0.1
        elif symbol in ["DJ30", "US30", "USTEC", "NAS100"]:
            return 1.0
        else:
            return 0.0001

    def _estimate_pip_value_per_lot(self, symbol: str) -> float:
        """Estimate pip value per standard lot in USD.

        Args:
            symbol: Trading symbol.

        Returns:
            Approximate pip value per lot.
        """
        symbol = symbol.upper()
        if "JPY" in symbol:
            return 7.5  # Approximate for JPY pairs
        elif symbol in ["XAUUSD", "GOLD"]:
            return 1.0  # $1 per 0.1 move per 0.01 lot
        elif symbol in ["DJ30", "US30"]:
            return 1.0  # Index
        elif symbol in ["USTEC", "NAS100"]:
            return 1.0  # Index
        else:
            return 10.0  # Standard forex pairs ~$10 per pip per lot
