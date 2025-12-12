/**
 * Currency configuration and formatting utilities.
 */

export const CURRENCIES = {
  USD: { code: "USD", symbol: "$", name: "US Dollar", locale: "en-US" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound", locale: "en-GB" },
  EUR: { code: "EUR", symbol: "€", name: "Euro", locale: "de-DE" },
  HKD: { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", locale: "zh-HK" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen", locale: "ja-JP" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar", locale: "en-AU" },
  CAD: { code: "CAD", symbol: "C$", name: "Canadian Dollar", locale: "en-CA" },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc", locale: "de-CH" },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar", locale: "en-SG" },
};

/**
 * Format a value as currency.
 * @param {number} value - The value to format
 * @param {string} currencyCode - Currency code (USD, GBP, etc.)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (value, currencyCode = "USD") => {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.USD;
  return new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 2,
  }).format(value);
};

/**
 * Format a P&L value with +/- prefix.
 * @param {number} value - The profit/loss value
 * @param {string} currencyCode - Currency code (USD, GBP, etc.)
 * @returns {string} Formatted P&L string with sign
 */
export const formatPnL = (value, currencyCode = "USD") => {
  const currency = CURRENCIES[currencyCode] || CURRENCIES.USD;
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat(currency.locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 2,
  }).format(absValue);

  if (value >= 0) {
    return `+${formatted}`;
  } else {
    return `-${formatted}`;
  }
};
