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
| Field | Value |
|-------|-------|
| Type | Recurring |
| Amount | 29.00 USD (or £22.99 GBP) |
| Billing period | Monthly |

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
| Field | Value |
|-------|-------|
| Type | Recurring |
| Amount | 228.00 USD (or £179.99 GBP) |
| Billing period | Yearly |

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
| Field | Value |
|-------|-------|
| Type | Recurring |
| Amount | 79.00 USD (or £62.99 GBP) |
| Billing period | Monthly |

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
| Field | Value |
|-------|-------|
| Type | Recurring |
| Amount | 636.00 USD (or £499.99 GBP) |
| Billing period | Yearly |

> This equals $53/month when billed annually

---

## Quick Reference: Feature Summary by Plan

### Free (No Stripe product needed)
- 5 signals/day
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

## Stripe Product IDs (Update after creation)

After creating products in Stripe, save the Price IDs here:

| Product | Price ID |
|---------|----------|
| Pro Monthly | `price_xxxxxxxxxxxx` |
| Pro Annual | `price_xxxxxxxxxxxx` |
| Premium Monthly | `price_xxxxxxxxxxxx` |
| Premium Annual | `price_xxxxxxxxxxxx` |

---

## Image Recommendations

Upload a product image (JPEG, PNG, or WEBP under 2MB) for each product:
- Use your logo or a branded graphic
- Recommended size: 512x512px or 1280x800px
- Keep consistent branding across all products

---

## Stripe Dashboard Checklist

- [ ] Create Pro Monthly product with recurring price
- [ ] Create Pro Annual product with recurring price
- [ ] Create Premium Monthly product with recurring price
- [ ] Create Premium Annual product with recurring price
- [ ] Upload images to all products
- [ ] Copy Price IDs back to this document
- [ ] Update environment variables with Price IDs
- [ ] Test checkout flow in test mode
