/**
 * Stripe client configuration with custom appearance theme
 * Matches the premium dark theme design of the app
 */

import { loadStripe } from "@stripe/stripe-js";

// Stripe publishable key from environment
const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!stripePublishableKey) {
  console.warn("Missing VITE_STRIPE_PUBLISHABLE_KEY environment variable");
}

// Lazy load Stripe instance
let stripePromise = null;

export function getStripe() {
  if (!stripePromise && stripePublishableKey) {
    stripePromise = loadStripe(stripePublishableKey);
  }
  return stripePromise;
}

// Price IDs for the subscription plans
export const STRIPE_PRICES = {
  pro: {
    monthly: "price_1Sdwp9AKcZSTaYXWXBjDvJQo",
    annual: "price_1Sdwp8AKcZSTaYXWgUr6CQj1",
  },
  premium: {
    monthly: "price_1Sdwr3AKcZSTaYXWjvtbcHFn",
    annual: "price_1Sdwr3AKcZSTaYXWrgQR9CDi",
  },
};

// Price display information (amounts in GBP)
export const PRICE_INFO = {
  pro: {
    monthly: { amount: 22.99, currency: "£", interval: "month" },
    annual: { amount: 179.99, currency: "£", interval: "year", perMonth: 15.00 },
  },
  premium: {
    monthly: { amount: 62.99, currency: "£", interval: "month" },
    annual: { amount: 499.99, currency: "£", interval: "year", perMonth: 41.67 },
  },
};

/**
 * Custom Stripe Appearance theme matching the app's dark premium design
 * Uses CSS variables from index.css where possible
 */
export const stripeAppearance = {
  theme: "night",
  labels: "floating",
  variables: {
    // Colors matching the app theme
    colorPrimary: "#29A19C",           // accent-teal (hsl 173 58% 39%)
    colorBackground: "#0f0f14",        // background
    colorText: "#fafafa",              // foreground
    colorTextSecondary: "#a1a1a6",     // foreground-muted
    colorTextPlaceholder: "#6b6b70",   // foreground-subtle
    colorDanger: "#ef4444",            // destructive
    colorSuccess: "#22c55e",           // success

    // Typography - matching Inter font
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
    fontSizeBase: "14px",
    fontSizeSm: "13px",
    fontSizeXs: "12px",
    fontWeightNormal: "400",
    fontWeightMedium: "500",
    fontWeightBold: "600",
    fontLineHeight: "1.5",

    // Spacing & Borders
    borderRadius: "0px",               // rounded-none design
    spacingUnit: "4px",
    spacingGridRow: "16px",
    spacingGridColumn: "16px",

    // Focus states
    focusBoxShadow: "0 0 0 2px rgba(41, 161, 156, 0.3)",
    focusOutline: "none",

    // Component sizing
    gridColumnSpacing: "16px",
    gridRowSpacing: "16px",
  },
  rules: {
    // Input fields
    ".Input": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      boxShadow: "none",
      padding: "12px 14px",
      transition: "border-color 0.2s, box-shadow 0.2s",
    },
    ".Input:hover": {
      border: "1px solid rgba(255, 255, 255, 0.12)",
    },
    ".Input:focus": {
      border: "1px solid rgba(41, 161, 156, 0.5)",
      boxShadow: "0 0 0 2px rgba(41, 161, 156, 0.15)",
    },
    ".Input--invalid": {
      border: "1px solid rgba(239, 68, 68, 0.5)",
      boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.15)",
    },

    // Labels
    ".Label": {
      color: "#a1a1a6",
      fontSize: "12px",
      fontWeight: "500",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      marginBottom: "6px",
    },

    // Tabs (payment method selector)
    ".Tab": {
      backgroundColor: "transparent",
      border: "1px solid rgba(255, 255, 255, 0.06)",
      boxShadow: "none",
      padding: "12px 16px",
      transition: "all 0.2s",
    },
    ".Tab:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      border: "1px solid rgba(255, 255, 255, 0.1)",
    },
    ".Tab--selected": {
      backgroundColor: "rgba(41, 161, 156, 0.08)",
      borderColor: "rgba(41, 161, 156, 0.4)",
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.03)",
    },
    ".Tab--selected:hover": {
      backgroundColor: "rgba(41, 161, 156, 0.12)",
    },
    ".TabIcon": {
      fill: "#a1a1a6",
    },
    ".TabIcon--selected": {
      fill: "#29A19C",
    },
    ".TabLabel": {
      color: "#a1a1a6",
      fontWeight: "500",
    },
    ".TabLabel--selected": {
      color: "#fafafa",
    },

    // Block container
    ".Block": {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      border: "1px solid rgba(255, 255, 255, 0.04)",
      boxShadow: "none",
    },

    // Error messages
    ".Error": {
      color: "#ef4444",
      fontSize: "13px",
      marginTop: "8px",
    },

    // Terms text
    ".TermsText": {
      color: "#6b6b70",
      fontSize: "12px",
    },

    // Checkbox/Radio
    ".Checkbox": {
      borderColor: "rgba(255, 255, 255, 0.15)",
    },
    ".Checkbox--checked": {
      backgroundColor: "#29A19C",
      borderColor: "#29A19C",
    },

    // Action button (like Link auth)
    ".Action": {
      color: "#29A19C",
    },
    ".Action:hover": {
      color: "#3ab5b0",
    },

    // Accordion (expandable sections)
    ".AccordionItem": {
      borderColor: "rgba(255, 255, 255, 0.06)",
    },

    // Code input (for promo codes)
    ".CodeInput": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
      border: "1px solid rgba(255, 255, 255, 0.08)",
    },

    // Menu items (dropdowns)
    ".MenuIcon": {
      fill: "#a1a1a6",
    },
    ".MenuItem": {
      color: "#fafafa",
    },
    ".MenuItem:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },

    // Picker (select dropdowns)
    ".PickerItem": {
      backgroundColor: "rgba(255, 255, 255, 0.02)",
      border: "1px solid rgba(255, 255, 255, 0.06)",
    },
    ".PickerItem--selected": {
      backgroundColor: "rgba(41, 161, 156, 0.08)",
      borderColor: "rgba(41, 161, 156, 0.4)",
    },

    // Secondary button
    ".SecondaryButton": {
      backgroundColor: "transparent",
      border: "1px solid rgba(255, 255, 255, 0.1)",
      color: "#fafafa",
    },
    ".SecondaryButton:hover": {
      backgroundColor: "rgba(255, 255, 255, 0.04)",
    },
  },
};

/**
 * Create checkout session options with appearance
 */
export function getCheckoutOptions(clientSecret) {
  return {
    clientSecret,
    appearance: stripeAppearance,
    loader: "auto",
  };
}

/**
 * API helper for Stripe endpoints
 * Uses relative URL when on same domain (Railway), falls back to env var or localhost
 */
const API_URL = import.meta.env.VITE_API_URL || "";

export async function createCheckoutSession(plan, billing, accessToken) {
  const response = await fetch(`${API_URL}/api/stripe/create-checkout-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      plan,
      billing,
      success_url: window.location.origin,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create checkout session");
  }

  return response.json();
}

export async function createPortalSession(returnUrl, accessToken) {
  const response = await fetch(`${API_URL}/api/stripe/create-portal-session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      return_url: returnUrl,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to create portal session");
  }

  return response.json();
}

export async function getSubscriptionStatus(accessToken) {
  const response = await fetch(`${API_URL}/api/stripe/subscription-status`, {
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to get subscription status");
  }

  return response.json();
}
