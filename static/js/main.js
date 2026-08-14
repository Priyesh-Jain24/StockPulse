/* ================================================================
   Stock Dashboard — Frontend Logic
   ================================================================ */

// ----- State ----- //
let currentSymbol = "RELIANCE.NS";
let currentPeriod = "1mo";
let currentCurrencySym = "₹";
let tvChart = null;
let tvCandleSeries = null;
let tvVolumeSeries = null;
let tvSma50Series = null;
let tvSma200Series = null;
let searchTimeout = null;
let refreshInterval = null;

const WATCHLIST_KEY = "stock_dashboard_watchlist";
const PORTFOLIO_KEY = "stock_dashboard_portfolio";

// ----- DOM Refs ----- //
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ----- Init ----- //
document.addEventListener("DOMContentLoaded", () => {
    initSearch();
    initPeriodTabs();
    initWatchlist();
    initFinancialsTabs();
    initIndicators();
    initPortfolio();
    // NOTE: Do NOT init TV chart here — it's in a hidden div and will get 0 dimensions.
    // Chart is lazily initialized inside showDetailView() instead.
    
    // Bind Nav links
    const logo = document.getElementById("nav-logo");
    const navHome = document.getElementById("nav-home");
    const navScreener = document.getElementById("nav-screener");
    const navBacktest = document.getElementById("nav-backtest");

    if (logo) logo.addEventListener("click", showHomeView);
    if (navHome) navHome.addEventListener("click", showHomeView);
    if (navScreener) navScreener.addEventListener("click", showScreenerView);
    if (navBacktest) navBacktest.addEventListener("click", showBacktestView);
    
    initScreenerControls();
    initBacktestControls();

    loadMarketIndices();
    
    // Default load home view instead of a specific stock
    showHomeView();

    // Auto-refresh every 60s for whichever view is active
    refreshInterval = setInterval(() => {
        loadMarketIndices();
        if (document.getElementById("detail-view").style.display === "block") {
            loadStockData(currentSymbol, currentPeriod);
        } else {
            loadFeaturedStocks();
        }
    }, 60000);
});

// ================================================================
// TRADING VIEW CHART INIT
// ================================================================
function initTVChart() {
    const container = document.getElementById('tv-chart');
    if (!container) return;

    try {
        tvChart = LightweightCharts.createChart(container, {
            layout: { 
                background: { type: 'solid', color: 'transparent' }, 
                textColor: '#8b8fa3' 
            },
            grid: { 
                vertLines: { color: 'rgba(255,255,255,0.03)' }, 
                horzLines: { color: 'rgba(255,255,255,0.03)' } 
            },
            rightPriceScale: { 
                borderColor: 'rgba(255,255,255,0.1)' 
            },
            timeScale: { 
                borderColor: 'rgba(255,255,255,0.1)',
                timeVisible: true,
                secondsVisible: false
            }
        });
        
        tvCandleSeries = tvChart.addCandlestickSeries({
            upColor: '#22c55e', 
            downColor: '#ef4444',
            borderDownColor: '#ef4444', 
            borderUpColor: '#22c55e',
            wickDownColor: '#ef4444', 
            wickUpColor: '#22c55e'
        });
        
        tvVolumeSeries = tvChart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '', // set as an overlay
        });
        
        // TV Scale configuration compatible with v4+
        tvChart.priceScale('').applyOptions({
            scaleMargins: { top: 0.8, bottom: 0 },
        });
        
        window.addEventListener('resize', () => {
            tvChart.resize(container.clientWidth, container.clientHeight);
        });
    } catch(e) {
        container.innerHTML = `<div style="color:#ef4444; padding:20px;">Chart Initialization Error: ${e.message}</div>`;
    }
}

// ================================================================
// VIEWS & NAVIGATION
// ================================================================
function setNavActive(id) {
    $$(".nav-links .nav-btn").forEach(n => {
        n.style.color = "var(--text-muted)";
    });
    const el = document.getElementById(id);
    if(el) el.style.color = "white";
}

function showHomeView() {
    const homeView = document.getElementById("home-view");
    const detailView = document.getElementById("detail-view");
    const screenerView = document.getElementById("screener-view");
    const backtestView = document.getElementById("backtest-view");
    
    if (homeView) homeView.style.display = "block";
    if (detailView) detailView.style.display = "none";
    if (screenerView) screenerView.style.display = "none";
    if (backtestView) backtestView.style.display = "none";
    
    setNavActive("nav-home");
    loadFeaturedStocks();
}

function showScreenerView() {
    const homeView = document.getElementById("home-view");
    const detailView = document.getElementById("detail-view");
    const screenerView = document.getElementById("screener-view");
    const backtestView = document.getElementById("backtest-view");
    
    if (homeView) homeView.style.display = "none";
    if (detailView) detailView.style.display = "none";
    if (screenerView) screenerView.style.display = "block";
    if (backtestView) backtestView.style.display = "none";
    
    setNavActive("nav-screener");
    if(!window._screenerDataLoaded) loadScreenerData();
}

function showBacktestView() {
    const homeView = document.getElementById("home-view");
    const detailView = document.getElementById("detail-view");
    const screenerView = document.getElementById("screener-view");
    const backtestView = document.getElementById("backtest-view");
    
    if (homeView) homeView.style.display = "none";
    if (detailView) detailView.style.display = "none";
    if (screenerView) screenerView.style.display = "none";
    if (backtestView) backtestView.style.display = "block";
    
    setNavActive("nav-backtest");
    if(!window._btChart) initBacktestChart();
}

function showDetailView() {
    const homeView = document.getElementById("home-view");
    const detailView = document.getElementById("detail-view");
    const screenerView = document.getElementById("screener-view");
    const backtestView = document.getElementById("backtest-view");
    
    if (homeView) homeView.style.display = "none";
    if (screenerView) screenerView.style.display = "none";
    if (backtestView) backtestView.style.display = "none";
    if (detailView) detailView.style.display = "block";
    
    // Lazily initialize chart the first time detail view is shown
    if (!tvChart) {
        setTimeout(() => initTVChart(), 50);
    } else {
        setTimeout(() => {
            const container = document.getElementById('tv-chart');
            if (container && tvChart) {
                tvChart.resize(container.clientWidth, container.clientHeight);
            }
        }, 50);
    }
}

// ================================================================
// SEARCH
// ================================================================
function initSearch() {
    const input = $("#search-input");
    const dropdown = $("#search-dropdown");

    input.addEventListener("input", (e) => {
        const q = e.target.value.trim();
        clearTimeout(searchTimeout);
        if (q.length < 1) {
            dropdown.classList.remove("active");
            return;
        }
        searchTimeout = setTimeout(() => searchTicker(q), 300);
    });

    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            const q = input.value.trim().toUpperCase();
            if (q) {
                dropdown.classList.remove("active");
                loadStock(q);
                input.value = "";
            }
        }
    });

    // Close dropdown on outside click
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".search-container")) {
            dropdown.classList.remove("active");
        }
    });
}

async function searchTicker(query) {
    const dropdown = $("#search-dropdown");
    try {
        const resp = await fetch(`/api/search/${encodeURIComponent(query)}`);
        const data = await resp.json();
        if (data.results && data.results.length > 0) {
            dropdown.innerHTML = data.results
                .map(
                    (r) => `
                <div class="search-result" data-symbol="${r.symbol}">
                    <span class="search-result__symbol">${r.symbol}</span>
                    <span class="search-result__name">${r.name}</span>
                    <span class="search-result__exchange">${r.exchange}</span>
                </div>`
                )
                .join("");
            dropdown.classList.add("active");

            // Click handlers
            dropdown.querySelectorAll(".search-result").forEach((el) => {
                el.addEventListener("click", () => {
                    loadStock(el.dataset.symbol);
                    dropdown.classList.remove("active");
                    $("#search-input").value = "";
                });
            });
        } else {
            dropdown.classList.remove("active");
        }
    } catch {
        dropdown.classList.remove("active");
    }
}

// ================================================================
// LOAD STOCK
// ================================================================
async function loadStock(symbol) {
    if (searchTimeout) clearTimeout(searchTimeout);
    $("#search-dropdown").innerHTML = "";

    // IMPORTANT: Switch back to detail view from home view
    showDetailView();
    
    currentSymbol = symbol.toUpperCase();
    $("#search-input").value = "";
    
    showLoading(true);
    try {
        await Promise.all([
            loadStockInfo(currentSymbol),
            loadStockData(currentSymbol, currentPeriod),
            loadStockNews(currentSymbol),
            loadStockFinancials(currentSymbol),
        ]);
    } catch (err) {
        showToast(`Failed to load ${currentSymbol}`, "error");
    }
    showLoading(false);
}

// ----- Stock Info ----- //
async function loadStockInfo(symbol) {
    try {
        const resp = await fetch(`/api/stock/${symbol}/info`);
        if (!resp.ok) throw new Error("Not found");
        const d = await resp.json();
        if (d.error) {
            showToast(d.error, "error");
            return;
        }
        renderStockHeader(d);
        renderMetrics(d);
        renderCompanyInfo(d);
        renderKeyStats(d);
        renderStockPulseScore(d);
        renderInvestmentThesis(d);
    } catch (err) {
        showToast(`Error loading info: ${err.message}`, "error");
    }
}

function renderStockHeader(d) {
    const nameEl = $("#stock-name");
    const symbolEl = $("#stock-symbol");
    const metaEl = $("#stock-meta");
    const priceEl = $("#current-price");
    const changeEl = $("#price-change");

    nameEl.textContent = d.longName || d.shortName || d.symbol;
    symbolEl.textContent = d.symbol;
    metaEl.textContent = `${d.exchange} · ${d.currency} · ${d.sector}`;

    // Update currency symbol globally based on stock data
    if (d.currency === "INR") currentCurrencySym = "₹";
    else if (d.currency === "USD") currentCurrencySym = "$";
    else if (d.currency === "EUR") currentCurrencySym = "€";
    else if (d.currency === "GBP") currentCurrencySym = "£";
    else currentCurrencySym = d.currency ? d.currency + " " : "$";

    const price = d.currentPrice;
    const prevClose = d.previousClose;
    priceEl.textContent = price != null ? `${currentCurrencySym}${price.toFixed(2)}` : "—";

    if (price != null && prevClose != null) {
        const change = price - prevClose;
        const changePct = (change / prevClose) * 100;
        const isPos = change >= 0;
        changeEl.className = `price-change ${isPos ? "positive" : "negative"}`;
        changeEl.innerHTML = `
            <span class="price-change__arrow">${isPos ? "▲" : "▼"}</span>
            ${isPos ? "+" : ""}${change.toFixed(2)} (${isPos ? "+" : ""}${changePct.toFixed(2)}%)
        `;
    } else {
        changeEl.textContent = "";
    }
}

function renderMetrics(d) {
    setMetric("metric-open", d.open);
    setMetric("metric-high", d.dayHigh);
    setMetric("metric-low", d.dayLow);
    setMetric("metric-vol", formatNum(d.volume));
    setMetric("metric-avgvol", formatNum(d.avgVolume));
    setMetric("metric-mktcap", d.marketCapFmt);
}

function setMetric(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val != null ? val : "—";
}

function renderCompanyInfo(d) {
    const el = $("#company-description");
    if (el) el.textContent = d.description || "No description available.";

    const website = $("#company-website");
    if (website && d.website) {
        website.href = d.website;
        website.textContent = d.website.replace(/^https?:\/\//, "");
    }

    setInfo("info-sector", d.sector);
    setInfo("info-industry", d.industry);
    setInfo("info-country", d.country);
}

function renderKeyStats(d) {
    setInfo("info-pe", d.pe != null ? d.pe.toFixed(2) : "N/A");
    setInfo("info-fpe", d.forwardPe != null ? d.forwardPe.toFixed(2) : "N/A");
    setInfo("info-eps", d.eps != null ? `${currentCurrencySym}${d.eps.toFixed(2)}` : "N/A");
    setInfo("info-beta", d.beta != null ? d.beta.toFixed(2) : "N/A");
    setInfo(
        "info-divyield",
        d.dividendYield != null ? `${(d.dividendYield * 100).toFixed(2)}%` : "N/A"
    );
    setInfo("info-50ma", d.fiftyDayAverage != null ? `${currentCurrencySym}${d.fiftyDayAverage.toFixed(2)}` : "N/A");
    setInfo(
        "info-200ma",
        d.twoHundredDayAverage != null ? `${currentCurrencySym}${d.twoHundredDayAverage.toFixed(2)}` : "N/A"
    );

    // Update 52-Week Range Gauge
    const low = d.fiftyTwoWeekLow;
    const high = d.fiftyTwoWeekHigh;
    const cur = d.currentPrice;
    
    if (low != null && high != null && cur != null && high > low) {
        $("#range-52w-low").textContent = `${currentCurrencySym}${low.toFixed(2)}`;
        $("#range-52w-high").textContent = `${currentCurrencySym}${high.toFixed(2)}`;
        
        let pct = ((cur - low) / (high - low)) * 100;
        pct = Math.max(0, Math.min(100, pct)); // clamp 0-100
        $("#range-52w-marker").style.left = `${pct}%`;
    }
}

function setInfo(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val != null ? val : "N/A";
}

function renderStockPulseScore(d) {
    const totalEl = $("#sp-score-total");
    const barsContainer = $("#sp-score-bars");
    
    if(!d || !d.stockpulseScore || !totalEl || !barsContainer) {
        if(totalEl) totalEl.textContent = "N/A";
        if(barsContainer) barsContainer.innerHTML = "<div style='color:var(--text-muted)'>Score data unavailable for this stock.</div>";
        return;
    }
    
    const sc = d.stockpulseScore;
    totalEl.textContent = `${sc.total}/100`;
    
    const renderBar = (label, value) => {
        let color = "#ef4444"; // red
        if (value > 40) color = "#eab308"; // yellow
        if (value > 60) color = "#22c55e"; // green
        
        return `
            <div>
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.85rem;">
                    <span style="color:var(--text-muted);">${label}</span>
                    <span style="font-weight:bold; color:white;">${value}</span>
                </div>
                <div style="width:100%; height:8px; background:rgba(255,255,255,0.05); border-radius:4px; overflow:hidden;">
                    <div style="width:${value}%; height:100%; background:${color};"></div>
                </div>
            </div>
        `;
    };
    
    barsContainer.innerHTML = 
        renderBar("Profitability", sc.profitability) +
        renderBar("Growth", sc.growth) +
        renderBar("Valuation", sc.valuation) +
        renderBar("Financial Health", sc.health) +
        renderBar("Price Momentum", sc.momentum) +
        renderBar("Dividend Profile", sc.dividend);
}

// ----- Stock Data (Charts) ----- //
async function loadStockData(symbol, period) {
    try {
        const resp = await fetch(`/api/stock/${symbol}?period=${period}`);
        if (!resp.ok) throw new Error("No data");
        const d = await resp.json();
        if (d.error) {
            showToast(d.error, "error");
            return;
        }
        
        // Ensure TV chart exists
        if (!tvChart) return;
        
        // Parse dates into TV expected format
        const candleData = [];
        const volumeData = [];
        const uniqueTimes = new Set();
        
        for (let i = 0; i < d.dates.length; i++) {
            const dtStr = d.dates[i];
            
            // Format strictly to TradingView requirements
            let timeVal;
            if (currentPeriod === "1d" || currentPeriod === "5d") {
                // Intraday requires unix timestamps
                const isoStr = dtStr.replace(" ", "T") + "Z"; // Assume UTC representation to ensure no NaN
                timeVal = Math.floor(new Date(isoStr).getTime() / 1000);
            } else {
                // Daily/Weekly/Monthly strictly requires YYYY-MM-DD string
                timeVal = dtStr.split(" ")[0]; 
            }
            
            // TV requires unique, monotonically increasing times
            if (uniqueTimes.has(timeVal)) continue;
            uniqueTimes.add(timeVal);
            
            if (d.open[i] == null || d.close[i] == null) continue;
            
            candleData.push({
                time: timeVal,
                open: d.open[i],
                high: d.high[i],
                low: d.low[i],
                close: d.close[i]
            });
            
            volumeData.push({
                time: timeVal,
                value: d.volume[i],
                color: d.close[i] >= d.open[i] ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'
            });
        }
        
        // Ensure strictly sorted times
        candleData.sort((a,b) => a.time > b.time ? 1 : -1);
        volumeData.sort((a,b) => a.time > b.time ? 1 : -1);
        
        // Apply formatted currency for this symbol
        tvChart.applyOptions({
            localization: {
                priceFormatter: price => `${currentCurrencySym}${price.toFixed(2)}`
            }
        });
        
        try {
            tvCandleSeries.setData(candleData);
            tvVolumeSeries.setData(volumeData);
            
            // SMA Indicators
            const btn50 = document.getElementById("btn-sma-50");
            const btn200 = document.getElementById("btn-sma-200");
            
            if (btn50 && btn50.classList.contains("active")) {
                if (!tvSma50Series) tvSma50Series = tvChart.addLineSeries({ color: '#00e5ff', lineWidth: 2, crosshairMarkerVisible: false });
                tvSma50Series.setData(calculateSMA(candleData, 50));
            } else if (tvSma50Series) {
                tvChart.removeSeries(tvSma50Series);
                tvSma50Series = null;
            }
            
            if (btn200 && btn200.classList.contains("active")) {
                if (!tvSma200Series) tvSma200Series = tvChart.addLineSeries({ color: '#b084f4', lineWidth: 2, crosshairMarkerVisible: false });
                tvSma200Series.setData(calculateSMA(candleData, 200));
            } else if (tvSma200Series) {
                tvChart.removeSeries(tvSma200Series);
                tvSma200Series = null;
            }

            tvChart.timeScale().fitContent();
        } catch (setErr) {
            console.error("SetData error", setErr);
        }
        
    } catch (err) {
        showToast(`Chart error: ${err.message}`, "error");
        document.getElementById('tv-chart').innerHTML = `<div style="color:#ef4444; padding:20px;">Chart Rendering Error: ${err.message}</div>`;
    }
}

// ================================================================
// TECHNICAL INDICATORS
// ================================================================
function initIndicators() {
    const btn50 = document.getElementById("btn-sma-50");
    const btn200 = document.getElementById("btn-sma-200");
    if (btn50) {
        btn50.addEventListener("click", () => {
            btn50.classList.toggle("active");
            if (currentSymbol && document.getElementById("detail-view").style.display !== "none") {
                loadStockData(currentSymbol, currentPeriod);
            }
        });
    }
    if (btn200) {
        btn200.addEventListener("click", () => {
            btn200.classList.toggle("active");
            if (currentSymbol && document.getElementById("detail-view").style.display !== "none") {
                loadStockData(currentSymbol, currentPeriod);
            }
        });
    }
}

function calculateSMA(data, period) {
    const sma = [];
    for (let i = 0; i < data.length; i++) {
        if (i < period - 1) continue;
        let sum = 0;
        for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
        }
        sma.push({ time: data[i].time, value: sum / period });
    }
    return sma;
}

// ================================================================
// PERIOD TABS
// ================================================================
function initPeriodTabs() {
    $$(".period-tab").forEach((tab) => {
        tab.addEventListener("click", () => {
            $$(".period-tab").forEach((t) => t.classList.remove("active"));
            tab.classList.add("active");
            currentPeriod = tab.dataset.period;
            loadStockData(currentSymbol, currentPeriod);
        });
    });
}

// ================================================================
// WATCHLIST
// ================================================================
function initWatchlist() {
    loadWatchlistUI();

    // "Add to watchlist" button in nav
    const addBtn = $("#watchlist-add-btn");
    if (addBtn) {
        addBtn.addEventListener("click", () => {
            addToWatchlist(currentSymbol);
        });
    }
}

function getWatchlist() {
    try {
        return JSON.parse(localStorage.getItem(WATCHLIST_KEY)) || [];
    } catch {
        return [];
    }
}

function saveWatchlist(list) {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(list));
}

function addToWatchlist(symbol) {
    const list = getWatchlist();
    if (list.find((s) => s === symbol)) {
        showToast(`${symbol} is already in your watchlist`, "info");
        return;
    }
    list.push(symbol);
    saveWatchlist(list);
    showToast(`${symbol} added to watchlist`, "success");
    loadWatchlistUI();
}

function removeFromWatchlist(symbol) {
    let list = getWatchlist();
    list = list.filter((s) => s !== symbol);
    saveWatchlist(list);
    loadWatchlistUI();
    showToast(`${symbol} removed`, "info");
}

async function loadWatchlistUI() {
    const container = $("#watchlist-list");
    const list = getWatchlist();

    if (list.length === 0) {
        container.innerHTML = `
            <div class="watchlist-empty">
                <div class="watchlist-empty__icon">☆</div>
                <p>No stocks in watchlist</p>
                <p style="margin-top:4px; font-size:0.78rem">Click ＋ to add the current stock</p>
            </div>`;
        return;
    }

    // Show placeholders first
    container.innerHTML = list
        .map(
            (s) => `
        <div class="watchlist-item glass" data-symbol="${s}" id="wl-${s}">
            <div class="watchlist-item__left">
                <span class="watchlist-item__symbol">${s}</span>
                <span class="watchlist-item__name">Loading…</span>
            </div>
            <div class="watchlist-item__right">
                <span class="watchlist-item__price"><span class="inline-spinner"></span></span>
                <span class="watchlist-item__change">—</span>
            </div>
            <button class="watchlist-remove" title="Remove" data-symbol="${s}">✕</button>
        </div>`
        )
        .join("");

    // Attach click handlers
    container.querySelectorAll(".watchlist-item").forEach((el) => {
        el.addEventListener("click", (e) => {
            if (e.target.closest(".watchlist-remove")) return;
            loadStock(el.dataset.symbol);
        });
    });

    container.querySelectorAll(".watchlist-remove").forEach((btn) => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            removeFromWatchlist(btn.dataset.symbol);
        });
    });

    // Fetch prices asynchronously
    for (const sym of list) {
        fetchWatchlistPrice(sym);
    }
}

async function fetchWatchlistPrice(symbol) {
    try {
        const resp = await fetch(`/api/stock/${symbol}/info`);
        const d = await resp.json();
        const el = document.getElementById(`wl-${symbol}`);
        if (!el) return;

        const nameEl = el.querySelector(".watchlist-item__name");
        const priceEl = el.querySelector(".watchlist-item__price");
        const changeEl = el.querySelector(".watchlist-item__change");

        nameEl.textContent = d.shortName || symbol;
        const price = d.currentPrice;
        const prev = d.previousClose;
        
        // Use proper currency for watchlist items based on the data
        let watchCurrency = "$";
        if (d.currency === "INR") watchCurrency = "₹";
        else if (d.currency === "EUR") watchCurrency = "€";
        else if (d.currency === "GBP") watchCurrency = "£";
        else if (d.currency) watchCurrency = d.currency + " ";
        
        priceEl.textContent = price != null ? `${watchCurrency}${price.toFixed(2)}` : "—";

        if (price != null && prev != null) {
            const pct = ((price - prev) / prev) * 100;
            const isPos = pct >= 0;
            changeEl.className = `watchlist-item__change ${isPos ? "positive" : "negative"}`;
            changeEl.textContent = `${isPos ? "+" : ""}${pct.toFixed(2)}%`;
        }
    } catch {
        // silently fail for individual watchlist items
    }
}

// ================================================================
// ADVANCED COMPONENTS (NEWS, FINANCIALS, INDICES)
// ================================================================

async function loadMarketIndices() {
    try {
        const resp = await fetch("/api/market/indices");
        const data = await resp.json();
        const container = $("#market-ticker-content");
        if (!container || !Array.isArray(data)) return;

        // Duplicate data a few times for continuous marquee effect
        const doubled = [...data, ...data, ...data, ...data];
        
        container.innerHTML = doubled.map(d => {
            const isUp = d.price >= d.prev;
            const diff = d.price - d.prev;
            const pct = (diff / d.prev) * 100;
            const cls = isUp ? "up" : "down";
            const sign = isUp ? "+" : "";
            
            return `
                <div class="marquee-item">
                    <span class="marquee-item__name">${d.name}</span>
                    <span class="marquee-item__price">${d.price.toFixed(2)}</span>
                    <span class="marquee-item__change ${cls}">${sign}${pct.toFixed(2)}%</span>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Failed to load market indices", err);
    }
}

async function loadStockNews(symbol) {
    const container = $("#sidebar-news");
    if (!container) return;
    
    container.innerHTML = `<div class="watchlist-empty"><span class="inline-spinner"></span><p>Loading news...</p></div>`;
    try {
        const resp = await fetch(`/api/stock/${symbol}/news`);
        const news = await resp.json();
        
        if (!news || news.length === 0) {
            container.innerHTML = `<div class="watchlist-empty"><p>No recent news found.</p></div>`;
            return;
        }

        container.innerHTML = news.map(n => {
            const date = n.time ? new Date(n.time).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : "";
            
            return `
                <a href="${n.link}" target="_blank" class="news-item">
                    <div class="news-item__title">${n.title}</div>
                    <div class="news-item__meta">
                        <span>${n.publisher}</span>
                        <span>${date}</span>
                    </div>
                </a>
            `;
        }).join("");
    } catch (err) {
        container.innerHTML = `<div class="watchlist-empty"><p>Error loading news.</p></div>`;
    }
}

async function loadFeaturedStocks() {
    const container = document.getElementById("featured-grid");
    if (!container) return;
    try {
        const resp = await fetch("/api/market/featured");
        const data = await resp.json();
        if (!Array.isArray(data)) return;
        
        container.innerHTML = data.map(d => {
            const isUp = d.price >= d.prev;
            const diff = d.price - d.prev;
            const pct = (diff / d.prev) * 100;
            const cls = isUp ? "up" : "down";
            const sign = isUp ? "+" : "";
            
            return `
                <div class="featured-card" onclick="loadStock('${d.symbol}')">
                    <div class="f-card-header">
                        <span class="f-card-symbol">${d.symbol}</span>
                        <span class="f-card-name">${d.name}</span>
                    </div>
                    <div class="f-card-price">₹${d.price.toFixed(2)}</div>
                    <div class="f-card-change ${cls}">${sign}${diff.toFixed(2)} (${sign}${pct.toFixed(2)}%)</div>
                </div>
            `;
        }).join("");
    } catch (err) {
        console.error("Failed to load featured stocks", err);
        container.innerHTML = `<div style="grid-column: 1/-1; padding: 20px; text-align: center; color: #ef4444;">Error fetching data: Request timeout. Please refresh.</div>`;
    }
}

function initFinancialsTabs() {
    $$(".fin-tab").forEach(btn => {
        btn.addEventListener("click", () => {
            $$(".fin-tab").forEach(b => b.classList.remove("active"));
            $$(".financials-table-wrapper").forEach(w => w.style.display = "none");
            
            btn.classList.add("active");
            document.getElementById(`fin-table-${btn.dataset.target}`).style.display = "block";
        });
    });
}

function renderFinancialsTable(type, data) {
    const headEl = document.getElementById(`fin-${type}-head`);
    const bodyEl = document.getElementById(`fin-${type}-body`);
    if (!headEl || !bodyEl) return;

    if (!data || Object.keys(data).length === 0) {
        headEl.innerHTML = "";
        bodyEl.innerHTML = `<tr><td style="text-align:center; padding: 20px;">No data available</td></tr>`;
        return;
    }

    const dates = Object.keys(data).sort().reverse();
    
    // Header
    let theadHtml = "<tr><th>Metric</th>";
    for (const date of dates) {
        theadHtml += `<th>${date}</th>`;
    }
    theadHtml += "</tr>";
    headEl.innerHTML = theadHtml;

    // Get all metrics row headers
    const metricsSet = new Set();
    Object.values(data).forEach(col => {
        Object.keys(col).forEach(m => metricsSet.add(m));
    });
    
    // Some common metrics to put at the top
    const orderPriority = ["Total Revenue", "Operating Revenue", "Gross Profit", "Net Income", "Total Assets", "Total Liabilities Net Minority Interest", "Total Equity Gross Minority Interest"];
    
    const allMetrics = Array.from(metricsSet).sort((a, b) => {
        const idxA = orderPriority.indexOf(a);
        const idxB = orderPriority.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
    });

    // Body
    let tbodyHtml = "";
    for (const metric of allMetrics) {
        tbodyHtml += `<tr><td>${metric}</td>`;
        for (const date of dates) {
            tbodyHtml += `<td>${data[date][metric] || "—"}</td>`;
        }
        tbodyHtml += `</tr>`;
    }
    bodyEl.innerHTML = tbodyHtml;
}

async function loadStockFinancials(symbol) {
    const section = $("#financials-section");
    if (!section) return;
    try {
        const resp = await fetch(`/api/stock/${symbol}/financials`);
        const data = await resp.json();
        
        if (data.error) {
            section.style.display = "none";
            return;
        }

        const hasIncome = Object.keys(data.income_statement || {}).length > 0;
        const hasBalance = Object.keys(data.balance_sheet || {}).length > 0;
        
        if (!hasIncome && !hasBalance) {
            section.style.display = "none";
            return;
        }

        section.style.display = "block";
        renderFinancialsTable("income", data.income_statement);
        renderFinancialsTable("balance", data.balance_sheet);
    } catch (err) {
        section.style.display = "none";
    }
}

// ================================================================
// PORTFOLIO TRACKER
// ================================================================
function initPortfolio() {
    const addBtn = $("#add-holding-btn");
    const saveBtn = $("#save-holding-btn");
    const cancelBtn = $("#cancel-holding-btn");
    const form = $("#add-holding-form");

    if (addBtn) addBtn.addEventListener("click", () => form.style.display = "block");
    if (cancelBtn) cancelBtn.addEventListener("click", () => form.style.display = "none");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const sym = $("#holding-sym").value.trim().toUpperCase();
            const sharesStr = $("#holding-shares").value.trim();
            const priceStr = $("#holding-price").value.trim();
            
            if (!sym || !sharesStr || !priceStr) {
                showToast("Please fill all fields", "error");
                return;
            }
            
            const shares = parseFloat(sharesStr);
            const price = parseFloat(priceStr);
            
            if (isNaN(shares) || shares <= 0 || isNaN(price) || price < 0) {
                showToast("Values must be positive numbers", "error");
                return;
            }
            
            addPortfolioHolding(sym, shares, price);
            $("#holding-sym").value = "";
            $("#holding-shares").value = "";
            $("#holding-price").value = "";
            form.style.display = "none";
        });
    }
    
    loadPortfolioUI();
}

function getPortfolio() {
    try { return JSON.parse(localStorage.getItem(PORTFOLIO_KEY)) || []; } catch { return []; }
}

function savePortfolio(list) {
    localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(list));
}

function addPortfolioHolding(symbol, shares, buyPrice) {
    const list = getPortfolio();
    list.push({ symbol, shares, buyPrice, id: Date.now().toString() });
    savePortfolio(list);
    showToast(`Added ${shares} shares of ${symbol}`, "success");
    loadPortfolioUI();
}

function removeHolding(id) {
    let list = getPortfolio();
    list = list.filter(h => h.id !== id);
    savePortfolio(list);
    loadPortfolioUI();
}

async function loadPortfolioUI() {
    const container = $("#portfolio-holdings");
    if (!container) return;
    
    const list = getPortfolio();
    if (list.length === 0) {
        container.innerHTML = `<div style="color: var(--text-muted); opacity: 0.7; grid-column: 1/-1;">No positions yet. Add one above!</div>`;
        $("#port-total-value").textContent = "₹0.00";
        $("#port-total-gain").textContent = "—";
        $("#port-total-gain").className = "metric-card__value";
        $("#port-today-return").textContent = "—";
        $("#port-today-return").className = "metric-card__value";
        return;
    }
    
    // Grab unique symbols to fetch prices efficiently via our batch endpoint
    const symbols = Array.from(new Set(list.map(h => h.symbol))).join(",");
    let quotesMap = {};
    
    try {
        const resp = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols)}`);
        const data = await resp.json();
        if (Array.isArray(data)) {
            data.forEach(q => quotesMap[q.symbol] = { price: q.price, prev: q.prev });
        }
    } catch {
        // silent fail on fetch, use 0
    }
    
    let totalVal = 0;
    let totalCost = 0;
    let totalPrevVal = 0; // Value as of yesterday close
    
    const cardsHtml = list.map(h => {
        const q = quotesMap[h.symbol] || { price: h.buyPrice, prev: h.buyPrice };
        const currentPrice = q.price != null ? q.price : h.buyPrice;
        const prevPrice = q.prev != null ? q.prev : h.buyPrice;
        
        const costBasis = h.shares * h.buyPrice;
        const currentValue = h.shares * currentPrice;
        const previousValue = h.shares * prevPrice;
        
        totalCost += costBasis;
        totalVal += currentValue;
        totalPrevVal += previousValue;
        
        const gain = currentValue - costBasis;
        const gainPct = (gain / costBasis) * 100;
        const isPos = gain >= 0;
        const sign = isPos ? "+" : "";
        
        return `
            <div class="featured-card portfolio-holding-card">
                <div class="holding-head">
                    <span class="f-card-symbol" style="cursor:pointer;" onclick="loadStock('${h.symbol}')">${h.symbol}</span>
                    <button class="holding-del" onclick="removeHolding('${h.id}')" title="Remove">✕</button>
                </div>
                <div class="holding-stats">
                    <div class="holding-stat-unit">
                        <span style="font-size:0.75rem; color:var(--text-muted)">Shares</span>
                        <span class="holding-stat-val">${h.shares}</span>
                    </div>
                    <div class="holding-stat-unit">
                        <span style="font-size:0.75rem; color:var(--text-muted)">Avg Price</span>
                        <span class="holding-stat-val">${h.buyPrice.toFixed(2)}</span>
                    </div>
                </div>
                <div style="margin-top:14px; padding-top:14px; border-top:1px solid var(--border-glass);">
                    <div style="font-size:0.75rem; color:var(--text-muted);">Current Value</div>
                    <div style="display:flex; justify-content:space-between; align-items:baseline;">
                        <span class="f-card-price" style="font-size:1.4rem;">${currentValue.toFixed(2)}</span>
                        <span class="f-card-change ${isPos?'up':'down'}">${sign}${gain.toFixed(2)} (${sign}${gainPct.toFixed(2)}%)</span>
                    </div>
                </div>
            </div>
        `;
    }).join("");
    
    container.innerHTML = cardsHtml;
    
    // Update Summaries
    const dailyGain = totalVal - totalPrevVal;
    const dailyGainPct = totalPrevVal > 0 ? (dailyGain / totalPrevVal) * 100 : 0;
    const totalGain = totalVal - totalCost;
    const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    
    $("#port-total-value").textContent = totalVal.toFixed(2);
    
    const setupMetric = (el, val, pct) => {
        const isPos = val >= 0;
        el.textContent = `${isPos?"+":""}${val.toFixed(2)} (${isPos?"+":""}${pct.toFixed(2)}%)`;
        el.className = `metric-card__value ${isPos?"positive":"negative"}`;
    };
    
    setupMetric($("#port-total-gain"), totalGain, totalGainPct);
    setupMetric($("#port-today-return"), dailyGain, dailyGainPct);
}

// ================================================================
// HELPERS
// ================================================================
function formatNum(n) {
    if (n == null) return "—";
    const abs = Math.abs(n);
    if (abs >= 1e12) return (n / 1e12).toFixed(2) + "T";
    if (abs >= 1e9) return (n / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return (n / 1e3).toFixed(2) + "K";
    return n.toString();
}

function showLoading(on) {
    const overlay = $("#loading-overlay");
    if (overlay) {
        overlay.classList.toggle("active", on);
    }
}

function showToast(msg, type = "info") {
    const container = $("#toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === "success" ? "✓" : type === "error" ? "✕" : "ℹ"}</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// ================================================================
// SCREENER
// ================================================================
window._screenerDataLoaded = false;
window._screenerActiveData = [];
window._screenerOriginalData = [];
window._screenerSortBy = "marketCap";
window._screenerSortAsc = false;
let screenerRefreshTimeout = null;

function initScreenerControls() {
    const sectorFilter = $("#screener-filter-sector");
    const peFilter = $("#screener-filter-pe");
    const roeFilter = $("#screener-filter-roe");
    const resetBtn = $("#screener-reset-btn");
    const refreshBtn = $("#screener-refresh-btn");
    
    if(!sectorFilter) return;

    const applyFilters = () => {
        const sf = sectorFilter.value;
        const pef = peFilter.value;
        const roef = roeFilter.value;
        
        window._screenerActiveData = window._screenerOriginalData.filter(d => {
            if (sf && d.sector !== sf) return false;
            
            if (pef) {
                if(d.pe == null) return false;
                if(pef === "<15" && d.pe >= 15) return false;
                if(pef === "<25" && d.pe >= 25) return false;
                if(pef === ">25" && d.pe <= 25) return false;
            }
            
            if (roef) {
                const roePct = d.roe * 100;
                if(d.roe == null) return false;
                if(roef === ">10" && roePct <= 10) return false;
                if(roef === ">15" && roePct <= 15) return false;
                if(roef === ">20" && roePct <= 20) return false;
            }
            
            return true;
        });
        
        applyScreenerSort();
    };

    sectorFilter.addEventListener("change", applyFilters);
    peFilter.addEventListener("change", applyFilters);
    roeFilter.addEventListener("change", applyFilters);
    
    resetBtn.addEventListener("click", () => {
        sectorFilter.value = "";
        peFilter.value = "";
        roeFilter.value = "";
        applyFilters();
    });
    
    refreshBtn.addEventListener("click", () => {
        window._screenerDataLoaded = false;
        loadScreenerData();
    });

    $$("#screener-table th[data-sort]").forEach(th => {
        th.addEventListener("click", () => {
            const field = th.dataset.sort;
            if (window._screenerSortBy === field) {
                window._screenerSortAsc = !window._screenerSortAsc;
            } else {
                window._screenerSortBy = field;
                window._screenerSortAsc = (field === 'symbol' || field === 'name' || field === 'sector') ? true : false;
            }
            applyScreenerSort();
        });
    });
}

function applyScreenerSort() {
    const field = window._screenerSortBy;
    const asc = window._screenerSortAsc;
    const mult = asc ? 1 : -1;
    
    window._screenerActiveData.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];
        
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (valA == null && valB == null) return 0;
        
        if (typeof valA === "string") return valA.localeCompare(valB) * mult;
        return (valA - valB) * mult;
    });
    
    renderScreenerTable(window._screenerActiveData);
}

async function loadScreenerData() {
    const tbody = $("#screener-tbody");
    if(!tbody) return;
    
    if(!window._screenerDataLoaded) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;"><div class="inline-spinner"></div> Loading Screener Data... (This takes a moment during initial boot)</td></tr>`;
    }

    try {
        const resp = await fetch("/api/screener");
        const json = await resp.json();
        
        if (json.status === "loading") {
            // Still loading on backend, poll again in 2 seconds
            if (!screenerRefreshTimeout) {
                screenerRefreshTimeout = setTimeout(() => {
                    screenerRefreshTimeout = null;
                    loadScreenerData();
                }, 2000);
            }
            return;
        }
        
        window._screenerOriginalData = json.data;
        window._screenerDataLoaded = true;
        
        // Populate sector filter dropdown
        const sectorSelect = $("#screener-filter-sector");
        if (sectorSelect && sectorSelect.options.length <= 1) {
            const sectors = [...new Set(json.data.map(d => d.sector).filter(s => s && s!=="N/A"))].sort();
            sectors.forEach(s => {
                const opt = document.createElement("option");
                opt.value = opt.textContent = s;
                sectorSelect.appendChild(opt);
            });
        }

        // Trigger filters & sort which renders the table
        // We manually call applyFilters logic
        const event = new Event('change');
        $("#screener-filter-sector").dispatchEvent(event);
        
    } catch(err) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: #ef4444;">Failed to load screener data.</td></tr>`;
    }
}

function renderScreenerTable(data) {
    const tbody = $("#screener-tbody");
    if(!tbody) return;
    
    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">No stocks match the selected criteria.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = data.map(d => {
        const p = d.price != null ? d.price.toFixed(2) : "—";
        const pe = d.pe != null ? d.pe.toFixed(2) : "—";
        const roe = d.roe != null ? (d.roe * 100).toFixed(2) + "%" : "—";
        const revGW = d.revenueGrowth != null ? (d.revenueGrowth * 100).toFixed(2) + "%" : "—";
        
        let fgClass = "";
        let fyReturnHtml;
        if(d.fiftyTwoWeekReturn != null) {
            const isPos = d.fiftyTwoWeekReturn >= 0;
            fgClass = isPos ? "positive" : "negative";
            fyReturnHtml = `<span class="${fgClass}">${isPos?"+":""}${(d.fiftyTwoWeekReturn*100).toFixed(2)}%</span>`;
        } else {
            fyReturnHtml = "—";
        }
        
        return `
            <tr style="cursor: pointer;" onclick="loadStock('${d.symbol}')">
                <td style="font-weight: bold; color: white;">${d.symbol}</td>
                <td><div style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${d.name}</div></td>
                <td style="color: var(--text-muted);">${d.sector}</td>
                <td class="numeric">${p}</td>
                <td class="numeric">${pe}</td>
                <td class="numeric">${roe}</td>
                <td class="numeric">${revGW}</td>
                <td class="numeric">${fyReturnHtml}</td>
            </tr>
        `;
    }).join("");
}

// ================================================================
// INVESTMENT THESIS & BACKTESTING
// ================================================================

function renderInvestmentThesis(d) {
    const container = $("#thesis-content");
    if (!container) return;
    
    if(!d || !d.stockpulseScore) {
        container.innerHTML = "Not enough data to automatically generate an investment thesis.";
        return;
    }
    
    const sc = d.stockpulseScore;
    let thesis = [];
    
    // Growth
    if (sc.growth > 75) thesis.push(`<b>Strong Growth Trajectory:</b> ${d.shortName} exhibits excellent top and bottom-line momentum relative to its peers.`);
    else if (sc.growth < 30) thesis.push(`<b>Growth Concerns:</b> Revenue and earnings expansion appears sluggish, signaling potential maturity or headwinds in the current macro environment.`);
    
    // Valuation
    if (sc.valuation > 70) thesis.push(`<b>Attractive Valuation:</b> Trading at a P/E of ${d.pe ? d.pe.toFixed(1) : 'N/A'}, the stock appears fundamentally undervalued compared to the broader market index.`);
    else if (sc.valuation < 30) thesis.push(`<b>Premium Pricing:</b> With a high valuation multiple, the market has likely priced in optimistic future growth, inherently increasing execution risk.`);
    
    // Health / Profitability
    if (sc.profitability > 70 && sc.health > 70) thesis.push(`<b>Robust Fundamentals:</b> High operating margins coupled with a very strong balance sheet makes this a highly defensive and resilient equity.`);
    else if (sc.health < 40) thesis.push(`<b>Leverage Risks:</b> Higher than average debt levels require careful monitoring of debt-servicing capability in high interest-rate environments.`);
    
    if (sc.dividend > 75) thesis.push(`<b>Income Generating:</b> A strong dividend yield makes this an attractive consideration for yield-seeking portfolios.`);
    
    if (thesis.length === 0) {
        thesis.push(`<b>Balanced Profile:</b> The company presents an average fundamental breakdown with no extreme outliers in growth, valuation, or profitability.`);
    }
    
    container.innerHTML = `<ul style='padding-left:20px'><li>` + thesis.join("</li><li style='margin-top:10px;'>") + `</li></ul>
    <div style='margin-top:15px; font-size:0.8rem; color:var(--text-muted);'><i>* Automaton-generated analysis based on mathematical scoring of trailing financial data. Not investment advice.</i></div>`;
}

let _btChart = null;
let _btLineSeries = null;

function initBacktestChart() {
    const container = document.getElementById('backtest-chart');
    if (!container) return;
    try {
        _btChart = LightweightCharts.createChart(container, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8b8fa3' },
            grid: { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } },
            timeScale: { borderColor: 'rgba(255,255,255,0.1)', timeVisible: true }
        });
        
        _btLineSeries = _btChart.addAreaSeries({
            lineColor: '#00e5ff', topColor: 'rgba(0, 229, 255, 0.4)', bottomColor: 'rgba(0, 229, 255, 0.0)'
        });
        
        window._btChart = _btChart;
        window.addEventListener('resize', () => _btChart.resize(container.clientWidth, container.clientHeight));
    } catch(e) {}
}

function initBacktestControls() {
    const btn = $("#run-backtest-btn");
    if(!btn) return;
    
    btn.addEventListener("click", async () => {
        const sym = $("#backtest-sym").value || "RELIANCE.NS";
        const cap = $("#backtest-cap").value || 100000;
        const resultsDiv = $("#backtest-results");
        
        btn.textContent = "Running...";
        btn.disabled = true;
        
        try {
            const resp = await fetch(`/api/backtest?symbol=${sym}&capital=${cap}`);
            const data = await resp.json();
            
            if(data.error) {
                showToast(data.error, "error");
                btn.textContent = "Run Simulation";
                btn.disabled = false;
                return;
            }
            
            // Render Chart
            if(_btLineSeries && data.equity_curve) {
                _btLineSeries.setData(data.equity_curve);
                _btChart.timeScale().fitContent();
            }
            
            // Render Stats
            const retClass = data.total_return_pct >= 0 ? "positive" : "negative";
            const bnhClass = data.benchmark_return_pct >= 0 ? "positive" : "negative";
            
            resultsDiv.style.display = "flex";
            resultsDiv.innerHTML = `
                <div class="metric-card glass fade-in" style="flex:1;">
                    <span class="metric-card__label">Final Capital</span>
                    <span class="metric-card__value">₹${data.final_capital.toFixed(2)}</span>
                </div>
                <div class="metric-card glass fade-in" style="flex:1;">
                    <span class="metric-card__label">Strategy Return</span>
                    <span class="metric-card__value ${retClass}">${data.total_return_pct.toFixed(2)}%</span>
                </div>
                <div class="metric-card glass fade-in" style="flex:1;">
                    <span class="metric-card__label">Buy & Hold Return</span>
                    <span class="metric-card__value ${bnhClass}">${data.benchmark_return_pct.toFixed(2)}%</span>
                </div>
                <div class="metric-card glass fade-in" style="flex:1;">
                    <span class="metric-card__label">Win Rate (${data.total_trades} trades)</span>
                    <span class="metric-card__value">${data.win_rate.toFixed(1)}%</span>
                </div>
            `;
            
        } catch(e) {
            showToast("Failed to run backtest.", "error");
        }
        
        btn.textContent = "Run Simulation";
        btn.disabled = false;
    });
}
