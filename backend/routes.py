from flask import Blueprint, jsonify, request
import yfinance as yf
import pandas as pd
import traceback
import math
import time

from backend.cache.screener_cache import cache, start_cache_thread
from backend.services.scoring import calculate_stockpulse_score
from backend.services.backtest import run_sma_backtest

api = Blueprint("api", __name__, url_prefix="/api")

@api.route("/health")
def health_check():
    return jsonify({
        "status": "healthy",
        "service": "stockpulse-backend"
    }), 200

@api.route("/health/data")
def health_data():
    return jsonify({
        "status": cache.status,
        "source": "Yahoo Finance",
        "cache_available": len(cache.data) > 0,
        "last_updated": cache.last_updated,
        "message": cache.message
    }), 200

def _handle_yf_error(e):
    err_str = str(e)
    if "401" in err_str or "Invalid Crumb" in err_str or "429" in err_str or "Unauthorized" in err_str:
        return jsonify({"error": "Market data temporarily unavailable from live API provider."}), 503
    traceback.print_exc()
    return jsonify({"error": err_str}), 500

def _safe(val):
    if val is None: return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)): return None
    return val

def _fmt_large_number(n):
    if n is None: return "N/A"
    try: n = float(n)
    except: return "N/A"
    if math.isnan(n) or math.isinf(n): return "N/A"
    abs_n = abs(n)
    if abs_n >= 1_000_000_000_000: return f"{n / 1_000_000_000_000:.2f}T"
    if abs_n >= 1_000_000_000: return f"{n / 1_000_000_000:.2f}B"
    if abs_n >= 1_000_000: return f"{n / 1_000_000:.2f}M"
    if abs_n >= 1_000: return f"{n / 1_000:.2f}K"
    return f"{n:.2f}"

@api.route("/stock/<symbol>")
def get_stock_history(symbol):
    period = request.args.get("period", "1mo")
    interval = request.args.get("interval", None)
    default_intervals = {"1d": "5m", "5d": "15m", "1mo": "1d", "3mo": "1d", "6mo": "1d", "1y": "1wk", "5y": "1mo", "max": "1mo"}
    if interval is None: interval = default_intervals.get(period, "1d")

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        if df.empty: return jsonify({"error": f"No data found for '{symbol}'"}), 404
        if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)

        data = {
            "dates": df.index.strftime("%Y-%m-%d %H:%M").tolist(),
            "open": [_safe(v) for v in df["Open"].tolist()],
            "high": [_safe(v) for v in df["High"].tolist()],
            "low": [_safe(v) for v in df["Low"].tolist()],
            "close": [_safe(v) for v in df["Close"].tolist()],
            "volume": [_safe(v) for v in df["Volume"].tolist()],
        }
        return jsonify(data)
    except Exception as e:
        return _handle_yf_error(e)

@api.route("/stock/<symbol>/info")
def get_stock_info(symbol):
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info
        result = {
            "symbol": symbol.upper(),
            "shortName": info.get("shortName", symbol.upper()),
            "longName": info.get("longName", info.get("shortName", symbol.upper())),
            "sector": info.get("sector", "N/A"),
            "industry": info.get("industry", "N/A"),
            "website": info.get("website", ""),
            "description": info.get("longBusinessSummary", ""),
            "country": info.get("country", "N/A"),
            "exchange": info.get("exchange", "N/A"),
            "currency": info.get("currency", "USD"),
            "currentPrice": _safe(info.get("currentPrice", info.get("regularMarketPrice"))),
            "previousClose": _safe(info.get("previousClose")),
            "open": _safe(info.get("open", info.get("regularMarketOpen"))),
            "dayHigh": _safe(info.get("dayHigh", info.get("regularMarketDayHigh"))),
            "dayLow": _safe(info.get("dayLow", info.get("regularMarketDayLow"))),
            "volume": _safe(info.get("volume", info.get("regularMarketVolume"))),
            "avgVolume": _safe(info.get("averageVolume")),
            "marketCap": _safe(info.get("marketCap")),
            "marketCapFmt": _fmt_large_number(info.get("marketCap")),
            "pe": _safe(info.get("trailingPE")),
            "forwardPe": _safe(info.get("forwardPE")),
            "eps": _safe(info.get("trailingEps")),
            "beta": _safe(info.get("beta")),
            "dividendYield": _safe(info.get("dividendYield")),
            "fiftyTwoWeekHigh": _safe(info.get("fiftyTwoWeekHigh")),
            "fiftyTwoWeekLow": _safe(info.get("fiftyTwoWeekLow")),
            "fiftyDayAverage": _safe(info.get("fiftyDayAverage")),
            "twoHundredDayAverage": _safe(info.get("twoHundredDayAverage")),
            "logo_url": info.get("logo_url", ""),
            "stockpulseScore": calculate_stockpulse_score(info),
        }
        return jsonify(result)
    except Exception as e:
        return _handle_yf_error(e)

@api.route("/stock/<symbol>/financials")
def get_stock_financials(symbol):
    try:
        ticker = yf.Ticker(symbol)
        def df_to_dict(df):
            if df is None or df.empty: return {}
            if isinstance(df.columns, pd.MultiIndex): df.columns = df.columns.get_level_values(0)
            out = {}
            for col in df.columns:
                col_label = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)
                out[col_label] = { idx: _fmt_large_number(val) for idx, val in df[col].items()}
            return out
        result = {
            "income_statement": df_to_dict(ticker.quarterly_financials),
            "balance_sheet": df_to_dict(ticker.quarterly_balance_sheet),
        }
        return jsonify(result)
    except Exception as e:
        return _handle_yf_error(e)

@api.route("/search/<query>")
def search_ticker(query):
    try:
        from yfinance import Search
        results = Search(query, max_results=8)
        quotes = []
        if hasattr(results, "quotes") and results.quotes is not None:
            for q in results.quotes:
                if isinstance(q, dict):
                    quotes.append({
                        "symbol": q.get("symbol", ""),
                        "name": q.get("shortname", q.get("longname", "")),
                        "exchange": q.get("exchange", ""),
                        "type": q.get("quoteType", ""),
                    })
        return jsonify({"results": quotes})
    except Exception:
        return jsonify({"results": [{"symbol": query.upper(), "name": query.upper(), "exchange": "", "type": ""}]})

@api.route("/stock/<symbol>/news")
def get_stock_news(symbol):
    try:
        ticker = yf.Ticker(symbol)
        news_items = ticker.news
        if not news_items: return jsonify([])
        clean_news = []
        for n in news_items[:6]:
            content = n.get("content", n)
            title = content.get("title", "")
            publisher = content.get("provider", {}).get("displayName", content.get("publisher", "Unknown"))
            link = content.get("canonicalUrl", {}).get("url", content.get("link", "#"))
            pub_time = content.get("pubDate", content.get("providerPublishTime", 0))
            if isinstance(pub_time, (int, float)): pub_time = pub_time * 1000
            clean_news.append({"title": title, "publisher": publisher, "link": link, "time": pub_time})
        return jsonify(clean_news)
    except Exception as e:
        return _handle_yf_error(e)

@api.route("/screener")
def get_screener_data():
    if time.time() - cache.last_updated > 3600 and not cache.is_fetching:
        start_cache_thread()
    return jsonify({
        "status": cache.status,
        "data": cache.data,
        "message": cache.message
    })

@api.route("/sectors")
def get_sector_analysis():
    if not cache.data: return jsonify({"status": "loading"})
    sectors_ag = {}
    for d in cache.data:
        s = d.get("sector")
        if not s or s == "N/A": continue
        if s not in sectors_ag:
            sectors_ag[s] = {"count": 0, "pe_sum": 0, "pe_count": 0, "roe_sum": 0, "roe_count": 0, "return_sum": 0, "return_count": 0}
        
        sectors_ag[s]["count"] += 1
        if d.get("pe"):
            sectors_ag[s]["pe_sum"] += d["pe"]
            sectors_ag[s]["pe_count"] += 1
        if d.get("roe"):
            sectors_ag[s]["roe_sum"] += d["roe"]
            sectors_ag[s]["roe_count"] += 1
        if d.get("fiftyTwoWeekReturn"):
            sectors_ag[s]["return_sum"] += d["fiftyTwoWeekReturn"]
            sectors_ag[s]["return_count"] += 1
            
    res = []
    for s, data in sectors_ag.items():
        res.append({
            "sector": s,
            "count": data["count"],
            "avg_pe": data["pe_sum"] / data["pe_count"] if data["pe_count"] > 0 else None,
            "avg_roe": data["roe_sum"] / data["roe_count"] if data["roe_count"] > 0 else None,
            "avg_return_52w": data["return_sum"] / data["return_count"] if data["return_count"] > 0 else None
        })
    return jsonify({"status": "ready", "data": res})

@api.route("/compare")
def get_compare_data():
    symbols_param = request.args.get("symbols", "")
    symbols = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
    if not symbols: return jsonify([])
    
    results = []
    def fetch_or_cache(sym):
        for c in cache.data:
            if c["symbol"] == sym: return c
        return cache.fetch_single(sym)

    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_or_cache, sym): sym for sym in symbols}
        for future in concurrent.futures.as_completed(futures):
            res = future.result()
            if res: results.append(res)
            
    return jsonify(results)

@api.route("/backtest")
def run_backtest_handler():
    symbol = request.args.get("symbol", "RELIANCE.NS").upper()
    try:
        initial_cap = float(request.args.get("capital", 100000))
        short_ma = int(request.args.get("short_ma", 50))
        long_ma = int(request.args.get("long_ma", 200))
        start_date = request.args.get("start_date")
        end_date = request.args.get("end_date")
        tx_cost = float(request.args.get("tx_cost", 0.001))
        risk_free = float(request.args.get("risk_free", 0.06))
        
        return jsonify(run_sma_backtest(
            symbol=symbol, 
            initial_cap=initial_cap, 
            short_ma=short_ma, 
            long_ma=long_ma, 
            start_date=start_date, 
            end_date=end_date, 
            tx_cost=tx_cost, 
            risk_free_rate=risk_free
        ))
    except Exception as e:
        return _handle_yf_error(e)

@api.route("/market/indices")
def get_market_indices():
    try:
        symbols = {"^NSEI": "Nifty 50", "^BSESN": "Sensex", "^NSEBANK": "Nifty Bank"}
        hist = yf.download(list(symbols.keys()), period="2d", group_by="ticker", progress=False)
        data = []
        for sym, name in symbols.items():
            sym_df = hist[sym].dropna(subset=["Close"]) if len(symbols) > 1 else hist.dropna(subset=["Close"])
            if len(sym_df) >= 1:
                price = float(sym_df["Close"].iloc[-1])
                prev = float(sym_df["Close"].iloc[-2]) if len(sym_df) > 1 else price
                data.append({"symbol": sym, "name": name, "price": price, "prev": prev})
        return jsonify(data)
    except Exception as e:
        return _handle_yf_error(e)

@api.route("/market/featured")
def get_featured_stocks():
    try:
        symbols = {"RELIANCE.NS": "Reliance", "TCS.NS": "TCS", "HDFCBANK.NS": "HDFC", "INFY.NS": "Infosys", "ICICIBANK.NS": "ICICI"}
        hist = yf.download(list(symbols.keys()), period="2d", group_by="ticker", progress=False)
        data = []
        for sym, name in symbols.items():
            sym_df = hist[sym].dropna(subset=["Close"])
            if len(sym_df) >= 1:
                price = float(sym_df["Close"].iloc[-1])
                prev = float(sym_df["Close"].iloc[-2]) if len(sym_df) > 1 else price
                data.append({"symbol": sym, "name": name, "price": price, "prev": prev})
        return jsonify(data)
    except Exception as e:
        return _handle_yf_error(e)

@api.route("/market/quotes")
def get_market_quotes():
    try:
        symbols_param = request.args.get("symbols", "")
        if not symbols_param: return jsonify([])
        symbols_list = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
        if not symbols_list: return jsonify([])

        hist = yf.download(symbols_list, period="2d", group_by="ticker", progress=False)
        data = []
        for sym in symbols_list:
            if len(symbols_list) == 1: sym_df = hist.dropna(subset=["Close"])
            else:
                if sym not in hist: continue
                sym_df = hist[sym].dropna(subset=["Close"])
                
            if len(sym_df) >= 1:
                price = float(sym_df["Close"].iloc[-1])
                prev = float(sym_df["Close"].iloc[-2]) if len(sym_df) > 1 else price
                data.append({"symbol": sym, "price": price, "prev": prev})
        return jsonify(data)
    except Exception as e:
        return _handle_yf_error(e)
