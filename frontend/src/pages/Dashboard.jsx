import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createChart } from 'lightweight-charts';

const API_BASE = "http://localhost:5050/api";

// ---------------- SKELETONS ----------------
const SkeletonBlock = ({ height = '100px', width = '100%' }) => (
  <div className="skeleton" style={{ height, width, borderRadius: '6px' }}></div>
);

// ---------------- COMPONENTS ----------------
const SectionHeader = ({ title }) => (
  <div style={{ marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <h3 style={{ fontSize: '0.9rem', color: 'white', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</h3>
  </div>
);

export default function Dashboard() {
  const navigate = useNavigate();
  const [indices, setIndices] = useState(null);
  const [screener, setScreener] = useState(null);
  const [sectors, setSectors] = useState(null);
  const [news, setNews] = useState(null);
  
  const chartContainerRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    // 1. Fetch Indices
    fetch(`${API_BASE}/market/indices`)
      .then(r => r.json())
      .then(d => setIndices(Array.isArray(d) ? d : []))
      .catch(e => setIndices([]));
      
    // 2. Fetch Screener / Snapshot
    const fetchSc = () => {
      fetch(`${API_BASE}/screener`)
        .then(r => r.json())
        .then(res => {
          if (res.status === 'loading') setTimeout(fetchSc, 1000);
          else setScreener(res.data);
        }).catch(e => setScreener([]));
    };
    fetchSc();

    // 3. Fetch Sectors
    const fetchSect = () => {
      fetch(`${API_BASE}/sectors`)
        .then(r => r.json())
        .then(res => {
          if (res.status === 'loading') setTimeout(fetchSect, 1000);
          else setSectors(res.data);
        }).catch(e => setSectors([]));
    };
    fetchSect();

    // 4. Fetch Market News (using Reliance proxy for now)
    fetch(`${API_BASE}/stock/RELIANCE.NS/news`)
      .then(r => r.json())
      .then(d => setNews(Array.isArray(d) ? d : []))
      .catch(e => setNews([]));
  }, []);

  // Initialize basic market chart
  useEffect(() => {
    if (chartContainerRef.current && !chartInstance.current) {
      chartInstance.current = createChart(chartContainerRef.current, {
        layout: { background: { type: 'solid', color: 'transparent' }, textColor: '#8B949E' },
        grid: { vertLines: { color: 'rgba(255,255,255,0.02)' }, horzLines: { color: 'rgba(255,255,255,0.02)' } },
        timeScale: { borderColor: '#30363D' },
        rightPriceScale: { borderColor: '#30363D' }
      });
      const area = chartInstance.current.addAreaSeries({
        lineColor: '#00E6F3', topColor: 'rgba(0, 230, 243, 0.2)', bottomColor: 'rgba(0, 230, 243, 0)'
      });
      // Fetch historical data for chart
      fetch(`${API_BASE}/stock/^NSEI?period=6mo`)
        .then(r => r.json())
        .then(data => {
            if(!data.dates) return;
            const mapped = data.dates.map((d, i) => ({
                time: d.split(" ")[0],
                value: data.close[i]
            }));
            area.setData(mapped);
            chartInstance.current.timeScale().fitContent();
        });

      const handleResize = () => chartInstance.current.resize(chartContainerRef.current.clientWidth, 250);
      window.addEventListener('resize', handleResize);
      return () => { window.removeEventListener('resize', handleResize); };
    }
  }, []);

  // Derivations
  const gainers = screener ? [...screener].filter(a => a.fiftyTwoWeekReturn).sort((a,b) => b.fiftyTwoWeekReturn - a.fiftyTwoWeekReturn).slice(0,5) : null;
  const losers = screener ? [...screener].filter(a => a.fiftyTwoWeekReturn).sort((a,b) => a.fiftyTwoWeekReturn - b.fiftyTwoWeekReturn).slice(0,5) : null;
  const advances = screener ? screener.filter(d => d.fiftyTwoWeekReturn > 0).length : 0;
  const declines = screener ? screener.filter(d => d.fiftyTwoWeekReturn < 0).length : 0;

  return (
    <div className="fade-in dense-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
      
      {/* 1. Market Overview */}
      <div className="col-12 grid-4-cols">
        {!indices ? [...Array(4)].map((_, i) => <SkeletonBlock key={i} height="80px" />) : 
          indices.map(idx => {
            const pct = ((idx.price - idx.prev) / idx.prev) * 100;
            const isPos = pct >= 0;
            return (
              <div key={idx.symbol} className="glass metric-widget">
                <span className="metric-label">{idx.name}</span>
                <span className="metric-value tabular-nums">₹{idx.price.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                <span className={`metric-change tabular-nums ${isPos?'positive':'negative'}`}>
                  {isPos?'+':''}{pct.toFixed(2)}%
                </span>
              </div>
            );
          })
        }
      </div>

      {/* 2. Snapshot */}
      <div className="glass col-3" style={{ padding: '16px' }}>
        <SectionHeader title="Market Snapshot" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {!screener ? <SkeletonBlock height="200px" /> : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>Advances</span>
                  <span className="positive tabular-nums">{advances}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>Declines</span>
                  <span className="negative tabular-nums">{declines}</span>
                </div>
                <div style={{ width: '100%', height: '4px', background: 'var(--negative)', display: 'flex' }}>
                    <div style={{ width: `${(advances/(advances+declines))*100}%`, background: 'var(--positive)' }}></div>
                </div>
                
                <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>
                
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>Top Gainer 52W</span>
                  <div style={{textAlign:'right'}}>
                      <div style={{color:'white', fontWeight:500, fontSize:'0.85rem'}}>{gainers[0]?.symbol}</div>
                      <div className="positive tabular-nums" style={{fontSize:'0.8rem'}}>+{(gainers[0]?.fiftyTwoWeekReturn*100).toFixed(1)}%</div>
                  </div>
                </div>
                
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{color:'var(--text-muted)', fontSize:'0.9rem'}}>Top Loser 52W</span>
                  <div style={{textAlign:'right'}}>
                      <div style={{color:'white', fontWeight:500, fontSize:'0.85rem'}}>{losers[0]?.symbol}</div>
                      <div className="negative tabular-nums" style={{fontSize:'0.8rem'}}>{(losers[0]?.fiftyTwoWeekReturn*100).toFixed(1)}%</div>
                  </div>
                </div>
              </>
            )}
        </div>
      </div>

      {/* 3. Market Chart */}
      <div className="glass col-9" style={{ padding: '16px' }}>
        <SectionHeader title="NIFTY 50 Performance" />
        <div ref={chartContainerRef} style={{ width: '100%', height: '250px' }}></div>
      </div>

      {/* 4. Top Gainers */}
      <div className="glass col-4" style={{ padding: '16px' }}>
        <SectionHeader title="Top Gainers" />
        {!gainers ? <SkeletonBlock height="200px" /> : (
          <table className="compact-table">
            <tbody>
              {gainers.map(g => (
                <tr key={g.symbol} onClick={() => navigate(`/stock/${g.symbol}`)} style={{cursor:'pointer'}}>
                  <td style={{color:'white', fontWeight:500}}>{g.symbol}</td>
                  <td className="tabular-nums" style={{textAlign:'right'}}>₹{g.price.toFixed(1)}</td>
                  <td className="tabular-nums positive" style={{textAlign:'right'}}>+{(g.fiftyTwoWeekReturn*100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 5. Top Losers */}
      <div className="glass col-4" style={{ padding: '16px' }}>
        <SectionHeader title="Top Losers" />
        {!losers ? <SkeletonBlock height="200px" /> : (
          <table className="compact-table">
            <tbody>
              {losers.map(g => (
                <tr key={g.symbol} onClick={() => navigate(`/stock/${g.symbol}`)} style={{cursor:'pointer'}}>
                  <td style={{color:'white', fontWeight:500}}>{g.symbol}</td>
                  <td className="tabular-nums" style={{textAlign:'right'}}>₹{g.price.toFixed(1)}</td>
                  <td className="tabular-nums negative" style={{textAlign:'right'}}>{(g.fiftyTwoWeekReturn*100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 6. Sectors */}
      <div className="glass col-4" style={{ padding: '16px' }}>
        <SectionHeader title="Sector Performance (Avg 52W)" />
        {!sectors ? <SkeletonBlock height="200px" /> : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginTop:'10px' }}>
            {sectors.slice(0,5).map(s => {
                const ret = s.avg_return_52w * 100;
                const isPos = ret >= 0;
                return (
                    <div key={s.sector} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'0.85rem', color:'var(--text-color)' }}>{s.sector}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px', width:'50%', justifyContent:'flex-end' }}>
                            <span className={`tabular-nums ${isPos?'positive':'negative'}`} style={{fontSize:'0.85rem'}}>
                                {isPos?'+':''}{ret.toFixed(1)}%
                            </span>
                            <div style={{ width:'40px', height:'4px', background: isPos?'var(--positive-bg)':'var(--negative-bg)' }}>
                                <div style={{ width:`${Math.min(Math.abs(ret), 100)}%`, height:'100%', background: isPos?'var(--positive)':'var(--negative)' }}></div>
                            </div>
                        </div>
                    </div>
                )
            })}
          </div>
        )}
      </div>

      {/* 7. StockPulse Picks */}
      <div className="glass col-6" style={{ padding: '16px' }}>
        <SectionHeader title="StockPulse Analyst Picks" />
        {!screener ? <SkeletonBlock height="150px" /> : (
            <div className="grid-2-cols">
                {screener.filter(s => s.stockpulseScore).sort((a,b) => b.stockpulseScore.total - a.stockpulseScore.total).slice(0,4).map(s => (
                    <div key={s.symbol} onClick={() => navigate(`/stock/${s.symbol}`)} style={{ border:'1px solid var(--border-color)', borderRadius:'4px', padding:'12px', cursor:'pointer' }}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'8px' }}>
                            <span style={{ color:'white', fontWeight:600 }}>{s.symbol}</span>
                            <span className="blue tabular-nums" style={{ fontWeight:600 }}>★ {s.stockpulseScore.total}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.8rem', color:'var(--text-muted)' }}>
                            <span>P/E: <span className="tabular-nums" style={{color:'white'}}>{s.pe?.toFixed(1)}</span></span>
                            <span>ROE: <span className="tabular-nums" style={{color:'white'}}>{(s.roe*100)?.toFixed(1)}%</span></span>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* 8. Portfolio & Watchlist Panels */}
      <div className="col-3" style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <div className="glass" style={{ padding: '16px', flex: 1 }}>
            <SectionHeader title="Portfolio" />
            <div style={{ textAlign:'center', padding:'20px 0' }}>
                <div style={{ fontSize:'0.85rem', color:'var(--text-muted)', marginBottom:'4px' }}>Value</div>
                <div className="tabular-nums" style={{ fontSize:'1.5rem', fontWeight:600, color:'white' }}>₹0.00</div>
                <button style={{ background:'transparent', border:'1px solid var(--accent-cyan)', color:'var(--accent-cyan)', padding:'6px 12px', borderRadius:'4px', fontSize:'0.8rem', marginTop:'16px', cursor:'pointer' }}>Setup Portfolio</button>
            </div>
        </div>
      </div>

      {/* 9. News */}
      <div className="glass col-3" style={{ padding: '16px' }}>
        <SectionHeader title="Market News" />
        {!news ? <SkeletonBlock height="150px" /> : (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                {news.slice(0,3).map((n, i) => (
                    <a href={n.link} key={i} target="_blank" style={{ borderBottom: i < 2 ? '1px solid var(--border-color)' : 'none', paddingBottom: i < 2 ? '8px' : '0' }}>
                        <div style={{ fontSize:'0.8rem', color:'white', lineHeight:1.4, marginBottom:'4px' }}>{n.title.length > 50 ? n.title.substring(0,50)+'...' : n.title}</div>
                        <div style={{ fontSize:'0.7rem', color:'var(--text-muted)' }}>{n.publisher}</div>
                    </a>
                ))}
            </div>
        )}
      </div>
      
    </div>
  );
}
