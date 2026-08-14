import React, { useState, useEffect } from 'react';

const API_BASE = "http://localhost:5050/api";

const _fmt = (val, type = 'num', decimals = 2) => {
    if (val === null || val === undefined) return 'N/A';
    if (type === 'percent') return (val * 100).toFixed(decimals) + '%';
    if (type === 'mult') return val.toFixed(decimals) + 'x';
    return val.toLocaleString(undefined, {minimumFractionDigits: decimals});
}

export default function Markets() {
  const [sectors, setSectors] = useState([]);
  
  useEffect(() => {
    fetch(`${API_BASE}/sectors`)
      .then(r => r.json())
      .then(d => { if(d.status !== 'loading') setSectors(d.data || []) });
  }, []);

  let moLead = null, valLead = null, roeLead = null;
  if(sectors.length > 0) {
      const vMo = [...sectors].filter(s => s.avg_return_52w).sort((a,b) => b.avg_return_52w - a.avg_return_52w);
      const vVal = [...sectors].filter(s => s.avg_pe).sort((a,b) => a.avg_pe - b.avg_pe);
      const vRoe = [...sectors].filter(s => s.avg_roe).sort((a,b) => b.avg_roe - a.avg_roe);
      
      if(vMo.length > 0) moLead = vMo[0];
      if(vVal.length > 0) valLead = vVal[0];
      if(vRoe.length > 0) roeLead = vRoe[0];
  }

  return (
    <div className="fade-in" style={{ paddingBottom: '60px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'white', marginBottom: '8px' }}>🌐 Global Markets & Sectors</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>Market and sector analysis across Indian equities.</p>

        {sectors.length > 0 && (
            <div className="grid-2-cols" style={{ gap: '24px', marginBottom: '24px' }}>
                <div className="glass" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Sector Leadership</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Best Momentum (52W Return)</div>
                            <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 500 }}>
                                {moLead ? `${moLead.sector} ` : 'N/A '}
                                {moLead && <span className="tabular-nums" style={{color:'var(--positive)', fontSize:'0.9rem'}}>({_fmt(moLead.avg_return_52w, 'percent')})</span>}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Best Valuation (Lowest Avg P/E)</div>
                            <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 500 }}>
                                {valLead ? `${valLead.sector} ` : 'N/A '}
                                {valLead && <span className="tabular-nums" style={{color:'var(--accent-cyan)', fontSize:'0.9rem'}}>({_fmt(valLead.avg_pe, 'mult')})</span>}
                            </div>
                        </div>
                        <div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Best Profitability (Highest Avg ROE)</div>
                            <div style={{ color: 'white', fontSize: '1.1rem', fontWeight: 500 }}>
                                {roeLead ? `${roeLead.sector} ` : 'N/A '}
                                {roeLead && <span className="tabular-nums" style={{color:'var(--positive)', fontSize:'0.9rem'}}>({_fmt(roeLead.avg_roe, 'percent')})</span>}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'white', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>Sector Insight</h3>
                    <div style={{ color: 'var(--text-color)', lineHeight: 1.6, fontSize: '0.9rem' }}>
                        {moLead ? `${moLead.sector} has uniquely documented the strongest 52-week trailing performance among tracked sectors.` : 'Evaluating insights...'}
                        <br/><br/>
                        {roeLead ? `Allocators observing structural profitability should note that ${roeLead.sector} currently evaluates to the highest mean baseline equity returns compared with its peers.` : ''}
                    </div>
                </div>
            </div>
        )}

        <div className="dense-grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
            <div className="glass col-12" style={{ padding: '24px', overflowX: 'auto' }}>
                <h3 style={{ color: 'white', marginBottom: '16px', fontSize: '1.1rem' }}>Aggregated Sector Metrics</h3>
                <table className="compact-table">
                    <thead>
                        <tr>
                            <th>Sector</th>
                            <th style={{textAlign:'right'}}>Constituents</th>
                            <th style={{textAlign:'right'}}>Avg P/E Multiplier</th>
                            <th style={{textAlign:'right'}}>Avg ROE</th>
                            <th style={{textAlign:'right'}}>52W Performance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sectors.map(s => {
                            const isPos = s.avg_return_52w >= 0;
                            return (
                                <tr key={s.sector}>
                                    <td style={{ color: 'white', fontWeight: 500 }}>{s.sector}</td>
                                    <td className="tabular-nums" style={{ textAlign:'right' }}>{s.count}</td>
                                    <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(s.avg_pe, 'mult')}</td>
                                    <td className="tabular-nums" style={{ textAlign:'right' }}>{_fmt(s.avg_roe, 'percent')}</td>
                                    <td className={`tabular-nums ${isPos ? 'positive' : 'negative'}`} style={{ textAlign:'right' }}>
                                        {_fmt(s.avg_return_52w, 'percent')}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
}
