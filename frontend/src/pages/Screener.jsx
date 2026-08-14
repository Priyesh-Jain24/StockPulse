import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = "http://localhost:5050/api";

const _fmt = (val, type = 'num', decimals = 2) => {
    if (val === null || val === undefined) return 'N/A';
    if (type === 'percent') return (val * 100).toFixed(decimals) + '%';
    if (type === 'price') return '₹' + val.toLocaleString(undefined, {minimumFractionDigits: decimals});
    if (type === 'money') return '₹' + (val / 10000000).toFixed(0) + 'Cr';
    if (type === 'mult') return val.toFixed(decimals) + 'x';
    return val.toLocaleString(undefined, {minimumFractionDigits: decimals});
}

export default function Screener() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPreset, setFilterPreset] = useState('ALL');

  const fetchScreener = () => {
    setLoading(true);
    fetch(`${API_BASE}/screener`)
      .then(r => r.json())
      .then(res => {
        if (res.status === 'loading') {
          setTimeout(fetchScreener, 2000); // poll
        } else {
          setData(res.data || []);
          setLoading(false);
        }
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchScreener();
  }, []);

  const getFilteredData = () => {
      if (filterPreset === 'ALL') return data;
      return data.filter(d => {
          if (filterPreset === 'QUALITY') {
              return (d.roe !== null && d.roe > 0.15) && (d.profitGrowth !== null && d.profitGrowth > 0);
          }
          if (filterPreset === 'VALUE') {
              return (d.pe !== null && d.pe > 0 && d.pe < 25) && (d.pb !== null && d.pb > 0 && d.pb < 5) && (d.profitGrowth !== null && d.profitGrowth > 0);
          }
          if (filterPreset === 'GROWTH') {
              return (d.revenueGrowth !== null && d.revenueGrowth > 0.10) && (d.profitGrowth !== null && d.profitGrowth > 0);
          }
          if (filterPreset === 'MOMENTUM') {
              return (d.fiftyTwoWeekReturn !== null && d.fiftyTwoWeekReturn > 0.15);
          }
          return true;
      });
  };

  const filtered = getFilteredData();

  return (
    <div className="fade-in" style={{ padding: '24px', paddingBottom: '60px' }}>
      <div className="glass" style={{ padding: '24px', borderRadius: '12px', marginBottom: '24px' }}>
        <h2 className="chart-header__title"><span className="blue">🔍</span> Advanced Stock Screener</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Filter fundamentally robust equities strictly enforcing non-null value parameters.</p>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
            <button 
                className="btn-glass"
                onClick={() => setFilterPreset('ALL')}
                style={filterPreset === 'ALL' ? { background: 'var(--accent-cyan)', color: 'black', borderColor: 'var(--accent-cyan)' } : {}}
            >
                All Stocks
            </button>
            <button 
                className="btn-glass"
                onClick={() => setFilterPreset('QUALITY')}
                style={filterPreset === 'QUALITY' ? { background: 'var(--positive)', color: 'black', borderColor: 'var(--positive)' } : {}}
            >
                Quality (ROE &gt; 15%, Positive Growth)
            </button>
            <button 
                className="btn-glass"
                onClick={() => setFilterPreset('VALUE')}
                style={filterPreset === 'VALUE' ? { background: '#eab308', color: 'black', borderColor: '#eab308' } : {}}
            >
                Value (P/E &lt; 25, P/B &lt; 5)
            </button>
            <button 
                className="btn-glass"
                onClick={() => setFilterPreset('GROWTH')}
                style={filterPreset === 'GROWTH' ? { background: '#a855f7', color: 'white', borderColor: '#a855f7' } : {}}
            >
                Growth (Rev Growth &gt; 10%)
            </button>
            <button 
                className="btn-glass"
                onClick={() => setFilterPreset('MOMENTUM')}
                style={filterPreset === 'MOMENTUM' ? { background: '#3b82f6', color: 'white', borderColor: '#3b82f6' } : {}}
            >
                Momentum (52W &gt; 15%)
            </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            Loading screener data from global cache...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ padding: '0 0 16px 0', color: 'var(--text-muted)' }}>{filtered.length} equities explicitly match your bounds.</div>
            <table className="compact-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '12px' }}>Symbol</th>
                  <th style={{ padding: '12px' }}>Sector</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Price (₹)</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>P/E</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>P/B</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>ROE</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>D/E</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Rev Gr</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Score</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>52W Return</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }} onClick={() => navigate(`/stock/${d.symbol}`)}>
                    <td style={{ padding: '12px', fontWeight: 'bold', color: 'white' }}>{d.symbol}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{d.sector}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }} className="tabular-nums">{_fmt(d.price, 'price')}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }} className="tabular-nums">{_fmt(d.pe, 'mult')}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }} className="tabular-nums">{_fmt(d.pb, 'mult')}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }} className="tabular-nums">{_fmt(d.roe, 'percent')}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }} className="tabular-nums">{_fmt(d.debtToEquity, 'num', 1)}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }} className={`tabular-nums ${(d.revenueGrowth || 0) >= 0 ? 'positive' : 'negative'}`}>{_fmt(d.revenueGrowth, 'percent')}</td>
                    <td style={{ padding: '12px', textAlign: 'right', color: 'var(--accent-cyan)' }} className="tabular-nums">{d.stockpulseScore?.total || 'N/A'}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }} className={`tabular-nums ${d.fiftyTwoWeekReturn >= 0 ? 'positive' : 'negative'}`}>
                      {_fmt(d.fiftyTwoWeekReturn, 'percent')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
