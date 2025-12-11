"""Trade validation before execution."""
from typing import Optional, Dict, Any, List

from ..parser.models import ParsedSignal, ValidationResult
from ..config import settings as static_settings  # Keep for non-overridable settings
from ..database.supabase import get_settings, SYSTEM_USER_ID
from ..utils.logger import log


def get_reference_lot_for_symbol(symbol: str, db_settings: dict = None) -> float:
    """Get the reference lot size for a given symbol.

    GOLD/XAUUSD uses higher base lot (0.04 on £500), others use lower (0.01 on £500).

    Args:
        symbol: Trading symbol.
        db_settings: Optional settings dict from database.

    Returns:
        Reference lot size for the symbol.
    """
    symbol_upper = symbol.upper()
    if db_settings:
        gold_ref = db_settings.get("lot_reference_size_gold", 0.04)
        default_ref = db_settings.get("lot_reference_size_default", 0.01)
    else:
        gold_ref = static_settings.lot_reference_size
        default_ref = static_settings.lot_reference_size_default
    
    if symbol_upper in ["XAUUSD", "GOLD"]:
        return gold_ref
    return default_ref


def calculate_dynamic_lot_size(
    account_balance: float,
    reference_balance: float = 500.0,
    reference_lot: float = 0.04,
    min_lot: float = 0.01,
    max_lot: float = 0.1,
) -> float:
    """Calculate lot size scaled to account balance.

    Formula: lot_size = (account_balance / reference_balance) * reference_lot

    Args:
        account_balance: Current account balance.
        reference_balance: Reference balance for scaling (default 500).
        reference_lot: Lot size at reference balance (default 0.04).
        min_lot: Minimum allowed lot size.
        max_lot: Maximum allowed lot size.

    Returns:
        Calculated lot size, bounded by min/max.
    """
    if account_balance <= 0:
        return min_lot

    calculated = (account_balance / reference_balance) * reference_lot
    return max(min_lot, min(round(calculated, 2), max_lot))


def calculate_lot_for_symbol(
    symbol: str,
    account_balance: float,
    min_lot: float = 0.01,
    max_lot: float = 0.1,
    db_settings: dict = None,
) -> float:
    """Calculate lot size for a specific symbol based on account balance.

    Uses symbol-specific reference lot (GOLD=0.04, others=0.01 on £500 reference).

    Args:
        symbol: Trading symbol.
        account_balance: Current account balance.
        min_lot: Minimum allowed lot size.
        max_lot: Maximum allowed lot size.
        db_settings: Optional settings dict from database.

    Returns:
        Calculated lot size for the symbol.
    """
    reference_lot = get_reference_lot_for_symbol(symbol, db_settings)
    ref_balance = db_settings.get("lot_reference_balance", 500.0) if db_settings else static_settings.lot_reference_balance
    return calculate_dynamic_lot_size(
        account_balance=account_balance,
        reference_balance=ref_balance,
        reference_lot=reference_lot,
        min_lot=min_lot,
        max_lot=max_lot,
    )


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

        # Fetch current settings from database (dynamic, not static config)
        db_settings = get_settings(SYSTEM_USER_ID)
        max_lot_size = db_settings.get("max_lot_size", 0.1)
        max_open_trades = db_settings.get("max_open_trades", 5)
        max_risk_percent = db_settings.get("max_risk_percent", 2.0)
        symbol_suffix = db_settings.get("symbol_suffix", "")

        # Calculate dynamic base lot size from account balance (symbol-specific)
        balance = account_info.get("balance", 0)
        base_lot_size = calculate_lot_for_symbol(
            symbol=signal.symbol,
            account_balance=balance,
            min_lot=0.01,
            max_lot=max_lot_size,
            db_settings=db_settings,
        )
        adjusted_lot_size = base_lot_size

        # 1. Symbol whitelist check (still use static config for this)
        if static_settings.symbol_whitelist and signal.symbol not in static_settings.symbol_whitelist:
            errors.append(f"Symbol {signal.symbol} not in allowed list")

        # 2. Get current price and validate entry
        broker_symbol = signal.symbol + symbol_suffix
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

        # 4. Risk calculation and lot size adjustment (may reduce from dynamic base)
        if balance > 0:
            pip_value = self._get_pip_value(signal.symbol)
            sl_pips = abs(signal.entry_price - signal.stop_loss) / pip_value

            max_risk_amount = balance * (max_risk_percent / 100)
            # Approximate pip value per lot (varies by pair and account currency)
            pip_value_per_lot = self._estimate_pip_value_per_lot(signal.symbol)
            risk_per_lot = sl_pips * pip_value_per_lot

            if risk_per_lot > 0:
                calculated_lot = max_risk_amount / risk_per_lot
                if calculated_lot < base_lot_size:
                    adjusted_lot_size = max(0.01, round(calculated_lot, 2))
                    warnings.append(
                        f"Lot size adjusted from {base_lot_size} to "
                        f"{adjusted_lot_size} for risk management"
                    )
                elif base_lot_size * risk_per_lot > max_risk_amount:
                    adjusted_lot_size = max(0.01, round(calculated_lot, 2))
                    warnings.append(
                        f"Lot size adjusted to {adjusted_lot_size} for risk management"
                    )

        # Ensure lot size is within bounds
        adjusted_lot_size = max(0.01, min(adjusted_lot_size, max_lot_size))

        # 5. Position limit check
        open_positions = account_info.get("positions", [])
        if len(open_positions) >= max_open_trades:
            errors.append(
                f"Max open trades ({max_open_trades}) reached - "
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
