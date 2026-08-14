import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createChart } from 'lightweight-charts';

const API_BASE = "http://localhost:5050/api";

const _fmt = (val, type = 'num', decimals = 2) => {
    if (val === null || val === undefined) return 'N/A';
    if (type === 'percent') return (val * 100).toFixed(decimals) + '%';
    if (type === 'price') return '₹' + val.toLocaleString(undefined, {minimumFractionDigits: decimals});
    if (type === 'money') return '₹' + val; 
    if (type === 'mult') return val.toFixed(decimals) + 'x';
    return val.toLocaleString(undefined, {minimumFractionDigits: decimals});
}

function SectionHeader({ title }) {
    return <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>{title}</h2>;
}

function ScoreBar({ label, value, weight, expl }) {
  let color = "var(--negative)"; 
  if (value > 40) color = "#eab308";
  if (value > 60) color = "var(--positive)";
  
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span style={{ color: 'var(--text-color)', fontSize: '0.85rem' }}>{label} <span style={{color:'var(--text-muted)', fontSize:'0.75rem'}}>({weight})</span></span>
        <span className="tabular-nums" style={{ color: 'white', fontSize: '0.9rem', fontWeight: 500 }}>{value}/100</span>
      </div>
      <div style={{ width: '100%', height: '6px', background: 'var(--bg-3)', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color }}></div>
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>{expl}</div>
    </div>
  );
}

function DetailRow({ label, value, type = 'num', dec = 2, invertColor = false }) {
    let color = 'white';
    if (type === 'percent' && value !== null && value !== undefined) {
        if (value > 0) color = invertColor ? 'var(--negative)' : 'var(--positive)';
        else if (value < 0) color = invertColor ? 'var(--negative)' : 'var(--negative)';
    }
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{label}</span>
            <span className="tabular-nums" style={{ color: color, fontWeight: 500, fontSize: '0.9rem' }}>{_fmt(value, type, dec)}</span>
        </div>
    );
}

export default function StockDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  
  const [data, setData] = useState(null);
  const [financials, setFinancials] = useState(null);
  const [peers, setPeers] = useState([]);
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inPortfolio, setInPortfolio] = useState(false);
  
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null);
  const seriesRef = useRef(null);
  const [chartPeriod, setChartPeriod] = useState('1y');
  const [histData, setHistData] = useState([]);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('stockpulse_portfolio') || '[]');
    setInPortfolio(Boolean(saved.find(s => s.symbol === symbol)));

    setLoading(true);
    
    Promise.all([
        fetch(`${API_BASE}/stock/${symbol}/info`).then(r => r.json()),
        fetch(`${API_BASE}/screener`).then(r => r.json()),
        fetch(`${API_BASE}/stock/${symbol}/financials`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/stock/${symbol}/news`).then(r => r.json()).catch(() => [])
    ]).then(([info, scr, fin, nw]) => {
        setData(info);
        if (info.sector && info.sector !== 'N/A') {
            setPeers(scr.data.filter(p => p.sector === info.sector && p.symbol !== symbol).slice(0, 4));
        }
        setFinancials(fin);
        setNews(nw);
        setLoading(false);
    }).catch(() => setLoading(false));

  }, [symbol]);

  // Chart injection
  useEffect(() => {
    if (loading || !chartContainerRef.current) return;
    
    if (!chartInstance.current) {
        chartInstance.current = createChart(chartContainerRef.current, {
            layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8B949E' },
            grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
            timeScale: { borderColor: '#30363D' },
            rightPriceScale: { borderColor: '#30363D' }
        });
        seriesRef.current = chartInstance.current.addAreaSeries({
            lineColor: '#00E6F3', topColor: 'rgba(0, 230, 243, 0.2)', bottomColor: 'rgba(0, 230, 243, 0)'
        });
    }

    fetch(`${API_BASE}/stock/${symbol}?period=${chartPeriod}`)
        .then(r => r.json())
        .then(hist => {
            if(!hist.dates) return;
            const mapped = hist.dates.map((d, i) => ({ time: d.split(" ")[0], value: hist.close[i] }));
            if (seriesRef.current) {
                seriesRef.current.setData(mapped);
                chartInstance.current.timeScale().fitContent();
            }
            setHistData(hist.close);
        });

    const handleResize = () => chartInstance.current?.resize(chartContainerRef.current.clientWidth, 350);
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, [loading, symbol, chartPeriod]);

  const togglePortfolio = () => {
    let saved = JSON.parse(localStorage.getItem('stockpulse_portfolio') || '[]');
    const exists = saved.findIndex(s => s.symbol === symbol);
    if (exists !== -1) {
        saved.splice(exists, 1);
        setInPortfolio(false);
    } else {
        const qty = parseInt(prompt(`Enter quantity for ${symbol}:`, "100"));
        if (!qty) return;
        const avg = parseFloat(prompt(`Enter average buy price (₹):`, data.currentPrice));
        if (!avg) return;
        saved.push({ symbol, qty, avg });
        setInPortfolio(true);
    }
    localStorage.setItem('stockpulse_portfolio', JSON.stringify(saved));
  };


  if (loading) return <div className="fade-in" style={{ padding: '24px', color:'var(--text-muted)' }}>Initializing Terminal Analytics...</div>;
  if (!data || data.error) return <div style={{ color: 'var(--negative)', padding: '24px' }}>Data unavailable for {symbol}.</div>;

  const sc = data.stockpulseScore;
  let scoreLabel = "Neutral";
  if (sc) {
      if (sc.total >= 80) scoreLabel = "Strong";
      else if (sc.total >= 65) scoreLabel = "Attractive";
      else if (sc.total >= 50) scoreLabel = "Neutral";
      else if (sc.total >= 35) scoreLabel = "Weak";
      else scoreLabel = "Very Weak";
  }
  
  const scExpl = sc ? (sc.profitability > 70 && sc.growth > 70 ? "Strong growth and profitability parameters support the rating." : sc.health < 40 ? "Weak financial health parameters limit the overall assessment." : "Mixed fundamental matrix indicates a generalized fair value position.") : "Data unavailable for overall assessment generation.";

  return (
    <div className="fade-in dense-grid" style={{ paddingBottom: '60px' }}>
      
      {/* =======================
          1. STOCK HEADER 
      ======================= */}
      <div className="col-12 glass" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', color: 'white', fontWeight: 600 }}>{data.longName || data.shortName}</h1>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
                <span className="blue" style={{fontWeight:600}}>{data.symbol}</span> • {data.exchange || 'NSE/BSE'}
            </div>
            <div className="tabular-nums" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Market Cap</div>
                    <div style={{ color: 'white', fontWeight: 500 }}>{data.marketCap ? `₹${(data.marketCap/10000000).toFixed(0)}Cr` : 'N/A'}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sector</div>
                    <div style={{ color: 'white', fontWeight: 500 }}>{data.sector}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Beta</div>
                    <div style={{ color: 'white', fontWeight: 500 }}>{_fmt(data.beta)}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>52W Range</div>
                    <div style={{ color: 'white', fontWeight: 500 }}>₹{data.fiftyTwoWeekLow?.toFixed(0)} - ₹{data.fiftyTwoWeekHigh?.toFixed(0)}</div>
                </div>
            </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginBottom: '16px' }}>
                <button className="nav-item" style={{ border: '1px solid var(--border-color)', background:'transparent', cursor:'pointer', fontSize: '0.8rem' }}>+ Add to Watchlist</button>
                <button 
                  onClick={togglePortfolio}
                  style={{ 
                      background: inPortfolio ? 'transparent' : 'var(--text-color)', 
                      color: inPortfolio ? 'var(--text-muted)' : 'black', 
                      border: '1px solid var(--border-color)', 
                      padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, fontSize:'0.8rem'
                  }}
                >
                  {inPortfolio ? 'In Portfolio' : '+ Add to Portfolio'}
                </button>
            </div>
            <div className="tabular-nums" style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white', lineHeight: 1.1 }}>
                ₹{data.currentPrice?.toFixed(2) || 'N/A'}
            </div>
            {data.previousClose && (
                <div className={`tabular-nums ${data.currentPrice >= data.previousClose ? 'positive' : 'negative'}`} style={{ fontSize: '1rem', fontWeight: 500 }}>
                    {data.currentPrice >= data.previousClose ? '+' : ''}{(data.currentPrice - data.previousClose).toFixed(2)} ({(((data.currentPrice - data.previousClose) / data.previousClose) * 100).toFixed(2)}%)
                </div>
            )}
        </div>
      </div>

      {/* =======================
          2. SCORE & FUNDAMENTALS
      ======================= */}
      <div className="col-12 grid-2-cols" style={{ gap: '16px' }}>
          <div className="glass" style={{ padding: '24px' }}>
              <SectionHeader title="StockPulse Quantitative Assessment" />
              {sc ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'white' }} className="tabular-nums">{sc.total}/100</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '24px' }}>
                      Classification: <span style={{ color: 'white', fontWeight: 600 }}>{scoreLabel}</span>
                  </div>
                  
                  <div className="grid-2-cols" style={{ gap: '0 24px' }}>
                    <ScoreBar label="Profitability" value={sc.profitability} weight="20%" expl="Operating margins and efficiency" />
                    <ScoreBar label="Growth" value={sc.growth} weight="15%" expl="Historical revenue & EPS expansion" />
                    <ScoreBar label="Valuation" value={sc.valuation} weight="20%" expl="P/E, P/B relative to peers" />
                    <ScoreBar label="Fin. Health" value={sc.health} weight="20%" expl="Leverage and liquidity metrics" />
                    <ScoreBar label="Momentum" value={sc.momentum} weight="15%" expl="Price action vs benchmarks" />
                    <ScoreBar label="Dividend" value={sc.dividend} weight="10%" expl="Yield & payout consistency" />
                  </div>
                  
                  <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-color)', lineHeight: 1.5 }}>
                      <strong style={{color:'white'}}>Overall Assessment:</strong> {scExpl}
                  </div>
                  <details style={{ background: 'transparent', marginTop: '16px', color: 'var(--text-muted)', fontSize:'0.75rem', cursor:'pointer' }}>
                      <summary>How is this score calculated?</summary>
                      <div style={{ marginTop:'8px', paddingLeft:'16px', lineHeight: 1.4 }}>
                        The final score is a logically weighted aggregate derived strictly from current reporting metrics. Missing inputs substitute sector medians to prevent calculation errors. Score = Profitability×0.20 + Growth×0.15 + Valuation×0.20 + Health×0.20 + Momentum×0.15 + Dividend×0.10.
                      </div>
                  </details>
                </>
              ) : <div style={{ color:'var(--text-muted)' }}>Score unavailable (missing core fundamental keys).</div>}
          </div>

          <div className="glass" style={{ padding: '24px' }}>
              <SectionHeader title="Quick Fundamentals" />
              <div className="grid-2-cols" style={{ gap: '0 24px' }}>
                  <div>
                      <DetailRow label="P/E Ratio" value={data.pe} type="mult" />
                      <DetailRow label="Forward P/E" value={data.forwardPe} type="mult" />
                      <DetailRow label="PEG Ratio" value={data.pegRatio || null} type="num" />
                      <DetailRow label="Price/Book" value={data.priceToBook} type="mult" />
                      <DetailRow label="EPS (TTM)" value={data.eps} type="price" />
                      <DetailRow label="Volume" value={data.volume} dec={0} />
                  </div>
                  <div>
                      <DetailRow label="ROE" value={data.returnOnEquity} type="percent" />
                      <DetailRow label="ROCE" value={data.returnOnAssets} type="percent" />
                      <DetailRow label="Debt / Equity" value={data.debtToEquity} />
                      <DetailRow label="Dividend Yield" value={data.dividendYield} type="percent" />
                      <DetailRow label="Profit Margin" value={data.profitMargins} type="percent" />
                      <DetailRow label="Operating Margin" value={data.operatingMargins} type="percent" />
                  </div>
              </div>
          </div>
      </div>

      {/* =======================
          3. PRICE PERFORMANCE
      ======================= */}
      <div className="col-12 glass" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <SectionHeader title="Price Performance" />
            <div style={{ display: 'flex', gap: '16px' }}>
                {['1mo','6mo','1y','5y'].map(p => (
                    <button key={p} onClick={() => setChartPeriod(p)} className={chartPeriod === p ? 'blue' : ''} style={{ background:'transparent', border:'none', color: chartPeriod === p ? 'var(--accent-cyan)' : 'var(--text-muted)', cursor:'pointer', fontWeight: 600, fontSize:'0.85rem' }}>{p.toUpperCase()}</button>
                ))}
            </div>
          </div>
          <div ref={chartContainerRef} style={{ width: '100%', height: '350px' }}></div>
          {histData.length > 0 && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span>Current Price: <span className="tabular-nums" style={{color:'white'}}>₹{data.currentPrice?.toFixed(2)}</span></span>
                  <span>Period High: <span className="tabular-nums" style={{color:'white'}}>₹{Math.max(...histData).toFixed(2)}</span></span>
                  <span>Period Low: <span className="tabular-nums" style={{color:'white'}}>₹{Math.min(...histData).toFixed(2)}</span></span>
                  <span>Period Return: <span className={`tabular-nums ${histData[histData.length-1] >= histData[0] ? 'positive' : 'negative'}`}>{(((histData[histData.length-1] - histData[0]) / histData[0]) * 100).toFixed(2)}%</span></span>
              </div>
          )}
      </div>

      {/* =======================
          4. VALUATION & PROFIT 
      ======================= */}
      <div className="col-12 grid-2-cols" style={{ gap: '16px' }}>
          <div className="glass" style={{ padding: '24px' }}>
              <SectionHeader title="Valuation" />
              <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
                  <table className="compact-table">
                      <thead>
                          <tr>
                              <th>Metric</th>
                              <th style={{textAlign:'right'}}>Company</th>
                              <th style={{textAlign:'right'}}>Historical Basis</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr>
                              <td style={{color:'white'}}>P/E Ratio</td>
                              <td className="tabular-nums" style={{textAlign:'right'}}>{_fmt(data.pe, 'mult')}</td>
                              <td className="tabular-nums" style={{textAlign:'right'}}>{data.forwardPe ? _fmt(data.forwardPe, 'mult') + ' (FWD)' : 'N/A'}</td>
                          </tr>
                          <tr>
                              <td style={{color:'white'}}>Price / Book</td>
                              <td className="tabular-nums" style={{textAlign:'right'}}>{_fmt(data.priceToBook, 'mult')}</td>
                              <td className="tabular-nums" style={{textAlign:'right'}}>N/A</td>
                          </tr>
                          <tr>
                              <td style={{color:'white'}}>EV / EBITDA</td>
                              <td className="tabular-nums" style={{textAlign:'right'}}>{_fmt(data.enterpriseToEbitda, 'mult')}</td>
                              <td className="tabular-nums" style={{textAlign:'right'}}>N/A</td>
                          </tr>
                      </tbody>
                  </table>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong style={{color:'white'}}>Valuation View:</strong> {data.pe > 35 ? "Elevated multiple relative to general indices." : data.pe < 15 ? "Discounted multiple." : "Fair relative valuation."}
              </div>
          </div>

          <div className="glass" style={{ padding: '24px' }}>
              <SectionHeader title="Profitability" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
                 <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ROE</div>
                    <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600 }} className="tabular-nums">{_fmt(data.returnOnEquity, 'percent')}</div>
                 </div>
                 <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ROCE (ROA)</div>
                    <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600 }} className="tabular-nums">{_fmt(data.returnOnAssets, 'percent')}</div>
                 </div>
                 <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Operating Margin</div>
                    <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600 }} className="tabular-nums">{_fmt(data.operatingMargins, 'percent')}</div>
                 </div>
                 <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Net Margin</div>
                    <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600 }} className="tabular-nums">{_fmt(data.profitMargins, 'percent')}</div>
                 </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong style={{color:'white'}}>Profitability View:</strong> {data.returnOnEquity > 0.15 ? "Strong" : data.returnOnEquity > 0.08 ? "Moderate" : "Weak"}
              </div>
          </div>
      </div>

      {/* =======================
          5. PEER COMPARISON 
      ======================= */}
      <div className="col-12 glass" style={{ padding: '24px' }}>
          <SectionHeader title="Peer Comparison" />
          {peers.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                  <table className="compact-table">
                      <thead>
                          <tr>
                              <th>Company</th>
                              <th style={{textAlign:'right'}}>Score</th>
                              <th style={{textAlign:'right'}}>P/E</th>
                              <th style={{textAlign:'right'}}>ROE</th>
                              <th style={{textAlign:'right'}}>Revenue Gr</th>
                              <th style={{textAlign:'right'}}>D/E</th>
                              <th style={{textAlign:'right'}}>Dividend</th>
                          </tr>
                      </thead>
                      <tbody>
                          <tr>
                              <td style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{data.symbol} (Base)</td>
                              <td className="tabular-nums blue" style={{ textAlign:'right', fontWeight: 600 }}>{sc?.total || 'N/A'}</td>
                              <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(data.pe, 'mult')}</td>
                              <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(data.returnOnEquity, 'percent')}</td>
                              <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(data.revenueGrowth, 'percent')}</td>
                              <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(data.debtToEquity, 'num', 1)}</td>
                              <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(data.dividendYield, 'percent')}</td>
                          </tr>
                          {peers.map(p => (
                              <tr key={p.symbol} onClick={() => navigate(`/stock/${p.symbol}`)} style={{cursor:'pointer'}}>
                                  <td style={{ color: 'white', fontWeight: 500 }}>{p.symbol}</td>
                                  <td className="tabular-nums" style={{ textAlign:'right' }}>{p.stockpulseScore?.total || 'N/A'}</td>
                                  <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(p.pe, 'mult')}</td>
                                  <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(p.roe, 'percent')}</td>
                                  <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(p.revenueGrowth, 'percent')}</td>
                                  <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(p.debtToEquity, 'num', 1)}</td>
                                  <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(p.dividendYield, 'percent')}</td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
                  <div style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <strong style={{color:'white'}}>Relative Position:</strong> Evaluated against top constituents in the {data.sector || "broader"} sector. Check P/E bounds for median dispersion.
                  </div>
              </div>
          ) : <div style={{ color:'var(--text-muted)' }}>Sector peer data unavailable.</div>}
      </div>

      {/* =======================
          6. QUARTERLY & TECH 
      ======================= */}
      <div className="col-12 grid-2-cols" style={{ gap: '16px' }}>
          <div className="glass" style={{ padding: '24px' }}>
              <SectionHeader title="Quarterly Financials" />
              {financials && financials.income_statement && Object.keys(financials.income_statement).length > 0 ? (
                  <div style={{ overflowX: 'auto' }}>
                      <table className="compact-table">
                          <thead>
                              <tr>
                                  <th>Date</th>
                                  <th style={{textAlign:'right'}}>Revenue</th>
                                  <th style={{textAlign:'right'}}>Net Income</th>
                              </tr>
                          </thead>
                          <tbody>
                              {Object.entries(financials.income_statement).slice(0,4).map(([date, st]) => (
                                  <tr key={date}>
                                      <td className="tabular-nums" style={{color:'white'}}>{date}</td>
                                      <td className="tabular-nums" style={{textAlign:'right'}}>{_fmt(st["Total Revenue"] || st["Operating Revenue"], 'money', 0)}</td>
                                      <td className="tabular-nums" style={{textAlign:'right'}}>{_fmt(st["Net Income"], 'money', 0)}</td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
              ) : <div style={{ color:'var(--text-muted)' }}>Quarterly statement data unavailable.</div>}
          </div>

          <div className="glass" style={{ padding: '24px' }}>
              <SectionHeader title="Technical Analysis" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '16px' }}>
                 <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>50-Day SMA</div>
                    <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600 }} className="tabular-nums">₹{data.fiftyDayAverage?.toFixed(2) || 'N/A'}</div>
                 </div>
                 <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>200-Day SMA</div>
                    <div style={{ fontSize: '1.25rem', color: 'white', fontWeight: 600 }} className="tabular-nums">₹{data.twoHundredDayAverage?.toFixed(2) || 'N/A'}</div>
                 </div>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <strong style={{color:'white'}}>Trend View:</strong> {data.currentPrice > data.fiftyDayAverage && data.fiftyDayAverage > data.twoHundredDayAverage ? "Strong Bullish Setup (Price > 50D > 200D)" : data.currentPrice < data.twoHundredDayAverage ? "Bearish Trend" : "Neutral Consolidation"}
              </div>
          </div>
      </div>

      {/* =======================
          7. OVERVIEW & RISKS 
      ======================= */}
      <div className="col-12 grid-2-cols" style={{ gap: '16px' }}>
          <div className="glass" style={{ padding: '24px', display:'flex', flexDirection:'column' }}>
              <SectionHeader title="Company Overview" />
              <div style={{ color: 'var(--text-color)', fontSize: '0.85rem', lineHeight: 1.6, overflowY:'auto', flex:1, paddingRight:'8px' }}>
                  {data.description ? data.description : 'Detailed company profile unavailable.'}
              </div>
          </div>
          
          <div className="glass" style={{ padding: '24px' }}>
              <SectionHeader title="Investment View & Key Risks" />
              <div style={{ marginBottom: '16px' }}>
              <h4 style={{ color: 'var(--negative)', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase' }}>Fundamental Risks</h4>
                  <ul style={{ color: 'white', fontSize: '0.85rem', paddingLeft: '16px', lineHeight: 1.6 }}>
                      {data.pe > 40 && <li>High Valuation Multiple implies growth compression risk.</li>}
                      {data.debtToEquity > 1 && <li>High Leverage (D/E &gt; 1) indicates balance sheet pressure.</li>}
                      {data.operatingMargins !== null && data.operatingMargins < 0.05 && <li>Razor thin operating margins highlight severe sector cyclicality risk.</li>}
                      {data.returnOnEquity !== null && data.returnOnEquity < 0.08 && <li>Sub-par structural return on equity.</li>}
                      {(data.pe != null && data.debtToEquity != null && data.operatingMargins != null && data.returnOnEquity != null) ? (
                          (data.pe <= 40 && data.debtToEquity <= 1 && data.operatingMargins >= 0.05 && data.returnOnEquity >= 0.08) && <li>No major apparent flags based on standard quantitative inputs.</li>
                      ) : (
                          (!(data.pe > 40) && !(data.debtToEquity > 1) && !(data.operatingMargins < 0.05) && !(data.returnOnEquity < 0.08)) && <li>Insufficient fundamental data to compute holistic risk profile.</li>
                      )}
                  </ul>
              </div>
              <div>
                  <h4 style={{ color: 'var(--positive)', marginBottom: '8px', fontSize: '0.9rem', textTransform: 'uppercase' }}>Strengths</h4>
                  <ul style={{ color: 'white', fontSize: '0.85rem', paddingLeft: '16px', lineHeight: 1.6 }}>
                      {data.dividendYield > 0.03 && <li>Consistent cash flow generation yielding &gt;3%.</li>}
                      {data.operatingMargins > 0.15 && <li>Wide-moat profitability characteristics.</li>}
                      {data.pe < 15 && data.returnOnEquity > 0.15 && <li>High qualitative yield at discounted valuation.</li>}
                  </ul>
              </div>
              <div style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic' }}>* Risks dynamically evaluated traversing the data payload. Information is heuristic.</div>
          </div>
      </div>

    </div>
  );
}
