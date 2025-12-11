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
