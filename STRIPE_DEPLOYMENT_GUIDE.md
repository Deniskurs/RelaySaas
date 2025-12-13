# Stripe Deployment Guide - Step by Step

Follow these steps in order. Each section has copy-paste ready values.

---

## Step 1: Add Variables to Railway (Backend)

Go to your Railway project > Variables > Raw Editor, and paste this entire block:

```
STRIPE_SECRET_KEY=sk_test_51Sdg4sAKcZSTaYXW1gOcrb2agK9jVtqzVF5x4LTBq93zepue08NU9i5lovJ9oAiQER4Nx47hTdYAvrGiQtqPNjHb00r3X9wflj
STRIPE_PUBLISHABLE_KEY=pk_test_51Sdg4sAKcZSTaYXWzwKHY3h92S7A3ggX0CW0YqFTjvUEJDZIlcaVTdwqRkB1q7xJPevhBsaWF4qMXJWvrS0cHNRH00RxbdKOxU
STRIPE_PRICE_PRO_MONTHLY=price_1Sdwp9AKcZSTaYXWXBjDvJQo
STRIPE_PRICE_PRO_ANNUAL=price_1Sdwp8AKcZSTaYXWgUr6CQj1
STRIPE_PRICE_PREMIUM_MONTHLY=price_1Sdwr3AKcZSTaYXWjvtbcHFn
STRIPE_PRICE_PREMIUM_ANNUAL=price_1Sdwr3AKcZSTaYXWrgQR9CDi
```

**Note:** You'll add `STRIPE_WEBHOOK_SECRET` after Step 2.

---

## Step 2: Create Stripe Webhook (Get the Secret)

### 2a. Go to Stripe Dashboard
1. Open https://dashboard.stripe.com
2. Click **Developers** in the left sidebar
3. Click **Webhooks**

### 2b. Add Webhook Endpoint
1. Click **+ Add endpoint**
2. For **Endpoint URL**, enter:
   ```
   https://jvgeyxoiekgvfwiixvql.supabase.co/functions/v1/stripe-webhook
   ```
3. Click **Select events**
4. Search and check these events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click **Add endpoint**

### 2c. Copy the Webhook Signing Secret
1. After creating, you'll see the endpoint page
2. Click **Reveal** under "Signing secret"
3. Copy the value (starts with `whsec_`)

---

## Step 3: Add Webhook Secret to Railway

Go back to Railway > Variables > Raw Editor and add this line (replace with your actual secret):

```
STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_SECRET_HERE
```

---

## Step 4: Add Secrets to Supabase Edge Functions

### Option A: Using Supabase CLI (Recommended)

Open terminal in your project folder and run:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_51Sdg4sAKcZSTaYXW1gOcrb2agK9jVtqzVF5x4LTBq93zepue08NU9i5lovJ9oAiQER4Nx47hTdYAvrGiQtqPNjHb00r3X9wflj

supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_YOUR_ACTUAL_SECRET_HERE
```

### Option B: Using Supabase Dashboard

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in the sidebar
4. Click **Manage Secrets**
5. Add these two secrets:

| Name | Value |
|------|-------|
| `STRIPE_SECRET_KEY` | `sk_test_51Sdg4sAKcZSTaYXW1gOcrb2agK9jVtqzVF5x4LTBq93zepue08NU9i5lovJ9oAiQER4Nx47hTdYAvrGiQtqPNjHb00r3X9wflj` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_YOUR_ACTUAL_SECRET_HERE` |

---

## Step 5: Deploy the Webhook Edge Function

In your terminal, run:

```bash
supabase functions deploy stripe-webhook
```

---

## Step 6: Add Frontend Variables

If your frontend is deployed separately (Vercel/Netlify), add these environment variables:

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51Sdg4sAKcZSTaYXWzwKHY3h92S7A3ggX0CW0YqFTjvUEJDZIlcaVTdwqRkB1q7xJPevhBsaWF4qMXJWvrS0cHNRH00RxbdKOxU
VITE_API_URL=https://your-railway-backend-url.railway.app
```

---

## Step 7: Test the Integration

### Test Card Numbers (Stripe Test Mode)
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 0002`
- **Requires Auth**: `4000 0025 0000 3155`

Use any future expiry date (e.g., 12/34) and any 3-digit CVC.

### Test Checkout Flow
1. Go to your app's pricing page
2. Click "Upgrade to Pro"
3. Enter test card `4242 4242 4242 4242`
4. Complete checkout
5. Verify subscription is active in your profile

### Verify Webhook is Working
1. Go to Stripe Dashboard > Developers > Webhooks
2. Click on your endpoint
3. Check the "Webhook attempts" section for successful deliveries

---

## Quick Reference: All Environment Variables

### Railway Backend (Full List)
```
STRIPE_SECRET_KEY=sk_test_51Sdg4sAKcZSTaYXW1gOcrb2agK9jVtqzVF5x4LTBq93zepue08NU9i5lovJ9oAiQER4Nx47hTdYAvrGiQtqPNjHb00r3X9wflj
STRIPE_PUBLISHABLE_KEY=pk_test_51Sdg4sAKcZSTaYXWzwKHY3h92S7A3ggX0CW0YqFTjvUEJDZIlcaVTdwqRkB1q7xJPevhBsaWF4qMXJWvrS0cHNRH00RxbdKOxU
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET
STRIPE_PRICE_PRO_MONTHLY=price_1Sdwp9AKcZSTaYXWXBjDvJQo
STRIPE_PRICE_PRO_ANNUAL=price_1Sdwp8AKcZSTaYXWgUr6CQj1
STRIPE_PRICE_PREMIUM_MONTHLY=price_1Sdwr3AKcZSTaYXWjvtbcHFn
STRIPE_PRICE_PREMIUM_ANNUAL=price_1Sdwr3AKcZSTaYXWrgQR9CDi
```

### Supabase Edge Function Secrets
```
STRIPE_SECRET_KEY=sk_test_51Sdg4sAKcZSTaYXW1gOcrb2agK9jVtqzVF5x4LTBq93zepue08NU9i5lovJ9oAiQER4Nx47hTdYAvrGiQtqPNjHb00r3X9wflj
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_YOUR_WEBHOOK_SECRET
```

### Frontend (Vercel/Netlify)
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51Sdg4sAKcZSTaYXWzwKHY3h92S7A3ggX0CW0YqFTjvUEJDZIlcaVTdwqRkB1q7xJPevhBsaWF4qMXJWvrS0cHNRH00RxbdKOxU
VITE_API_URL=https://your-railway-backend-url.railway.app
```

---

## Troubleshooting

### "Webhook signature verification failed"
- Make sure `STRIPE_WEBHOOK_SECRET` in Supabase matches the one from Stripe Dashboard
- The secret must start with `whsec_`

### "No such price" error
- Verify the price IDs in Railway match your Stripe products
- Check you're using test mode keys with test mode prices

### Checkout not loading
- Check browser console for errors
- Verify `VITE_STRIPE_PUBLISHABLE_KEY` is set in frontend
- Verify `VITE_API_URL` points to your Railway backend

---

## Going Live Checklist

When ready for production:

1. [ ] Create new webhook endpoint with production URL
2. [ ] Get live keys from Stripe Dashboard (start with `sk_live_` and `pk_live_`)
3. [ ] Update all environment variables with live keys
4. [ ] Test with real card (small amount, then refund)
5. [ ] Enable Stripe Radar for fraud protection
