# Stripe Products Setup Guide

Use this document to copy/paste values when creating products in Stripe Dashboard.

> **Note:** Prices shown are in USD as per your codebase. Convert to GBP if needed (approx. rate: $1 = £0.79)

---

## Product 1: Pro Plan - Monthly

### Name (required)

```
Signal Copier Pro - Monthly
```

### Description

```
Unlimited signals, 3 MT5 accounts, 5 Telegram channels, advanced filters, basic analytics, and priority support. Billed monthly.
```

### Pricing

| Field          | Value                     |
| -------------- | ------------------------- |
| Type           | Recurring                 |
| Amount         | 29.00 USD (or £22.99 GBP) |
| Billing period | Monthly                   |

---

## Product 2: Pro Plan - Annual

### Name (required)

```
Signal Copier Pro - Annual
```

### Description

```
Unlimited signals, 3 MT5 accounts, 5 Telegram channels, advanced filters, basic analytics, and priority support. Billed annually - save 33%!
```

### Pricing

| Field          | Value                       |
| -------------- | --------------------------- |
| Type           | Recurring                   |
| Amount         | 228.00 USD (or £179.99 GBP) |
| Billing period | Yearly                      |

> This equals $19/month when billed annually

---

## Product 3: Premium Plan - Monthly

### Name (required)

```
Signal Copier Premium - Monthly
```

### Description

```
Everything in Pro plus 10 MT5 accounts, unlimited Telegram channels, 1-year signal history, full analytics suite, API access, custom webhooks, and dedicated support. Billed monthly.
```

### Pricing

| Field          | Value                     |
| -------------- | ------------------------- |
| Type           | Recurring                 |
| Amount         | 79.00 USD (or £62.99 GBP) |
| Billing period | Monthly                   |

---

## Product 4: Premium Plan - Annual

### Name (required)

```
Signal Copier Premium - Annual
```

### Description

```
Everything in Pro plus 10 MT5 accounts, unlimited Telegram channels, 1-year signal history, full analytics suite, API access, custom webhooks, and dedicated support. Billed annually - save 33%!
```

### Pricing

| Field          | Value                       |
| -------------- | --------------------------- |
| Type           | Recurring                   |
| Amount         | 636.00 USD (or £499.99 GBP) |
| Billing period | Yearly                      |

> This equals $53/month when billed annually

---

## Quick Reference: Feature Summary by Plan

### Free (No Stripe product needed)

- 2 signals/day
- 1 MT5 account
- 2 Telegram channels
- 7-day signal history
- Basic risk management
- Email support

### Pro Features

- Unlimited signals
- 3 MT5 accounts
- 5 Telegram channels
- 30-day signal history
- Advanced filters
- Basic analytics
- Priority support
- Custom lot sizing

### Premium Features

- Everything in Pro
- 10 MT5 accounts
- Unlimited Telegram channels
- 1-year signal history
- Full analytics suite
- API access
- Custom webhooks
- Dedicated support
- White-label options

---

## Stripe Product IDs (Updated)

Price IDs retrieved from Stripe account:

| Product         | Price ID                         | Amount     |
| --------------- | -------------------------------- | ---------- |
| Pro Monthly     | `price_1Sdwp9AKcZSTaYXWXBjDvJQo` | £22.99/mo  |
| Pro Annual      | `price_1Sdwp8AKcZSTaYXWgUr6CQj1` | £179.99/yr |
| Premium Monthly | `price_1Sdwr3AKcZSTaYXWjvtbcHFn` | £62.99/mo  |
| Premium Annual  | `price_1Sdwr3AKcZSTaYXWrgQR9CDi` | £499.99/yr |

---

## Image Recommendations

Upload a product image (JPEG, PNG, or WEBP under 2MB) for each product:

- Use your logo or a branded graphic
- Recommended size: 512x512px or 1280x800px
- Keep consistent branding across all products

---

## Stripe Dashboard Checklist

- [x] Create Pro Monthly product with recurring price
- [x] Create Pro Annual product with recurring price
- [x] Create Premium Monthly product with recurring price
- [x] Create Premium Annual product with recurring price
- [ ] Upload images to all products
- [x] Copy Price IDs back to this document
- [x] Update environment variables with Price IDs
- [ ] Test checkout flow in test mode

---

## Deployment Environment Variables

### Railway (Backend)

Add these environment variables to your Railway service:

```
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for testing)
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe webhook endpoint)
STRIPE_PRICE_PRO_MONTHLY=price_1Sdwp9AKcZSTaYXWXBjDvJQo
STRIPE_PRICE_PRO_ANNUAL=price_1Sdwp8AKcZSTaYXWgUr6CQj1
STRIPE_PRICE_PREMIUM_MONTHLY=price_1Sdwr3AKcZSTaYXWjvtbcHFn
STRIPE_PRICE_PREMIUM_ANNUAL=price_1Sdwr3AKcZSTaYXWrgQR9CDi
```

### Supabase Edge Functions

Add these secrets via Supabase CLI or Dashboard:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_live_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### Frontend (Vercel/Netlify/Railway Static)

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_... (or pk_test_... for testing)
VITE_API_URL=https://your-api-domain.railway.app
```

---

## Webhook Setup

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://your-project-ref.supabase.co/functions/v1/stripe-webhook`
3. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`
