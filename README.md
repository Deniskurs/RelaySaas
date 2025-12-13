# Telegram Signal Copier

A production-quality Python application that monitors Telegram channels for trading signals, parses them using Claude AI, validates trade logic, and executes orders on MT5 via MetaApi.

## Features

- **Telegram Monitoring**: Listens to configured channels for trading signals
- **AI-Powered Parsing**: Uses Claude Haiku to parse signals with intelligent direction correction
- **Risk Management**: Validates trades against configurable risk parameters
- **MT5 Execution**: Executes trades via MetaApi with TP splitting
- **Real-time Dashboard**: Professional React dashboard with WebSocket updates

## Quick Start

### 1. Install Python Dependencies

```bash
cd /Users/denis/Documents/signalcopier
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Install Dashboard Dependencies

```bash
cd dashboard
npm install
```

### 3. Run the Application

**Option A: Run Backend Only (Terminal 1)**
```bash
cd /Users/denis/Documents/signalcopier
source venv/bin/activate
python -m src.main
```
- API available at: http://localhost:8000
- API docs at: http://localhost:8000/docs

**Option B: Run Dashboard Dev Server (Terminal 2)**
```bash
cd /Users/denis/Documents/signalcopier/dashboard
npm run dev
```
- Dashboard at: http://localhost:5173

### First Run - Telegram Authentication

On first run, Telegram will prompt for verification:
1. Enter your phone number verification code in the terminal
2. A `signal_session.session` file will be created
3. Subsequent runs won't need verification

## Configuration

All settings are in `.env`:

```env
# Telegram
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+1234567890
CHANNEL_IDS=-1001234567890  # Comma-separated

# Trading
DEFAULT_LOT_SIZE=0.01
MAX_LOT_SIZE=0.1
MAX_OPEN_TRADES=5
MAX_RISK_PERCENT=2.0

# Execution
SPLIT_TPS=true  # Split position across multiple TPs
TP_SPLIT_RATIOS=0.5,0.3,0.2
```

## Project Structure

```
signalcopier/
├── src/
│   ├── main.py              # Entry point
│   ├── config.py            # Settings
│   ├── database/            # SQLAlchemy models & CRUD
│   ├── parser/              # Claude AI signal parser
│   ├── trading/             # MetaApi executor & validator
│   ├── telegram/            # Telethon listener
│   ├── api/                 # FastAPI server
│   └── utils/               # Logging & events
├── dashboard/               # React frontend
├── tests/                   # Test suite
└── data/                    # SQLite database
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/signals` | GET | List recent signals |
| `/api/trades` | GET | List all trades |
| `/api/trades/open` | GET | Get open positions |
| `/api/stats` | GET | Trading statistics |
| `/api/settings` | GET/POST | App settings |
| `/api/control/pause` | POST | Pause signal processing |
| `/api/control/resume` | POST | Resume processing |
| `/ws` | WebSocket | Real-time updates |

## Key Features

### Direction Correction
The parser detects mislabeled signals:
- If TPs are below entry with SL above → Corrected to SELL
- If TPs are above entry with SL below → Corrected to BUY

### TP Splitting
Positions are split across take-profit levels:
- TP1: 50% of position
- TP2: 30% of position
- TP3: 20% of position

### Risk Management
- Maximum risk per trade (default 2%)
- Maximum concurrent trades (default 5)
- Lot size auto-adjustment based on SL distance

## Multi-Tenant SaaS Deployment

For running as a SaaS with multiple users, each with their own MetaTrader and Telegram connections:

### Railway Configuration

Set the following environment variable in your Railway dashboard:

```env
MULTI_TENANT_MODE=true
```

### What Multi-Tenant Mode Does

1. **User Isolation**: Each user has their own:
   - Telegram listener with their own session
   - MetaTrader account via MetaAPI
   - Trading settings and preferences
   - Signal/trade history

2. **Per-User Data Storage**:
   - `user_credentials` table: Stores Telegram API keys, session, and MetaTrader account info
   - `user_settings_v2` table: Stores trading preferences per user
   - `signals_v2` and `trades_v2` tables: Filtered by `user_id` via RLS

3. **Onboarding Flow**:
   - Users complete onboarding to connect their own Telegram and MetaTrader accounts
   - Telegram verification flow: credentials → code → 2FA password → connected
   - MetaTrader provisioning: credentials sent to MetaAPI → account created → deployed

4. **Signal Routing**:
   - `signal_router.py` routes signals to the correct user's TradeExecutor
   - `UserConnectionManager` manages per-user connections

### Required Supabase Tables

```sql
-- User credentials (encrypted columns recommended)
CREATE TABLE user_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  telegram_api_id TEXT,
  telegram_api_hash TEXT,
  telegram_phone TEXT,
  telegram_session_encrypted TEXT,
  telegram_connected BOOLEAN DEFAULT FALSE,
  mt_login TEXT,
  mt_server TEXT,
  mt_platform TEXT DEFAULT 'mt5',
  metaapi_account_id TEXT,
  mt_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE user_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own credentials"
  ON user_credentials FOR ALL USING (auth.uid() = user_id);
```

### Single-User vs Multi-Tenant

| Feature | Single-User Mode | Multi-Tenant Mode |
|---------|------------------|-------------------|
| `MULTI_TENANT_MODE` | Not set or `false` | `true` |
| Telegram Session | `system_config` table | `user_credentials` per user |
| MetaTrader Account | Single `METAAPI_ACCOUNT_ID` | Per-user `metaapi_account_id` |
| Settings | `user_settings_v2` with `SYSTEM_USER_ID` | Per-user rows |
| API Endpoints | No authentication required | JWT authentication, user-scoped |

## Running Tests

```bash
cd /Users/denis/Documents/signalcopier
source venv/bin/activate
pytest tests/ -v
```

## Building Dashboard for Production

```bash
cd dashboard
npm run build
```

The built files will be in `dashboard/dist/` and can be served by the FastAPI backend.

## Troubleshooting

**Telegram connection issues:**
- Delete `signal_session.session` and re-authenticate
- Ensure API ID/Hash are correct

**MetaApi connection issues:**
- Verify account is deployed in MetaApi dashboard
- Check token hasn't expired

**Dashboard not connecting:**
- Ensure backend is running on port 8000
- Check browser console for WebSocket errors

## License

Private use only.
