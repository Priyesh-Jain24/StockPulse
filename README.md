# StockPulse Analyst 📈

StockPulse Analyst is a production-grade financial analytics and equity research platform designed for the Indian stock market (NSE/BSE). Powered by a lightweight Python Flask backend and a highly polished glassmorphic frontend, it bridges the gap between simple stock trackers and institutional-grade algorithmic research platforms.

## Problem Statement
Traditional retail stock dashboards focus solely on real-time price tracking, lacking the depth required for meaningful fundamental analysis. StockPulse Analyst solves this by offering a transparent, quantitative scoring system, macroeconomic benchmarking, peer comparisons, and historical algorithmic backtesting within a single, highly performant interface.

## Key Features
- **Stock Screener**: Robust, high-speed fundamental filtering utilizing an in-memory cached universe of top Indian constituents.
- **StockPulse Score**: A custom 0-100 quantitative algorithmic rating assessing a company's profitability, growth, valuation, health, momentum, and dividend profile.
- **Strategy Backtesting Lab**: Simulate mechanical trading strategies (e.g., 50/200 SMA Crossover) using historical Pandas data processing to generate equity curves and win-rates.
- **Investment Thesis Generation**: Auto-generated analyst summaries that interpret trailing financial data into readable bull/bear cases.
- **Peer & Sector Analysis**: Aggregated macro-views comparing valuation multiples (P/E, ROE) across entire market sectors.
- **Portfolio Analytics**: Built-in virtual portfolio tracking with live P&L benchmarking against major indices.

## Financial Methodology & Formulas
StockPulse relies on strict quantitative aggregation.
- **Profitability (20%)**: Averages normalized Return on Equity (ROE) and Operating Margins.
- **Growth (15%)**: Averages Revenue Growth and Earnings Growth over TTM.
- **Valuation (20%)**: Blends trailing P/E and Price-to-Book. Lower multiples map to higher scores (capped at acceptable thresholds).
- **Health (20%)**: Analyzes Debt/Equity ratio, inversely scoring high-leverage profiles.
- **Momentum (15%)**: Measures 52-week trailing return against a sector-neutral 0% baseline.
- **Dividends (10%)**: Directly correlates to the TTM Dividend Yield.

*All sub-scores are normalized on a 0-100 scale using continuous clamped interpolation against standard market boundaries (e.g. ROE 5% to 25%).*

## Data Sources
Data is sourced entirely via the `yfinance` library, which proxies Yahoo Finance API endpoints. Data includes real-time pricing, historical OHLCV, detailed company profiles, and quarterly financial statements.

## Setup Instructions
1. **Clone the repository**: `git clone https://github.com/YOUR_USERNAME/StockPulse.git`
2. **Install dependencies**: `pip install -r requirements.txt`
3. **Run Server**: `python app.py`
4. **View**: Navigate to `http://127.0.0.1:5050`

## Limitations & Assumptions
- **Predefined Universe**: The Stock Screener limits its universe to the Nifty 50 to prevent severe rate-limiting by Yahoo Finance during batch fetching.
- **Data Gaps**: Yahoo Finance is notoriously inconsistent with specific financial ratios for smaller Indian equities. The app employs `_safe()` fallbacks and renders `N/A` instead of hallucinating metrics.
- **Execution Lag**: Strategy backtests assume execution at the closing price of the signal generation day.
- **Not Financial Advice**: All analytical text and scores are backward-looking quantitative calculations.

*(Screenshots to be added here)*
