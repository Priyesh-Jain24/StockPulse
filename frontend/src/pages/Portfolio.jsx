import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "http://localhost:5050/api";

export default function Portfolio() {
  const navigate = useNavigate();
  const [holdings, setHoldings] = useState([]);
  const [livePrices, setLivePrices] = useState({});
  const [tickerMeta, setTickerMeta] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('stockpulse_portfolio') || '[]');
    setHoldings(saved);
  }, []);

  useEffect(() => {
    if (holdings.length === 0) return;
    
    const loadPrices = () => {
        const symbols = holdings.map(h => h.symbol).join(",");
        Promise.all([
            fetch(`${API_BASE}/market/quotes?symbols=${symbols}`).then(r => r.json()).catch(() => []),
            fetch(`${API_BASE}/screener`).then(r => r.json()).catch(() => ({data: []}))
        ]).then(([quotes, screenerRes]) => {
            const priceMap = {};
            quotes.forEach(d => { priceMap[d.symbol] = d.price; });
            setLivePrices(priceMap);
            
            const meta = {};
            if (screenerRes.data) {
                screenerRes.data.forEach(s => {
                    meta[s.symbol] = s.sector;
                });
            }
            setTickerMeta(meta);
            setLoading(false);
        });
    };

    loadPrices();
    const timer = setInterval(loadPrices, 60000);
    return () => clearInterval(timer);
  }, [holdings]);

  let totalValue = 0;
  let totalInvested = 0;
  const holdingStats = [];

  holdings.forEach(h => {
      const invested = h.avg * h.qty;
      const val = (livePrices[h.symbol] || h.avg) * h.qty;
      totalInvested += invested;
      totalValue += val;
      holdingStats.push({ symbol: h.symbol, val, sector: tickerMeta[h.symbol] || 'Unknown' });
  });

  const overallPL = totalValue - totalInvested;
  const overallPLPct = totalInvested > 0 ? (overallPL / totalInvested) * 100 : 0;

  holdingStats.sort((a,b) => b.val - a.val);
  const sectorAllocation = {};
  holdingStats.forEach(h => {
      sectorAllocation[h.sector] = (sectorAllocation[h.sector] || 0) + h.val;
  });

  const largestHoldingPct = totalValue > 0 && holdingStats.length > 0 ? (holdingStats[0].val / totalValue) * 100 : 0;
  const top3Pct = totalValue > 0 ? holdingStats.slice(0,3).reduce((sum, h) => sum + h.val, 0) / totalValue * 100 : 0;
  const topSector = Object.entries(sectorAllocation).sort((a,b) => b[1] - a[1])[0];
  const largestSectorPct = totalValue > 0 && topSector ? (topSector[1] / totalValue) * 100 : 0;

  let riskLevel = 'Low';
  if (largestHoldingPct > 40 || largestSectorPct > 60) riskLevel = 'High';
  else if (largestHoldingPct > 20 || largestSectorPct > 35) riskLevel = 'Moderate';

  return (
    <div className="fade-in" style={{ paddingBottom: '60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white' }}>💼 Personal Portfolio</h2>
                <span style={{ color: 'var(--text-muted)' }}>Real-time dynamic monitoring mapping explicit risk concentrations securely.</span>
            </div>
            <div className="glass" style={{ display: 'flex', gap: '32px', padding: '16px 24px' }}>
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Value</div>
                    <div className="tabular-nums" style={{ fontSize: '1.5rem', color: 'white', fontWeight: 600 }}>₹{totalValue.toLocaleString(undefined, {minimumFractionDigits:2})}</div>
                </div>
                <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Return</div>
                    <div className={`tabular-nums ${overallPL >= 0 ? 'positive' : 'negative'}`} style={{ fontSize: '1.5rem', fontWeight: 600 }}>
                        {overallPL >= 0 ? '+' : ''}{overallPLPct.toFixed(2)}%
                    </div>
                </div>
            </div>
        </div>

        {holdings.length === 0 ? (
            <div className="glass" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No equities in your portfolio. Locate assets via the Screener or Dashboard.
            </div>
        ) : (
            <>
                <div className="grid-2-cols" style={{ gap: '24px', marginBottom: '24px' }}>
                    <div className="glass" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Portfolio Allocation (Top Holdings)</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {holdingStats.slice(0, 5).map(h => (
                                <div key={h.symbol} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <span style={{ color: 'white', fontWeight: 500 }}>{h.symbol}</span>
                                    <span style={{ color: 'var(--accent-cyan)' }} className="tabular-nums">{((h.val / totalValue) * 100).toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="glass" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Sector Allocation</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {Object.entries(sectorAllocation).sort((a,b) => b[1] - a[1]).slice(0,5).map(([sec, val]) => (
                                <div key={sec} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                    <span style={{ color: 'white' }}>{sec}</span>
                                    <span style={{ color: 'var(--positive)' }} className="tabular-nums">{((val / totalValue) * 100).toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass" style={{ padding: '24px', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Concentration Risk Analytics</h3>
                    <div className="grid-2-cols" style={{ gap: '24px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Largest Individual Entity Weight</span>
                                <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{largestHoldingPct.toFixed(1)}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Top 3 Holdings Concentration</span>
                                <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{top3Pct.toFixed(1)}%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Dominant Macro Sector Weight</span>
                                <span className="tabular-nums" style={{ color: 'white', fontWeight: 500 }}>{largestSectorPct.toFixed(1)}%</span>
                            </div>
                        </div>
                        <div style={{ padding: '24px', background: 'var(--bg-1)', borderRadius: '4px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                            <div style={{ color: 'var(--text-muted)', marginBottom: '8px', fontSize: '0.85rem' }}>Structural Risk Classification</div>
                            <div style={{ fontSize: '2rem', fontWeight: 700, color: riskLevel === 'High' ? 'var(--negative)' : riskLevel === 'Low' ? 'var(--positive)' : '#eab308' }}>
                                {riskLevel}
                            </div>
                            <p style={{ marginTop: '16px', fontSize: '0.85rem', color: 'var(--text-color)', lineHeight: 1.5 }}>
                                {riskLevel === 'High' ? 'Extreme capital concentration detected. Portfolio is overly exposed to single-entity shocks.' : riskLevel === 'Low' ? 'Sufficiently diversified across broader equities limiting targeted drawdowns.' : 'Adequately diversified but retaining moderate exposure weights to top constituents.'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="glass" style={{ padding: '24px' }}>
                    <table className="compact-table" style={{ width: '100%' }}>
                        <thead>
                            <tr>
                                <th>Asset</th>
                                <th style={{ textAlign: 'right' }}>Shares</th>
                                <th style={{ textAlign: 'right' }}>Avg Price</th>
                                <th style={{ textAlign: 'right' }}>LTP</th>
                                <th style={{ textAlign: 'right' }}>Unrealized P&L</th>
                                <th style={{ textAlign: 'right' }}>Return %</th>
                            </tr>
                        </thead>
                        <tbody>
                            {holdings.map(h => {
                                const currentPrice = livePrices[h.symbol] || h.avg;
                                const pnl = (currentPrice - h.avg) * h.qty;
                                const pnlPct = ((currentPrice - h.avg) / h.avg) * 100;
                                const isPos = pnl >= 0;

                                return (
                                    <tr key={h.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td onClick={() => navigate(`/stock/${h.symbol}`)} style={{ cursor: 'pointer', color: 'white', fontWeight: 500 }}>
                                            <span className="blue">◉</span> {h.symbol}
                                        </td>
                                        <td className="tabular-nums" style={{ textAlign: 'right' }}>{h.qty}</td>
                                        <td className="tabular-nums" style={{ textAlign: 'right' }}>₹{h.avg.toFixed(2)}</td>
                                        <td className="tabular-nums" style={{ textAlign: 'right' }}>₹{currentPrice.toFixed(2)}</td>
                                        <td className={`tabular-nums ${isPos ? 'positive' : 'negative'}`} style={{ textAlign: 'right' }}>
                                            {isPos?'+':''}₹{Math.abs(pnl).toLocaleString(undefined, {minimumFractionDigits:2})}
                                        </td>
                                        <td className={`tabular-nums ${isPos ? 'positive' : 'negative'}`} style={{ textAlign: 'right' }}>
                                            {isPos?'+':''}{pnlPct.toFixed(2)}%
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </>
        )}
    </div>
  );
}
