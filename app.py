"""
Stock Dashboard — Flask Backend
Serves API endpoints for stock data using yfinance.
"""

from flask import Flask, render_template, jsonify, request
import yfinance as yf
import pandas as pd
import math
import traceback

app = Flask(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _safe(val):
    """Return None for NaN / Inf values so they serialize to JSON cleanly."""
    if val is None:
        return None
    if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
        return None
    return val


def _fmt_large_number(n):
    """Format large numbers like 2.45T, 132.5B, 4.2M for display."""
    if n is None:
        return "N/A"
    try:
        n = float(n)
    except (TypeError, ValueError):
        return "N/A"
    if math.isnan(n) or math.isinf(n):
        return "N/A"
    abs_n = abs(n)
    if abs_n >= 1_000_000_000_000:
        return f"{n / 1_000_000_000_000:.2f}T"
    if abs_n >= 1_000_000_000:
        return f"{n / 1_000_000_000:.2f}B"
    if abs_n >= 1_000_000:
        return f"{n / 1_000_000:.2f}M"
    if abs_n >= 1_000:
        return f"{n / 1_000:.2f}K"
    return f"{n:.2f}"


# ---------------------------------------------------------------------------
# Routes — Pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Routes — API
# ---------------------------------------------------------------------------

@app.route("/api/stock/<symbol>")
def get_stock_history(symbol):
    """Return OHLCV history for *symbol*.

    Query params:
        period  – yfinance period string (default "1mo")
        interval – yfinance interval string (auto-selected if omitted)
    """
    period = request.args.get("period", "1mo")
    interval = request.args.get("interval", None)

    # Sensible default intervals per period
    default_intervals = {
        "1d": "5m",
        "5d": "15m",
        "1mo": "1d",
        "3mo": "1d",
        "6mo": "1d",
        "1y": "1wk",
        "5y": "1mo",
        "max": "1mo",
    }
    if interval is None:
        interval = default_intervals.get(period, "1d")

    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)

        if df.empty:
            return jsonify({"error": f"No data found for '{symbol}'"}), 404

        # Flatten MultiIndex columns if present
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.get_level_values(0)

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
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/stock/<symbol>/info")
def get_stock_info(symbol):
    """Return company profile & key statistics."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.info

        if not info or info.get("trailingPegRatio") is None and info.get("shortName") is None:
            # Minimal sanity check — yfinance returns a dict even for bad tickers
            pass  # We'll still return whatever we got

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
        }
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/stock/<symbol>/financials")
def get_stock_financials(symbol):
    """Return income-statement and balance-sheet highlights."""
    try:
        ticker = yf.Ticker(symbol)

        def df_to_dict(df):
            if df is None or df.empty:
                return {}
            # Flatten MultiIndex columns if present
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)
            out = {}
            for col in df.columns:
                col_label = col.strftime("%Y-%m-%d") if hasattr(col, "strftime") else str(col)
                out[col_label] = {
                    idx: _fmt_large_number(val) for idx, val in df[col].items()
                }
            return out

        result = {
            "income_statement": df_to_dict(ticker.quarterly_financials),
            "balance_sheet": df_to_dict(ticker.quarterly_balance_sheet),
        }
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/api/search/<query>")
def search_ticker(query):
    """Simple ticker search using yfinance's search."""
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
        # Fallback: return the query itself as a suggestion
        return jsonify({"results": [{"symbol": query.upper(), "name": query.upper(), "exchange": "", "type": ""}]})


@app.route("/api/stock/<symbol>/news")
def get_stock_news(symbol):
    """Return recent news articles for the stock."""
    try:
        ticker = yf.Ticker(symbol)
        news_items = ticker.news
        if not news_items:
            return jsonify([])
            
        clean_news = []
        for n in news_items[:6]: # Limit to top 6 news
            content = n.get("content", n) # Handle both old and new yfinance formats
            
            title = content.get("title", "")
            publisher = content.get("provider", {}).get("displayName", content.get("publisher", "Unknown"))
            link = content.get("canonicalUrl", {}).get("url", content.get("link", "#"))
            
            # Pub date handling
            pub_time = content.get("pubDate", content.get("providerPublishTime", 0))
            # If it's an ISO string (from pubDate), we could parse it, but for now we'll pass to JS
            # The JS handles both string dates and JS timestamps safely if formatted correctly.
            # But let's pass it cleanly. If it's an epoch, format it.
            if isinstance(pub_time, (int, float)):
                pub_time = pub_time * 1000  # JS timestamp
                
            clean_news.append({
                "title": title,
                "publisher": publisher,
                "link": link,
                "time": pub_time
            })
        return jsonify(clean_news)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/market/indices")
def get_market_indices():
    """Return quick snapshot of major market indices."""
    try:
        symbols = {"^NSEI": "Nifty 50", "^BSESN": "Sensex", "^NSEBANK": "Nifty Bank", "^CNXIT": "Nifty IT"}
        tickers = yf.Tickers(" ".join(symbols.keys()))
        
        data = []
        for sym, name in symbols.items():
            try:
                hist = tickers.tickers[sym].history(period="2d")
                if len(hist) >= 1:
                    price = hist["Close"].iloc[-1]
                    prev = hist["Close"].iloc[-2] if len(hist) > 1 else price
                    data.append({
                        "symbol": sym,
                        "name": name,
                        "price": price,
                        "prev": prev
                    })
            except:
                pass
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/market/featured")
def get_featured_stocks():
    """Return quick snapshot of major Indian market leaders for the home page."""
    try:
        symbols = {
            "RELIANCE.NS": "Reliance Ind.",
            "TCS.NS": "TCS",
            "HDFCBANK.NS": "HDFC Bank", 
            "INFY.NS": "Infosys", 
            "ICICIBANK.NS": "ICICI Bank", 
            "SBIN.NS": "SBI",
            "TATAMOTORS.NS": "Tata Motors",
            "ITC.NS": "ITC Ltd",
            "LT.NS": "Larsen & Toubro",
            "BAJFINANCE.NS": "Bajaj Finance",
            "BHARTIARTL.NS": "Bharti Airtel",
            "ASIANPAINT.NS": "Asian Paints"
        }
        
        hist = yf.download(list(symbols.keys()), period="2d", group_by="ticker", progress=False)
        import math
        
        data = []
        for sym, name in symbols.items():
            try:
                sym_df = hist[sym].dropna(subset=["Close"])
                if len(sym_df) >= 1:
                    price = float(sym_df["Close"].iloc[-1])
                    prev = float(sym_df["Close"].iloc[-2]) if len(sym_df) > 1 else price
                    
                    if math.isnan(price): price = None
                    if math.isnan(prev): prev = None
                    
                    data.append({
                        "symbol": sym,
                        "name": name,
                        "price": price,
                        "prev": prev
                    })
            except Exception as e:
                print(f"Error fetching {sym}: {e}")
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/api/market/quotes")
def get_market_quotes():
    """Fetch fast batched quotes for a list of comma-separated symbols."""
    try:
        symbols_param = request.args.get("symbols", "")
        if not symbols_param:
            return jsonify([])
        
        symbols_list = [s.strip().upper() for s in symbols_param.split(",") if s.strip()]
        if not symbols_list:
             return jsonify([])

        # Batch download 2 days to get current and previous close
        hist = yf.download(symbols_list, period="2d", group_by="ticker", progress=False)
        import math
        
        data = []
        for sym in symbols_list:
            try:
                # yfinance returns a single-level column df if there's only 1 symbol
                if len(symbols_list) == 1:
                    sym_df = hist.dropna(subset=["Close"])
                else:
                    if sym not in hist: continue
                    sym_df = hist[sym].dropna(subset=["Close"])
                    
                if len(sym_df) >= 1:
                    price = float(sym_df["Close"].iloc[-1])
                    prev = float(sym_df["Close"].iloc[-2]) if len(sym_df) > 1 else price
                    
                    if math.isnan(price): price = None
                    if math.isnan(prev): prev = None
                    
                    data.append({
                        "symbol": sym,
                        "price": price,
                        "prev": prev
                    })
            except Exception as e:
                print(f"Error fetching quote {sym}: {e}")
                
        return jsonify(data)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(debug=True, port=5050)

