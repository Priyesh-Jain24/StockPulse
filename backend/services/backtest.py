import yfinance as yf
import pandas as pd
import numpy as np
import traceback

def run_sma_backtest(symbol, initial_cap, short_ma, long_ma, start_date=None, end_date=None, tx_cost=0.001, risk_free_rate=0.06):
    t = yf.Ticker(symbol)
    
    # Fetch 10y for sufficient warm up
    df = t.history(period="10y")
    if df.empty: 
        raise ValueError(f"No historical data for {symbol}")
        
    df = df.dropna(subset=["Close"])
    df.index = df.index.tz_localize(None)
    
    df["SMA_S"] = df["Close"].rolling(window=short_ma).mean()
    df["SMA_L"] = df["Close"].rolling(window=long_ma).mean()
    
    if start_date:
        df = df[df.index >= pd.to_datetime(start_date)]
    if end_date:
        df = df[df.index <= pd.to_datetime(end_date)]
        
    if len(df) == 0:
         raise ValueError(f"No usable data found within the selected date range.")

    prev_sma_s = df["SMA_S"].shift(1)
    prev_sma_l = df["SMA_L"].shift(1)
    
    buy_signals = (df["SMA_S"] > df["SMA_L"]) & (prev_sma_s <= prev_sma_l)
    sell_signals = (df["SMA_S"] < df["SMA_L"]) & (prev_sma_s >= prev_sma_l)
    
    df["Buy_Signal"] = buy_signals
    df["Sell_Signal"] = sell_signals
    
    trades = []
    in_position = False
    entry_price = 0
    cap = initial_cap
    equity_curve = []
    drawdowns = []
    running_peak = initial_cap
    
    pending_action = None
    
    markers = [] # for UI overlay
    
    for date, row in df.iterrows():
        dt_str = date.strftime("%Y-%m-%d")
        
        # Attempt Execution on Open of T+1
        exec_price = row.get("Open", row["Close"])
        if pd.isna(exec_price): exec_price = row["Close"]
        
        if pending_action == "BUY" and not in_position:
            in_position = True
            cost = exec_price * tx_cost
            entry_price = exec_price + cost
            trades.append({"type": "BUY", "entry_date": dt_str, "entry_price": entry_price, "costs_entry": cost})
            markers.append({"time": dt_str, "position": "belowBar", "color": "#10B981", "shape": "arrowUp", "text": "BUY"})
            
        elif pending_action == "SELL" and in_position:
            in_position = False
            cost = exec_price * tx_cost
            exit_price = exec_price - cost
            
            gross_ret = (exec_price - entry_price) / entry_price
            net_ret = (exit_price - entry_price) / entry_price
            net_pnl = cap * net_ret
            cap = cap * (1 + net_ret)
            
            for t_log in reversed(trades):
                if t_log["type"] == "BUY" and "exit_date" not in t_log:
                    t_log["exit_date"] = dt_str
                    t_log["exit_price"] = exit_price
                    t_log["gross_return"] = gross_ret
                    t_log["net_return"] = net_ret
                    t_log["net_pnl"] = net_pnl
                    t_log["costs_exit"] = cost
                    t_log["holding_days"] = (date - pd.to_datetime(t_log["entry_date"])).days
                    t_log["status"] = "CLOSED"
                    break
                    
            markers.append({"time": dt_str, "position": "aboveBar", "color": "#EF4444", "shape": "arrowDown", "text": "SELL"})
                    
        close_price = row["Close"]
        val = cap * (close_price / entry_price) if in_position else cap
        if pd.isna(val) or val == float('inf') or val == float('-inf'): val = cap
        
        equity_curve.append({"time": dt_str, "value": val})
        running_peak = max(running_peak, val)
        dd = (val - running_peak) / running_peak
        drawdowns.append({"time": dt_str, "value": dd * 100})
        
        if row["Buy_Signal"]: pending_action = "BUY"
        elif row["Sell_Signal"]: pending_action = "SELL"
        else: pending_action = None
        
    unrealized_pnl = 0
    if in_position:
        final_price = df.iloc[-1]["Close"]
        val = cap * (final_price / entry_price)
        unrealized_pnl = val - cap
        for t_log in reversed(trades):
            if t_log["type"] == "BUY" and "exit_date" not in t_log:
                t_log["status"] = "OPEN"
                t_log["unrealized_pnl"] = unrealized_pnl
                break
    else:
        val = cap
        
    completed_trades = [t for t in trades if t.get("status") == "CLOSED"]
    wins = [t for t in completed_trades if t["net_return"] > 0]
    losses = [t for t in completed_trades if t["net_return"] <= 0]
    
    total_ret_pct = ((val - initial_cap) / initial_cap) * 100
    years = (df.index[-1] - df.index[0]).days / 365.25
    cagr = (((val / initial_cap) ** (1 / years)) - 1) * 100 if years > 0 else total_ret_pct
    
    gross_profit = sum(t["net_pnl"] for t in wins)
    gross_loss = abs(sum(t["net_pnl"] for t in losses))
    
    metrics = {
        "final_capital": val,
        "total_return_pct": total_ret_pct,
        "cagr": cagr,
        "max_drawdown": min([d["value"] for d in drawdowns]) if drawdowns else 0,
        "total_trades": len(completed_trades),
        "win_rate": (len(wins) / len(completed_trades) * 100) if completed_trades else 0,
        "avg_win_pct": (sum(t["net_return"] for t in wins) / len(wins) * 100) if wins else 0,
        "avg_loss_pct": (sum(t["net_return"] for t in losses) / len(losses) * 100) if losses else 0,
        "profit_factor": (gross_profit / gross_loss) if gross_loss > 0 else (999 if gross_profit > 0 else 0),
        "avg_holding_days": (sum(t["holding_days"] for t in completed_trades) / len(completed_trades)) if completed_trades else 0,
        "open_position": in_position,
        "unrealized_pnl": unrealized_pnl
    }
    
    bh_ret = ((df["Close"].iloc[-1] - df["Close"].iloc[0]) / df["Close"].iloc[0])
    bh_cagr = ((((df["Close"].iloc[-1] / df["Close"].iloc[0]) ** (1 / years)) - 1) * 100) if years > 0 else (bh_ret * 100)
    
    bh_vals = df["Close"].values
    bh_peaks = np.maximum.accumulate(bh_vals)
    bh_dds = (bh_vals - bh_peaks) / bh_peaks
    bh_max_dd = np.min(bh_dds) * 100 if len(bh_dds) > 0 else 0
    
    metrics["benchmark_return_pct"] = bh_ret * 100
    metrics["benchmark_cagr"] = bh_cagr
    metrics["benchmark_max_drawdown"] = bh_max_dd
    
    df_eq = pd.DataFrame(equity_curve)
    if not df_eq.empty:
        df_eq["ret"] = df_eq["value"].pct_change()
        ann_vol = df_eq["ret"].std() * np.sqrt(252)
        metrics["ann_volatility"] = ann_vol * 100 if pd.notna(ann_vol) else 0
        
        strat_ann_ret = metrics["cagr"] / 100
        metrics["sharpe"] = (strat_ann_ret - risk_free_rate) / ann_vol if ann_vol > 0 else 0
        
        downside_vol = df_eq[df_eq["ret"] < 0]["ret"].std() * np.sqrt(252)
        metrics["sortino"] = (strat_ann_ret - risk_free_rate) / downside_vol if downside_vol > 0 else 0

    nifty_norm = []
    try:
        nifty = yf.Ticker("^NSEI").history(period="10y")
        if not nifty.empty:
            nifty = nifty.dropna(subset=["Close"])
            nifty.index = nifty.index.tz_localize(None)
            if start_date: nifty = nifty[nifty.index >= pd.to_datetime(start_date)]
            if end_date: nifty = nifty[nifty.index <= pd.to_datetime(end_date)]
            
            if not nifty.empty:
                nifty_start = nifty["Close"].iloc[0]
                n_ret = (nifty["Close"].iloc[-1] - nifty_start) / nifty_start
                n_cagr = (((nifty["Close"].iloc[-1] / nifty_start) ** (1/years)) - 1) * 100 if years > 0 else n_ret * 100
                n_peaks = np.maximum.accumulate(nifty["Close"].values)
                n_dds = (nifty["Close"].values - n_peaks) / n_peaks
                
                metrics["nifty_return_pct"] = n_ret * 100
                metrics["nifty_cagr"] = n_cagr
                metrics["nifty_max_drawdown"] = np.min(n_dds) * 100 if len(n_dds) > 0 else 0
                nifty_norm = [{"time": date.strftime("%Y-%m-%d"), "value": (row["Close"]/nifty_start)*100} for date, row in nifty.iterrows()]
    except Exception:
        pass

    return {
        "metrics": metrics,
        "equity_curve": equity_curve,
        "drawdown_curve": drawdowns,
        "trade_log": trades,
        "markers": markers,
        "stock_price_norm": [{"time": date.strftime("%Y-%m-%d"), "value": (row["Close"]/bh_vals[0])*100} for date, row in df.iterrows()],
        "strat_norm": [{"time": obj["time"], "value": (obj["value"]/initial_cap)*100} for obj in equity_curve],
        "nifty_norm": nifty_norm
    }
