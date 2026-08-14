import threading
import time
import concurrent.futures
import yfinance as yf
from backend.services.scoring import calculate_stockpulse_score

NIFTY_50_SYMBOLS = [
    "RELIANCE.NS", "TCS.NS", "HDFCBANK.NS", "INFY.NS", "ICICIBANK.NS", 
    "SBIN.NS", "TATAMOTORS.NS", "ITC.NS", "LT.NS", "BAJFINANCE.NS", 
    "BHARTIARTL.NS", "ASIANPAINT.NS", "HINDUNILVR.NS", "AXISBANK.NS", "KOTAKBANK.NS",
    "SUNPHARMA.NS", "MARUTI.NS", "NTPC.NS", "TITAN.NS", "ULTRACEMCO.NS",
    "WIPRO.NS", "HCLTECH.NS", "POWERGRID.NS", "M&M.NS", "BAJAJFINSV.NS",
    "ONGC.NS", "NESTLEIND.NS", "JSWSTEEL.NS", "ADANIENT.NS", "ADANIPORTS.NS",
    "TATASTEEL.NS", "INDUSINDBK.NS", "GRASIM.NS", "HINDALCO.NS", "COALINDIA.NS",
    "BRITANNIA.NS", "TECHM.NS", "EICHERMOT.NS", "APOLLOHOSP.NS", "DIVISLAB.NS",
    "DRREDDY.NS", "HEROMOTOCO.NS", "SBILIFE.NS", "HDFCLIFE.NS", "LTIM.NS",
    "BAJAJ-AUTO.NS", "TATACONSUM.NS", "BPCL.NS", "CIPLA.NS", "SHRIRAMFIN.NS"
]

class ScreenerCache:
    def __init__(self):
        self.data = []
        self.last_updated = 0
        self.is_fetching = False

    def fetch_single(self, sym):
        try:
            t = yf.Ticker(sym)
            i = t.info
            if not i: return None
            return {
                "symbol": sym,
                "name": i.get("shortName", sym),
                "sector": i.get("sector", "N/A"),
                "marketCap": i.get("marketCap"),
                "price": i.get("currentPrice", i.get("regularMarketPrice")),
                "pe": i.get("trailingPE"),
                "pb": i.get("priceToBook"),
                "roe": i.get("returnOnEquity"),
                "roce": i.get("returnOnAssets"),
                "debtToEquity": i.get("debtToEquity"),
                "revenueGrowth": i.get("revenueGrowth"),
                "profitGrowth": i.get("earningsGrowth"),
                "eps": i.get("trailingEps"),
                "dividendYield": i.get("dividendYield"),
                "fiftyTwoWeekReturn": i.get("52WeekChange"),
                "momentum": i.get("priceToBook"),
                "stockpulseScore": calculate_stockpulse_score(i)
            }
        except Exception:
            return None

    def update_bg(self):
        if self.is_fetching: return
        self.is_fetching = True
        print("Starting background fetch for Nifty 50 Screener data...")
        results = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = {executor.submit(self.fetch_single, sym): sym for sym in NIFTY_50_SYMBOLS}
            for future in concurrent.futures.as_completed(futures):
                res = future.result()
                if res:
                    results.append(res)
        
        self.data = results
        self.last_updated = time.time()
        self.is_fetching = False
        print(f"Screener data fetched. {len(results)} stocks obtained.")

cache = ScreenerCache()

def start_cache_thread():
    threading.Thread(target=cache.update_bg, daemon=True).start()
