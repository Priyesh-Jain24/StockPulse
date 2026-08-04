# StockPulse 📈

StockPulse is a modern, high-performance financial dashboard designed specifically for the Indian stock market (NSE/BSE). Powered by a lightweight Python Flask backend and a sleek vanilla frontend, it offers real-time data, technical charting, and personal portfolio tracking—all enveloped in a stunning glassmorphic dark-mode UI.

### 🌟 Key Features

- **Personalized Market Overview:** A rich home dashboard dynamically fetching real-time telemetry array for 12 of India's biggest market movers (Nifty 50 leaders).
- **TradingView Integration:** Deep technical charting via Lightweight Charts, fully interactive with candlesticks and volume bars.
- **Technical Indicators Engine:** Live-computed dynamic overlay toggles for Simple Moving Averages (`SMA-50`, `SMA-200`) directly on the price chart.
- **Live Portfolio Tracker:** A built-in virtual portfolio built on `localStorage`. Add your positions, input your buy prices, and watch the app instantly calculate your live P&L and daily returns using blazing-fast backend batch payloads.
- **Deep Financials & News:** Instant access to Quarterly Income Statements, Balance Sheets, 52-Week Range Gauges, and the latest aggregated financial news for any ticker.
- **Blazing Fast API (`yfinance`):** The backend is strictly optimized to serve bulk batched price quotes, bringing load times from ~9s down to less than 1.5s.

### 🏗️ Tech Stack

- **Backend:** Python 3, Flask, `yfinance`, Pandas
- **Frontend:** Vanilla HTML5, CSS3 (Glassmorphism), JavaScript
- **Charting:** TradingView Lightweight Charts (`@4.2.1`)
- **Database:** Browser `localStorage` (for persistent Watchlist and Portfolio)

### 🚀 Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/StockPulse.git
   cd StockPulse
   ```
2. **Install dependancies:**
   ```bash
   pip install -r requirements.txt
   ```
3. **Run the server:**
   ```bash
   python app.py
   ```
4. **Open in Browser:** Navigate to `http://127.0.0.1:5050`

---
> *Disclaimer: Data is sourced from the unofficial `yfinance` library. This is intended for personal and educational use only.*
