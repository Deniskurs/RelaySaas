# Multi-Tenant SaaS Setup Guide

## Current Progress

### Completed

- [x] Phase 1: Authentication & Database Schema
- [x] Phase 2: Multi-Tenant Backend (partial)
  - Auth middleware
  - User connection manager
  - Onboarding API
  - Admin API
  - Frontend auth pages
  - Admin dashboard

### Remaining

- [x] Phase 3: Per-user Telegram/MetaApi connections (DONE)
- [ ] Phase 4: Full admin features
- [ ] Phase 5: Stripe billing integration

---

## Step 1: Run SQL Migration

The migration file is located at:

```
/supabase/migrations/001_multi_tenant_schema.sql
```

### How to run:

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project: `jvgeyxoiekgvfwiixvql`
3. Click **SQL Editor** in the left sidebar
4. Click **New Query**
5. Copy the entire contents of `001_multi_tenant_schema.sql`
6. Paste into the SQL editor
7. Click **Run** (or press Cmd+Enter)

This creates:

- `profiles` table (extends auth.users)
- `user_credentials` table (Telegram/MT credentials)
- `user_settings_v2` table (per-user trading settings)
- `signals_v2` table (per-user signals)
- `trades_v2` table (per-user trades)
- `activity_logs` table (admin monitoring)
- Row Level Security policies
- Auto-creation triggers

---

## Step 2: Enable Supabase Auth Providers

### Email/Password (Already enabled by default)

1. Go to **Authentication** > **Providers** in Supabase Dashboard
2. Email should already be enabled
3. Optional settings:
   - **Confirm email**: Toggle ON if you want email verification
   - **Secure email change**: Toggle ON for security

### Google OAuth

1. Go to **Authentication** > **Providers**
2. Find **Google** and click to expand
3. Toggle **Enable Google provider** ON
4. You need Google OAuth credentials:

#### Getting Google OAuth Credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. **Enable the Google+ API** (required):
   - Go to **APIs & Services** > **Library**
   - Search for "Google+ API" or "Google Identity"
   - Click **Enable**
4. **Configure OAuth Consent Screen** (required first time):
   - Go to **APIs & Services** > **OAuth consent screen**
   - Choose **External** (unless you have Google Workspace)
   - Fill in App name, User support email, Developer email
   - Click **Save and Continue** through all steps
   - Add test users if in testing mode
5. **Create OAuth Credentials**:
   - Go to **APIs & Services** > **Credentials**
   - Click **Create Credentials** > **OAuth client ID**
   - Select **Web application**
   - Name it (e.g., "Signal Copier")
6. **Add Authorized Redirect URIs** (IMPORTANT - must be exact):
   ```
   https://jvgeyxoiekgvfwiixvql.supabase.co/auth/v1/callback
   ```
   Also add for local development:
   ```
   http://localhost:5173/auth/callback
   ```
7. Click **Create**
8. Copy the **Client ID** and **Client Secret**
9. In Supabase Dashboard:
   - Go to **Authentication** > **Providers** > **Google**
   - Toggle **Enable Google provider** ON
   - Paste Client ID and Client Secret
   - Click **Save**

**Common Error: `redirect_uri_mismatch`**

- This means the redirect URI in Google Console doesn't exactly match
- Make sure you use: `https://jvgeyxoiekgvfwiixvql.supabase.co/auth/v1/callback`
- No trailing slash, exact spelling

### Apple OAuth

1. Go to **Authentication** > **Providers**
2. Find **Apple** and click to expand
3. Toggle **Enable Apple provider** ON

#### Getting Apple OAuth Credentials:

1. Go to [Apple Developer Console](https://developer.apple.com/)
2. You need an Apple Developer account ($99/year)
3. Go to **Certificates, Identifiers & Profiles**
4. Create a new **App ID** with Sign in with Apple capability
5. Create a **Services ID** for web authentication
6. Configure the Services ID:
   - Add your domain: `jvgeyxoiekgvfwiixvql.supabase.co`
   - Add return URL: `https://jvgeyxoiekgvfwiixvql.supabase.co/auth/v1/callback`
7. Create a **Key** with Sign in with Apple enabled
8. Download the key file (.p8)
9. In Supabase, enter:
   - **Service ID**: Your Services ID
   - **Team ID**: From Apple Developer account
   - **Key ID**: From the key you created
   - **Private Key**: Contents of the .p8 file
10. Click **Save**

### Configure Redirect URLs

1. Go to **Authentication** > **URL Configuration**
2. Set **Site URL**: `http://localhost:5173` (for dev) or your production URL
3. Add **Redirect URLs**:
   ```
   http://localhost:5173/auth/callback
   https://yourdomain.com/auth/callback
   ```

---

## Step 3: Install Backend Dependencies

```bash
cd /Users/denis/Documents/signalcopier
pip install PyJWT
# or
pip install -r requirements.txt
```

---

## Step 4: Set Yourself as Admin

After you sign up for the first time, run this SQL in Supabase:

```sql
UPDATE profiles
SET role = 'admin', status = 'active'
WHERE email = 'your@email.com';
```

**Important:** You must set BOTH `role = 'admin'` AND `status = 'active'` to avoid being stuck in the onboarding flow.

Or via SQL Editor:

1. Go to **SQL Editor**
2. Run the above query with your email
3. Refresh the dashboard (hard refresh with Cmd+Shift+R)
4. You'll now see the Admin link in the sidebar

---

## Step 5: Environment Variables

### Backend (.env in root)

Already configured, but ensure these are set:

```env
SUPABASE_URL=https://jvgeyxoiekgvfwiixvql.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # anon key

# REQUIRED for admin features and auth:
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # service_role key
SUPABASE_JWT_SECRET=+wOF1M6KyEMRR2s98hcF/HEK3bTm/zMDtfFs9fFuDL+osZn342sxF9E+LgePkmnAAQF+9dt1ER241+PaCXze3Q==
```

To get these keys:

1. Go to **Project Settings** > **API** in Supabase Dashboard
2. **anon key** (SUPABASE_KEY): Under "Project API keys" - public, safe for client
3. **service_role key** (SUPABASE_SERVICE_KEY): Under "Project API keys" - SECRET, bypasses RLS
4. **JWT Secret** (SUPABASE_JWT_SECRET): Under "JWT Settings"

**IMPORTANT:** The `SUPABASE_SERVICE_KEY` is required for the backend to:
- Fetch user profiles during authentication
- Access all data in admin endpoints
- Bypass Row Level Security policies

Never expose the service_role key to the frontend!

### Frontend (dashboard/.env)

Already configured:

```env
VITE_SUPABASE_URL=https://jvgeyxoiekgvfwiixvql.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Phase 3: Per-User Connections (COMPLETED)

### What was implemented:

1. **Telegram Listener Refactor** (`src/telegram/listener.py`)

   - Now accepts user-specific credentials via constructor
   - Supports both single-user (legacy) and multi-user modes
   - Per-user session strings using Telethon StringSession
   - User context included in all message callbacks

2. **MetaApi Executor Refactor** (`src/trading/executor.py`)

   - Now accepts per-user account ID and settings
   - New `ExecutorSettings` dataclass for per-user trading config
   - Uses owner's MetaApi token but routes to user's account
   - User ID included in trade comments for tracking

3. **Signal Router** (`src/signal_router.py` - NEW)

   - Routes signals to correct user's executor
   - Handles OPEN, CLOSE, and LOT_MODIFIER signals per-user
   - Stores signals/trades with user_id in database

4. **User Connection Manager** (`src/users/manager.py`)
   - Manages multiple concurrent user connections
   - Starts/stops Telegram listeners and MetaApi executors per user
   - Message handler callback system for routing

5. **Main Application** (`src/main.py`)
   - Supports two modes via `MULTI_TENANT_MODE` environment variable
   - Single-user mode: Uses env vars for credentials (backward compatible)
   - Multi-tenant mode: Loads users from Supabase, connects each

### Running Multi-Tenant Mode

Add to your `.env`:

```env
MULTI_TENANT_MODE=true
```

Then start the backend:

```bash
python -m src.main
```

The system will:
1. Load all active users from Supabase
2. Connect each user's Telegram listener
3. Connect each user's MetaApi executor
4. Route signals to the correct user

---

## Phase 4: Enhanced Admin (TODO)

- User detail page with full history
- Impersonation (view as user)
- Manual user actions (reset connections, etc.)
- System health monitoring
- Error rate tracking

---

## Phase 5: Stripe Billing (TODO)

### Setup Steps:

1. Create Stripe account at https://stripe.com
2. Create Products/Prices for subscription tiers:

   - Free: $0
   - Basic: $19/month
   - Pro: $49/month
   - Unlimited: $99/month

3. Get API keys from Stripe Dashboard

4. Add to .env:

   ```env
   STRIPE_SECRET_KEY=sk_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   STRIPE_PRICE_BASIC=price_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_PRICE_UNLIMITED=price_...
   ```

5. Create webhook endpoint for subscription events

6. Implement:
   - Checkout flow
   - Customer portal link
   - Usage limits based on tier
   - Subscription status sync

---

## Testing the Setup

### 1. Start the backend:

```bash
cd /Users/denis/Documents/signalcopier
python -m src.main
```

### 2. Start the frontend:

```bash
cd /Users/denis/Documents/signalcopier/dashboard
npm run dev
```

### 3. Test auth flow:

1. Go to http://localhost:5173
2. You should be redirected to /login
3. Click "Sign up" and create an account
4. Check email for verification (if enabled)
5. Complete onboarding wizard
6. Access dashboard

### 4. Test admin (after setting yourself as admin):

1. Log in with your admin account
2. Look for "Admin" in the sidebar
3. Click to access admin dashboard

---

## File Structure Reference

```
signalcopier/
├── .env                          # Backend environment
├── requirements.txt              # Python dependencies
├── MULTI_TENANT_SETUP.md        # This file
├── supabase/
│   └── migrations/
│       └── 001_multi_tenant_schema.sql  # Database schema
├── src/
│   ├── auth/                     # NEW: Auth module
│   │   ├── __init__.py
│   │   ├── middleware.py         # JWT verification
│   │   └── models.py             # AuthUser model
│   ├── users/                    # NEW: User management
│   │   ├── __init__.py
│   │   ├── manager.py            # Connection manager
│   │   └── credentials.py        # Credentials helpers
│   ├── api/
│   │   ├── routes.py             # Existing routes
│   │   ├── onboarding_routes.py  # NEW: Onboarding API
│   │   ├── admin_routes.py       # NEW: Admin API
│   │   └── server.py             # FastAPI app
│   └── ...
└── dashboard/
    ├── .env                      # Frontend environment
    ├── src/
    │   ├── contexts/
    │   │   └── AuthContext.jsx   # NEW: Auth state
    │   ├── pages/
    │   │   ├── Login.jsx         # NEW
    │   │   ├── Register.jsx      # NEW
    │   │   ├── ForgotPassword.jsx # NEW
    │   │   ├── AuthCallback.jsx  # NEW
    │   │   ├── Onboarding/       # NEW
    │   │   │   ├── index.jsx
    │   │   │   ├── TelegramStep.jsx
    │   │   │   ├── MetaTraderStep.jsx
    │   │   │   └── SettingsStep.jsx
    │   │   ├── Admin/            # NEW
    │   │   │   └── index.jsx
    │   │   └── Dashboard.jsx
    │   ├── components/
    │   │   └── Auth/
    │   │       └── ProtectedRoute.jsx  # NEW
    │   └── lib/
    │       └── supabase.js       # NEW: Supabase client
    └── ...
```

---

## Troubleshooting

### "Not authenticated" error

- Check that the JWT token is being sent in Authorization header
- Verify SUPABASE_KEY in backend .env matches your project

### Google/Apple OAuth not working

- Ensure redirect URLs are correctly configured
- Check that credentials are correct in Supabase

### Profile not created after signup

- Check that the trigger `on_auth_user_created` exists
- Run the SQL migration again if needed

### Admin page not showing

- Verify your profile has `role = 'admin'`
- Check browser console for errors

---

## Quick Commands

```bash
# Run SQL migration (copy to Supabase SQL Editor)
cat supabase/migrations/001_multi_tenant_schema.sql

# Set user as admin
# Run in Supabase SQL Editor:
# UPDATE profiles SET role = 'admin' WHERE email = 'your@email.com';

# Install dependencies
pip install -r requirements.txt
cd dashboard && npm install

# Start development
# Terminal 1:
python -m src.main

# Terminal 2:
cd dashboard && npm run dev
```
