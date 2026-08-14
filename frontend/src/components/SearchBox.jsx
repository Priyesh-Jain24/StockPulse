import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = "http://localhost:5050/api";

export default function SearchBox() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const delay = setTimeout(() => {
      fetch(`${API_BASE}/search/${query}`)
        .then(r => r.json())
        .then(d => setResults(d.results || []))
        .catch(console.error);
    }, 400);
    return () => clearTimeout(delay);
  }, [query]);

  return (
    <div style={{ position: 'relative' }}>
      <div className="input-glass" style={{ 
        display: 'flex', alignItems: 'center', width: '250px', padding: '6px 12px'
      }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginRight: '8px' }}>🔍</span>
        <input 
          type="text" 
          placeholder="Search stocks (e.g. RELIANCE)..." 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', width: '100%', fontSize: '0.85rem' }} 
        />
      </div>

      {results.length > 0 && (
        <div className="glass fade-in" style={{ 
          position: 'absolute', top: '100%', left: 0, width: '100%', marginTop: '8px', 
          padding: '8px 0', zIndex: 1000, maxHeight: '300px', overflowY: 'auto' 
        }}>
          {results.map((r, i) => (
            <div 
              key={i} 
              onClick={() => { setQuery(''); setResults([]); navigate(`/stock/${r.symbol}`); }} 
              style={{
                padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.02)',
                display: 'flex', flexDirection: 'column'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ color: 'var(--accent-cyan)', fontSize: '0.85rem', fontWeight: 600 }}>{r.symbol}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
