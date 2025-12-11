"""LLM-based signal parser using Anthropic Claude."""
import json
import asyncio
from datetime import datetime
from typing import Optional, Union

from anthropic import AsyncAnthropic

from .models import ParsedSignal, LLMParseResult
from .prompts import SIGNAL_PARSER_PROMPT
from ..database.supabase import get_system_config
from ..utils.logger import log


class SignalParser:
    """Parse trading signals using Claude LLM."""

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        """Initialize the signal parser.

        Args:
            api_key: Anthropic API key. If None, will be read from database config.
            model: LLM model to use. If None, will be read from database config.
        """
        self._api_key = api_key
        self._model = model
        self._client: Optional[AsyncAnthropic] = None

    def _get_client(self) -> AsyncAnthropic:
        """Get or create Anthropic client, reading config from database."""
        config = get_system_config()
        api_key = self._api_key or config.get("anthropic_api_key", "")

        if not api_key:
            raise ValueError("Anthropic API key not configured. Set it in Admin > System Config.")

        # Recreate client if API key changed
        if self._client is None:
            self._client = AsyncAnthropic(api_key=api_key)

        return self._client

    def _get_model(self) -> str:
        """Get model from config."""
        if self._model:
            return self._model
        config = get_system_config()
        return config.get("llm_model", "claude-haiku-4-5-20251001")

    async def parse(self, message: str, retries: int = 3) -> Optional[Union[ParsedSignal, LLMParseResult]]:
        """Parse a message into a structured signal.

        Args:
            message: Raw message text from Telegram.
            retries: Number of retry attempts on failure.

        Returns:
            ParsedSignal if valid signal found, LLMParseResult if rejected with details, None on error.
        """
        last_error = None
        for attempt in range(retries):
            try:
                client = self._get_client()
                model = self._get_model()

                response = await client.messages.create(
                    model=model,
                    max_tokens=1024,
                    system=SIGNAL_PARSER_PROMPT,
                    messages=[{"role": "user", "content": message}],
                )

                text = response.content[0].text.strip()
                log.debug("LLM response", response_preview=text[:200])

                # Clean potential markdown code blocks
                text = self._clean_json_response(text)

                # Parse JSON response
                data = json.loads(text)
                result = LLMParseResult(**data)

                if not result.is_signal:
                    log.debug(
                        "Message is not a trade signal",
                        preview=message[:50],
                        reason=result.rejection_reason,
                        suggested=result.suggested_correction,
                    )
                    # Return the result with rejection details for the frontend
                    return result

                # Validate required fields
                missing = []
                if not result.direction:
                    missing.append("direction")
                if not result.symbol:
                    missing.append("symbol")
                if not result.entry_price:
                    missing.append("entry_price")
                if not result.stop_loss:
                    missing.append("stop_loss")
                if not result.take_profits:
                    missing.append("take_profits")

                if missing:
                    log.warning(
                        "Signal missing required fields",
                        missing=missing,
                        direction=result.direction,
                        symbol=result.symbol,
                        entry=result.entry_price,
                        sl=result.stop_loss,
                        tps=result.take_profits,
                    )
                    # Return partial result with details
                    result.is_signal = False
                    result.rejection_reason = f"Missing required fields: {', '.join(missing)}"
                    return result

                return ParsedSignal(
                    direction=result.direction,
                    symbol=result.symbol,
                    entry_price=result.entry_price,
                    stop_loss=result.stop_loss,
                    take_profits=result.take_profits,
                    confidence=result.confidence or 0.5,
                    original_message=message,
                    parsed_at=datetime.utcnow(),
                    warnings=result.warnings,
                )

            except json.JSONDecodeError as e:
                log.warning(
                    "JSON parse error",
                    attempt=attempt + 1,
                    error=str(e),
                    response=text[:200] if 'text' in locals() else "N/A",
                )
                if attempt < retries - 1:
                    await asyncio.sleep(2**attempt)
                continue

            except Exception as e:
                last_error = str(e)
                log.error(
                    "Parser error",
                    attempt=attempt + 1,
                    error=str(e),
                    error_type=type(e).__name__,
                    message_preview=message[:100],
                )
                if attempt < retries - 1:
                    await asyncio.sleep(2**attempt)
                continue

        log.error("All parse attempts failed", message_preview=message[:100], last_error=last_error)
        # Return a rejection result instead of None so frontend gets details
        return LLMParseResult(
            is_signal=False,
            rejection_reason=f"Parser failed: {last_error or 'Unknown error'}",
        )

    def _clean_json_response(self, text: str) -> str:
        """Clean potential markdown formatting from JSON response.

        Args:
            text: Raw response text.

        Returns:
            Cleaned JSON string.
        """
        text = text.strip()

        # Remove markdown code blocks
        if text.startswith("```"):
            lines = text.split("\n")
            # Remove first line (```json or ```)
            lines = lines[1:]
            # Remove last line if it's closing ```
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            text = "\n".join(lines)

        # Handle single backticks
        if text.startswith("`") and text.endswith("`"):
            text = text[1:-1]

        return text.strip()
