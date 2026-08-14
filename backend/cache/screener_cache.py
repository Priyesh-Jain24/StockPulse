import threading
import time
import json
import os
import requests
import yfinance as yf
from backend.services.scoring import calculate_stockpulse_score

CACHE_FILE = "nifty50_cache.json"
CACHE_AGE_LIMIT = 24 * 60 * 60  # 24 hours

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
        self.status = "degraded"
        self.message = "Initializing"
        self._load_from_disk()

    def _load_from_disk(self):
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r") as f:
                    cached_data = json.load(f)
                    self.data = cached_data.get("data", [])
                    self.last_updated = cached_data.get("last_updated", 0)
                if self.data:
                    self.status = "healthy" if (time.time() - self.last_updated) < CACHE_AGE_LIMIT else "degraded"
                    self.message = "Loaded from disk Cache"
            except Exception:
                pass

    def _save_to_disk(self):
        try:
            with open(CACHE_FILE, "w") as f:
                json.dump({"last_updated": self.last_updated, "data": self.data}, f)
        except Exception:
            pass

    def fetch_single(self, sym, session):
        try:
            t = yf.Ticker(sym, session=session)
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
        except Exception as e:
            err_str = str(e)
            if "401" in err_str or "Invalid Crumb" in err_str or "429" in err_str or "Unauthorized" in err_str:
                raise e # Escalate explicitly to halt background sweep
            return None

    def update_bg(self):
        if self.is_fetching: return
        self.is_fetching = True
        
        if self.data and (time.time() - self.last_updated) < CACHE_AGE_LIMIT:
            self.is_fetching = False
            return

        session = requests.Session()
        session.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"})

        print("Starting synchronized fetch for Nifty 50 Screener data...")
        results = []
        try:
            # Sequential iteration preventing burst limits
            for sym in NIFTY_50_SYMBOLS:
                res = self.fetch_single(sym, session)
                if res:
                    results.append(res)
                # Politeness sleep against explicit Yahoo blocking
                time.sleep(1.0)
            
            if results:
                self.data = results
                self.last_updated = time.time()
                self.status = "healthy"
                self.message = "Live data successfully updated."
                self._save_to_disk()
                print(f"Screener data fetched safely. {len(results)} obtained.")
        except Exception as e:
            err_str = str(e)
            if "401" in err_str or "Invalid Crumb" in err_str or "429" in err_str or "Unauthorized" in err_str:
                print("Nifty 50 cache refresh unavailable: Yahoo Finance returned 401/429. Serving application with existing cached data.")
                self.status = "degraded"
                self.message = "Market data temporarily unavailable from live API provider. Serving cached historical records safely."
            else:
                print(f"Non-fatal sweep interruption: {e}")
                
        self.is_fetching = False

cache = ScreenerCache()

def start_cache_thread():
    threading.Thread(target=cache.update_bg, daemon=True).start()
