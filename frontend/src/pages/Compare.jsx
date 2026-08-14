import React, { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "http://localhost:5050/api";

const _fmt = (val, type = 'num', decimals = 2) => {
    if (val === null || val === undefined) return 'N/A';
    if (type === 'percent') return (val * 100).toFixed(decimals) + '%';
    if (type === 'price') return '₹' + val.toLocaleString(undefined, {minimumFractionDigits: decimals});
    if (type === 'money') return '₹' + (val / 10000000).toFixed(0) + 'Cr';
    if (type === 'mult') return val.toFixed(decimals) + 'x';
    return val.toLocaleString(undefined, {minimumFractionDigits: decimals});
}

export default function Compare() {
  const [symbols, setSymbols] = useState('RELIANCE.NS, TCS.NS, HDFCBANK.NS');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchCompare = async () => {
    if (!symbols) return;
    setLoading(true);
    setData(null);
    try {
        const resp = await fetch(`${API_BASE}/compare?symbols=${symbols.replace(/\s/g, '')}`);
        const res = await resp.json();
        setData(res);
    } catch(err) {
        console.error(err);
    }
    setLoading(false);
  };

  // Generate automated insights analytically rather than faking AI
  let bestValuation = null;
  let bestProfit = null;
  let highestYield = null;
  
  if (data && data.length > 1) {
      const validPe = data.filter(d => d.pe && d.pe > 0).sort((a,b) => a.pe - b.pe);
      const validRoe = data.filter(d => d.roe).sort((a,b) => b.roe - a.roe);
      const validDiv = data.filter(d => d.dividendYield).sort((a,b) => b.dividendYield - a.dividendYield);
      
      bestValuation = validPe.length > 0 ? validPe[0].symbol : null;
      bestProfit = validRoe.length > 0 ? validRoe[0].symbol : null;
      highestYield = validDiv.length > 0 ? validDiv[0].symbol : null;
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '60px' }}>
        <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>⚖️ Peer Comparison</h2>
            <span style={{ color: 'var(--text-muted)' }}>Compare multiple equities side-by-side evaluating exact fundamental metrics across subsets.</span>
        </div>

        <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '16px' }}>
                <input 
                    type="text" 
                    value={symbols}
                    onChange={e => setSymbols(e.target.value)}
                    placeholder="Enter comma-separated tickers (e.g. RELIANCE.NS, TCS.NS)"
                    style={{ flex: 1, padding: '12px 16px', background: 'var(--bg-1)', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px' }}
                />
                <button 
                    onClick={fetchCompare}
                    style={{ background: 'var(--accent-cyan)', color: 'black', fontWeight: 600, border: 'none', padding: '0 24px', borderRadius: '4px', cursor: 'pointer' }}
                >
                    {loading ? 'Analyzing...' : 'Run Analysis'}
                </button>
            </div>
        </div>

        {data && data.length > 0 && (
            <>
                <div style={{ overflowX: 'auto', paddingBottom: '16px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        {data.map(d => (
                            <div key={d.symbol} className="glass" style={{ minWidth: '320px', padding: '24px', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
                                    <div>
                                        <h3 style={{ margin: 0, color: 'white', fontSize: '1.2rem', letterSpacing: '0.02em' }}>{d.symbol}</h3>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{d.sector || 'Equities'}</span>
                                    </div>
                                    <div className="tabular-nums" style={{ fontSize: '1.4rem', color: 'white', fontWeight: 600 }}>
                                        ₹{d.price?.toFixed(2)}
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Market Cap</span>
                                        <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{_fmt(d.marketCap, 'money')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>P/E Ratio</span>
                                        <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{_fmt(d.pe, 'mult')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>P/B Ratio</span>
                                        <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{_fmt(d.pb, 'mult')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ROE</span>
                                        <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{_fmt(d.roe, 'percent')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Debt / Equity</span>
                                        <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{_fmt(d.debtToEquity, 'num', 1)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Rev Growth</span>
                                        <span className={`tabular-nums ${(d.revenueGrowth || 0) >= 0 ? 'positive' : 'negative'}`} style={{ fontWeight: 500 }}>
                                            {_fmt(d.revenueGrowth, 'percent')}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Dividend Yield</span>
                                        <span className="tabular-nums" style={{ color: 'var(--accent-cyan)', fontWeight: 500 }}>{_fmt(d.dividendYield, 'percent')}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>52W Return</span>
                                        <span className={`tabular-nums ${(d.fiftyTwoWeekReturn || 0) >= 0 ? 'positive' : 'negative'}`} style={{ fontWeight: 500 }}>
                                            {_fmt(d.fiftyTwoWeekReturn, 'percent')}
                                        </span>
                                    </div>
                                    
                                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ color: 'white', fontWeight: 600 }}>StockPulse Score</span>
                                        <span className="tabular-nums" style={{ color: 'white', fontSize: '1.2rem', fontWeight: 600 }}>
                                            {d.stockpulseScore?.total || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {data.length > 1 && (
                    <div className="grid-2-cols" style={{ gap: '24px' }}>
                        <div className="glass" style={{ padding: '24px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Relative Assessment</h2>
                            <ul style={{ color: 'var(--text-color)', lineHeight: 1.8, fontSize: '0.9rem' }}>
                                {bestValuation && <li>Best valuation (Lowest P/E): <strong style={{color:'white'}}>{bestValuation}</strong></li>}
                                {bestProfit && <li>Best profitability (Highest ROE): <strong style={{color:'white'}}>{bestProfit}</strong></li>}
                                {highestYield && <li>Highest dividend yield: <strong style={{color:'var(--accent-cyan)'}}>{highestYield}</strong></li>}
                            </ul>
                            {(!bestValuation && !bestProfit) && <div style={{ color:'var(--text-muted)' }}>Insufficient data to run relative multi-variance calculations.</div>}
                        </div>
                        <div className="glass" style={{ padding: '24px' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Key Takeaways</h2>
                            <ul style={{ color: 'var(--text-color)', lineHeight: 1.8, fontSize: '0.9rem' }}>
                                {bestProfit && <li>• <strong style={{color:'white'}}>{bestProfit}</strong> currently achieves the highest return on owner equity among the selected equities.</li>}
                                {bestValuation && <li>• <strong style={{color:'white'}}>{bestValuation}</strong> trades at the deepest multiple discount strictly on an earnings basis.</li>}
                                <li>• These quantitative heuristics are derived solely from trailing historicals. Check the Strategy Lab for outperformance persistence.</li>
                            </ul>
                        </div>
                    </div>
                )}
            </>
        )}
    </div>
  );
}
