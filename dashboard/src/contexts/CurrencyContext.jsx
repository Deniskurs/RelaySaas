import { createContext, useContext, useState, useEffect } from "react";
import { CURRENCIES, formatCurrency, formatPnL } from "@/lib/currency";

const CurrencyContext = createContext();

const STORAGE_KEY = "dashboard-currency";
const DEFAULT_CURRENCY = "GBP";

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_CURRENCY;
    }
    return DEFAULT_CURRENCY;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, currency);
  }, [currency]);

  const value = {
    currency,
    setCurrency,
    currencyData: CURRENCIES[currency] || CURRENCIES[DEFAULT_CURRENCY],
    currencies: CURRENCIES,
    format: (val) => formatCurrency(val, currency),
    formatPnL: (val) => formatPnL(val, currency),
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
};
