import React, { useState, useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "http://localhost:5050/api";

function StatCard({ label, value, color }) {
    return (
        <div className="glass" style={{ padding: '16px', flex: '1', minWidth: '150px' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>{label}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: color || 'white' }}>{value}</div>
        </div>
    );
}

export default function BacktestLab() {
  const [sym, setSym] = useState("RELIANCE.NS");
  const [cap, setCap] = useState(100000);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [shortMa, setShortMa] = useState(50);
  const [longMa, setLongMa] = useState(200);
  const [txCost, setTxCost] = useState(0.1);
  const [riskFree, setRiskFree] = useState(6.0);
  
  const [loading, setLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState("");
  const [res, setRes] = useState(null);
  
  const normChartRef = useRef(null);
  const equityChartRef = useRef(null);
  const ddChartRef = useRef(null);
  
  const normChartInst = useRef(null);
  const equityChartInst = useRef(null);
  const ddChartInst = useRef(null);

  const runSim = () => {
    if (shortMa >= longMa) {
        setErrorStatus("Short SMA must be heavily less than Long SMA!");
        return;
    }
    setLoading(true);
    setErrorStatus("");
    setRes(null);
    
    let url = `${API_BASE}/backtest?symbol=${sym}&capital=${cap}&short_ma=${shortMa}&long_ma=${longMa}&tx_cost=${txCost/100}&risk_free=${riskFree/100}`;
    if (start) url += `&start_date=${start}`;
    if (end) url += `&end_date=${end}`;
    
    fetch(url)
      .then(r => r.json())
      .then(data => {
        setLoading(false);
        if (data.error) {
            setErrorStatus(data.error);
        } else {
            setRes(data);
        }
      })
      .catch(err => {
          setLoading(false);
          setErrorStatus("Unable to complete backtest. Backend failed.");
      });
  };

  useEffect(() => {
    if (!res || !normChartRef.current || !equityChartRef.current || !ddChartRef.current) return;
    
    const layout = { background: { type: 'solid', color: 'transparent' }, textColor: '#8b8fa3' };
    const grid = { vertLines: { color: 'rgba(255,255,255,0.03)' }, horzLines: { color: 'rgba(255,255,255,0.03)' } };

    // 1. Normalized Performance Chart (Strategy vs B&H vs Nifty)
    if (!normChartInst.current) {
        normChartInst.current = createChart(normChartRef.current, { layout, grid, timeScale: { borderColor: 'rgba(255,255,255,0.1)' } });
    }
    normChartInst.current.timeScale().fitContent();
    // clear series if any (lightweight-charts cleanup)
    normChartInst.current.remove();
    normChartInst.current = createChart(normChartRef.current, { layout, grid, timeScale: { borderColor: 'rgba(255,255,255,0.1)' } });
    
    const stratNormLine = normChartInst.current.addLineSeries({ color: '#A855F7', lineWidth: 2, title: 'Strategy' });
    stratNormLine.setData(res.strat_norm || []);
    const bhNormLine = normChartInst.current.addLineSeries({ color: '#3B82F6', lineWidth: 2, title: 'Buy & Hold' });
    bhNormLine.setData(res.stock_price_norm || []);
    
    if (res.nifty_norm && res.nifty_norm.length > 0) {
        const niftyNormLine = normChartInst.current.addLineSeries({ color: '#EAB308', lineWidth: 2, title: 'Nifty 50' });
        niftyNormLine.setData(res.nifty_norm);
    }

    // 2. Equity Curve Chart (with markers)
    if (equityChartInst.current) equityChartInst.current.remove();
    equityChartInst.current = createChart(equityChartRef.current, { layout, grid });
    const eqLine = equityChartInst.current.addAreaSeries({ lineColor: '#00E6F3', topColor: 'rgba(0, 230, 243, 0.2)', bottomColor: 'rgba(0,0,0,0)' });
    eqLine.setData(res.equity_curve || []);
    if (res.markers && res.markers.length > 0) {
        eqLine.setMarkers(res.markers);
    }
    equityChartInst.current.timeScale().fitContent();

    // 3. Drawdown Chart
    if (ddChartInst.current) ddChartInst.current.remove();
    ddChartInst.current = createChart(ddChartRef.current, { layout, grid });
    const ddLine = ddChartInst.current.addAreaSeries({ lineColor: '#EF4444', topColor: 'rgba(239, 68, 68, 0.2)', bottomColor: 'rgba(0,0,0,0)' });
    ddLine.setData(res.drawdown_curve || []);
    ddChartInst.current.timeScale().fitContent();

    const handleResize = () => {
      if (normChartRef.current) normChartInst.current?.resize(normChartRef.current.clientWidth, 350);
      if (equityChartRef.current) equityChartInst.current?.resize(equityChartRef.current.clientWidth, 300);
      if (ddChartRef.current) ddChartInst.current?.resize(ddChartRef.current.clientWidth, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => { window.removeEventListener('resize', handleResize); };
  }, [res]);

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontWeight: 800, fontSize: '1.8rem', margin: 0 }}>STRATEGY LAB</h1>
            <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Quantitative historical backtesting engine (Look-ahead bias resolved)</p>
          </div>
      </div>

      {/* PARAMETERS PANEL */}
      <div className="glass" style={{ padding: '24px', marginBottom: '32px' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'white' }}>Configuration</h3>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Target Stock</label>
            <input type="text" className="input-glass" value={sym} onChange={e => setSym(e.target.value)} style={{ width: '100%' }} placeholder="Ticker" />
          </div>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Initial Capital (₹)</label>
            <input type="number" className="input-glass" value={cap} onChange={e => setCap(e.target.value)} style={{ width: '100%' }} placeholder="Capital" />
          </div>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Start Date (Optional)</label>
            <input type="date" className="input-glass" value={start} onChange={e => setStart(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>End Date (Optional)</label>
            <input type="date" className="input-glass" value={end} onChange={e => setEnd(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Short SMA</label>
            <input type="number" className="input-glass" value={shortMa} onChange={e => setShortMa(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Long SMA</label>
            <input type="number" className="input-glass" value={longMa} onChange={e => setLongMa(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Transaction Cost (%)</label>
            <input type="number" step="0.01" className="input-glass" value={txCost} onChange={e => setTxCost(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ flex: '1', minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Risk-Free Rate (%)</label>
            <input type="number" step="0.1" className="input-glass" value={riskFree} onChange={e => setRiskFree(e.target.value)} style={{ width: '100%' }} />
          </div>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn-glass" onClick={runSim} disabled={loading} style={{ background: 'var(--accent-cyan)', color: 'black', borderColor: 'var(--accent-cyan)' }}>
            {loading ? "Running Historical Backtest..." : "RUN BACKTEST"}
          </button>
          {errorStatus && <span style={{ color: 'var(--negative)', fontSize: '0.9rem' }}>{errorStatus}</span>}
        </div>
      </div>

      {!res && !loading && !errorStatus && (
          <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-muted)' }}>
              Configure your strategy and run a backtest to view historical analysis.
          </div>
      )}

      {res && res.metrics && (
        <div className="fade-in">
          
          {/* RESULT SUMMARY CARDS */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <StatCard label="Final Portfolio Value" value={`₹${res.metrics.final_capital.toLocaleString(undefined, {maximumFractionDigits:2})}`} color="var(--accent-cyan)" />
            <StatCard label="Strategy Total Return" value={`${res.metrics.total_return_pct.toFixed(2)}%`} color={res.metrics.total_return_pct >= 0 ? "var(--positive)" : "var(--negative)"} />
            <StatCard label="Strategy CAGR" value={`${res.metrics.cagr.toFixed(2)}%`} color="white" />
            <StatCard label="Max Drawdown" value={`${res.metrics.max_drawdown.toFixed(2)}%`} color="var(--negative)" />
            <StatCard label="Win Rate" value={`${res.metrics.win_rate.toFixed(1)}%`} color={res.metrics.win_rate > 50 ? "var(--positive)" : "white"} />
            <StatCard label="Completed Trades" value={res.metrics.total_trades} />
          </div>

          <div style={{ display: 'flex', gap: '24px', flexDirection: 'column' }}>
            
            {/* NORMALIZED COMPARISON */}
            <div className="glass" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>STRATEGY VS BENCHMARKS (Normalized to 100)</h3>
                <div style={{ display: 'flex', gap: '24px', marginBottom: '16px', fontSize: '0.9rem' }}>
                    <div style={{ color: '#A855F7', fontWeight: 600 }}>● Strategy CAGR: {res.metrics.cagr.toFixed(2)}%</div>
                    <div style={{ color: '#3B82F6', fontWeight: 600 }}>● Buy & Hold CAGR: {res.metrics.benchmark_cagr.toFixed(2)}%</div>
                    {res.nifty_metrics && <div style={{ color: '#EAB308', fontWeight: 600 }}>● Nifty 50 CAGR: {res.nifty_metrics.cagr.toFixed(2)}%</div>}
                </div>
                <div ref={normChartRef} style={{ width: '100%', height: '350px' }}></div>
            </div>

            {/* EQUITY CURVE & DRAWDOWN */}
            <div style={{ display: 'flex', gap: '24px' }}>
                <div className="glass" style={{ padding: '24px', flex: 2 }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>STRATEGY EQUITY CURVE</h3>
                    <div ref={equityChartRef} style={{ width: '100%', height: '300px' }}></div>
                </div>
                <div className="glass" style={{ padding: '24px', flex: 1 }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>DRAWDOWN</h3>
                    <div ref={ddChartRef} style={{ width: '100%', height: '200px' }}></div>
                </div>
            </div>

            {/* DEEP TRADE ANALYSIS */}
            <div style={{ display: 'flex', gap: '24px' }}>
                <div className="glass" style={{ padding: '24px', flex: 1 }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>METRICS & RISK</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.9rem', lineHeight: '2' }}>
                        <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Annualized Volatility:</span> <strong>{res.metrics.ann_volatility.toFixed(2)}%</strong></li>
                        <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sharpe Ratio:</span> <strong>{res.metrics.sharpe.toFixed(2)}</strong></li>
                        <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Sortino Ratio (Downside):</span> <strong>{res.metrics.sortino.toFixed(2)}</strong></li>
                        <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Profit Factor:</span> <strong>{res.metrics.profit_factor.toFixed(2)}</strong></li>
                        <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Average Win %:</span> <strong style={{color:'var(--positive)'}}>+{res.metrics.avg_win_pct.toFixed(2)}%</strong></li>
                        <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Average Loss %:</span> <strong style={{color:'var(--negative)'}}>{res.metrics.avg_loss_pct.toFixed(2)}%</strong></li>
                        <li style={{ display: 'flex', justifyContent: 'space-between' }}><span>Average Holding:</span> <strong>{res.metrics.avg_holding_days.toFixed(0)} days</strong></li>
                    </ul>
                </div>
                
                <div className="glass" style={{ padding: '24px', flex: 2 }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem' }}>TRADE LEDGER</h3>
                    
                    {res.metrics.open_position && (
                        <div style={{ padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', marginBottom: '16px', borderLeft: '4px solid var(--accent-cyan)' }}>
                            <strong>Open Position Detected</strong> <br/>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>The strategy sits on an active holding. Unrealized P&L: </span>
                            <strong style={{ color: res.metrics.unrealized_pnl >= 0 ? "var(--positive)" : "var(--negative)" }}>₹{res.metrics.unrealized_pnl.toFixed(2)}</strong>
                        </div>
                    )}

                    {(!res.trade_log || res.trade_log.length === 0) ? (
                        <div style={{ color: 'var(--text-muted)' }}>No completed trades were generated during this period.</div>
                    ) : (
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                        <th style={{ padding: '8px' }}>#</th>
                                        <th style={{ padding: '8px' }}>Entry Date</th>
                                        <th style={{ padding: '8px' }}>Exit Date</th>
                                        <th style={{ padding: '8px' }}>Hold (Days)</th>
                                        <th style={{ padding: '8px' }}>Fees</th>
                                        <th style={{ padding: '8px' }}>Net Return</th>
                                        <th style={{ padding: '8px' }}>Net P&L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {res.trade_log.map((t, i) => (
                                        <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '8px' }}>{i + 1}</td>
                                            <td style={{ padding: '8px' }}>{t.entry_date}</td>
                                            <td style={{ padding: '8px' }}>{t.status === "OPEN" ? "OPEN" : t.exit_date}</td>
                                            <td style={{ padding: '8px' }}>{t.holding_days || '-'}</td>
                                            <td style={{ padding: '8px' }}>₹{((t.costs_entry||0) + (t.costs_exit||0)).toFixed(1)}</td>
                                            <td style={{ padding: '8px', color: (t.net_return||0) >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                {t.status === "OPEN" ? "-" : (t.net_return * 100).toFixed(2) + "%"}
                                            </td>
                                            <td style={{ padding: '8px', fontWeight: 600, color: (t.net_pnl||0) >= 0 ? 'var(--positive)' : 'var(--negative)' }}>
                                                {t.status === "OPEN" ? "-" : "₹" + t.net_pnl.toFixed(0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* METHODOLOGY */}
            <div className="glass" style={{ padding: '24px', fontSize: '0.9rem', lineHeight: '1.6', color: 'var(--text-muted)' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'white' }}>Backtesting Methodology</h3>
                <ol>
                    <li>Historical Data uses Yahoo Finance <strong>Adjusted Close</strong> metrics to inherently handle dividends and stock-splits.</li>
                    <li><strong>Look-Ahead Bias Removal:</strong> Signals are mapped using structural condition evaluations precisely at the end of Day <code style={{color: 'white'}}>T</code> (after the market close) and exclusively executed on the very next available trading session structure.</li>
                    <li><strong>Execution Assumption:</strong> Trades resolve at Day <code style={{color: 'white'}}>T+1</code> prices based on Open data if available, defaulting to close strictly where Opening prints are malformed.</li>
                    <li>Slippage modeling is intentionally abstracted directly into the <strong>Transaction Costs</strong> module allowing user parameterization of broker taxes and slippage combined.</li>
                    <li><em>Disclaimer: Historical backtest results are strictly computational analytical evaluations and are entirely <strong>not predictions of future performance</strong>. Returns are bounded intrinsically subject to past market regimes and implicit market liquidity boundaries framing execution.</em></li>
                </ol>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
