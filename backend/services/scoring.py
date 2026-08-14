import math

def calc_score(metric, min_val, max_val, reverse=False):
    if metric is None or math.isnan(metric) or math.isinf(metric):
        return 50 # neutral fallback if data unavailable
    score = (metric - min_val) / (max_val - min_val) * 100
    if reverse:
        score = 100 - score
    return max(0, min(100, score))

def calculate_stockpulse_score(info):
    if not info: return None
    
    # 1. Profitability (20%) - ROE (0 to 30%), Operating Margin (0 to 25%)
    roe_raw = info.get("returnOnEquity")
    marg_raw = info.get("operatingMargins")
    roe_score = calc_score(roe_raw * 100 if roe_raw else None, 5, 25)
    margin_score = calc_score(marg_raw * 100 if marg_raw else None, 5, 25)
    profitability = (roe_score + margin_score) / 2
    
    # 2. Growth (15%) - Rev Growth (0 to 30%), Earnings Growth (0 to 30%)
    rev_raw = info.get("revenueGrowth")
    ern_raw = info.get("earningsGrowth")
    rev_g = calc_score(rev_raw * 100 if rev_raw else None, 0, 30)
    ern_g = calc_score(ern_raw * 100 if ern_raw else None, 0, 30)
    growth = (rev_g + ern_g) / 2
    
    # 3. Valuation (20%) - P/E (10 to 50), P/B (1 to 10)
    pe_score = calc_score(info.get("trailingPE"), 10, 50, reverse=True)
    pb_score = calc_score(info.get("priceToBook"), 1, 10, reverse=True)
    val_score = (pe_score + pb_score) / 2
    
    # 4. Health (20%) - Debt/Equity (0 to 150)
    health = calc_score(info.get("debtToEquity"), 0, 150, reverse=True)
    
    # 5. Momentum (15%) - 52W Change (-20% to 50%)
    mom_raw = info.get("52WeekChange")
    mom_score = calc_score(mom_raw * 100 if mom_raw else None, -20, 50)
    
    # 6. Dividend (10%) - Div Yield (0 to 4%)
    div_raw = info.get("dividendYield")
    div_score = calc_score(div_raw * 100 if div_raw else None, 0, 4)
    
    total = (profitability * 0.20) + (growth * 0.15) + (val_score * 0.20) + (health * 0.20) + (mom_score * 0.15) + (div_score * 0.10)
    
    return {
        "total": int(total),
        "profitability": int(profitability),
        "growth": int(growth),
        "valuation": int(val_score),
        "health": int(health),
        "momentum": int(mom_score),
        "dividend": int(div_score)
    }
