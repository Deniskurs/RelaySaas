"""Sample trading signals for testing."""

SAMPLE_SIGNALS = [
    # Mislabeled BUY (actually SELL - TPs below entry)
    {
        "input": """BUY EURNOK
ENTRY 11.79446
TP1 11.78500
TP2 11.78200
TP3 11.78000
SL 11.80300

NOT FINANCIAL ADVICE""",
        "expected_direction": "SELL",
        "expected_symbol": "EURNOK",
        "should_have_warning": True,
    },
    # Correct BUY
    {
        "input": """GOLD SIGNAL
Buy @ 2645.50
SL: 2640.00
TP: 2650 / 2655 / 2660""",
        "expected_direction": "BUY",
        "expected_symbol": "XAUUSD",
        "should_have_warning": False,
    },
    # Different format SELL
    {
        "input": """GBPUSD SELL
Entry: 1.2750
Stop Loss: 1.2800
Take Profit 1: 1.2700
Take Profit 2: 1.2650

Trade at your own risk!""",
        "expected_direction": "SELL",
        "expected_symbol": "GBPUSD",
        "should_have_warning": False,
    },
    # Not a signal
    {
        "input": "Market looking bullish today, watching for entries",
        "expected": None,
    },
    # US30 format
    {
        "input": """US30 BUY NOW
Entry: 38500
SL: 38400
TP1: 38600
TP2: 38700""",
        "expected_direction": "BUY",
        "expected_symbol": "DJ30",
        "should_have_warning": False,
    },
    # EUR/USD with slash
    {
        "input": """EUR/USD BUY
Entry 1.0850
SL 1.0800
TP1 1.0900
TP2 1.0950""",
        "expected_direction": "BUY",
        "expected_symbol": "EURUSD",
        "should_have_warning": False,
    },
    # Mislabeled SELL (actually BUY - TPs above entry)
    {
        "input": """SELL USDJPY @ 150.50
SL: 151.00
TP1: 150.00
TP2: 149.50""",
        "expected_direction": "SELL",
        "expected_symbol": "USDJPY",
        "should_have_warning": False,  # This one is correct
    },
]

NON_SIGNAL_MESSAGES = [
    "Good morning traders! Ready for another profitable day?",
    "Great win on that EURUSD trade! +50 pips",
    "Market analysis: Looking at support levels around 1.0800",
    "Remember to manage your risk properly",
    "Live session starting in 30 minutes",
]
