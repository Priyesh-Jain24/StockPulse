import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import Screener from './pages/Screener';
import BacktestLab from './pages/BacktestLab';
import StockDetail from './pages/StockDetail';
import Compare from './pages/Compare';
import Portfolio from './pages/Portfolio';
import Markets from './pages/Markets';
import SearchBox from './components/SearchBox';

function NavLinkItem({ to, children }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`nav-item ${isActive ? 'active' : ''}`}>
      {children}
    </Link>
  );
}

const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "http://localhost:5050/api";

function App() {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/health/data`)
      .then(res => res.json())
      .then(data => setHealth(data))
      .catch(() => setHealth({ status: 'offline', message: "Backend offline or completely unreachable." }));
  }, []);

  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        
        <header className="glass" style={{
          position: 'sticky', top: 0, zIndex: 100, 
          borderBottom: '1px solid var(--border-color)',
          borderTop: 'none', borderLeft: 'none', borderRight: 'none',
          borderRadius: 0, padding: '0 24px', height: '60px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          backdropFilter: 'blur(10px)', backgroundColor: 'rgba(22, 27, 34, 0.85)'
        }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '32px' }}>
            <Link to="/" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--accent-cyan)', fontSize: '1.2rem' }}>⚡</span>
                <span style={{ fontWeight: 600, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'white' }}>StockPulse</span>
              </div>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '-2px' }}>
                Indian Equity Intelligence
              </span>
            </Link>

            <nav style={{ display: 'flex', gap: '4px' }}>
              <NavLinkItem to="/">Dashboard</NavLinkItem>
              <NavLinkItem to="/markets">Markets</NavLinkItem>
              <NavLinkItem to="/screener">Screener</NavLinkItem>
              <NavLinkItem to="/compare">Compare</NavLinkItem>
              <NavLinkItem to="/portfolio">Portfolio</NavLinkItem>
              <NavLinkItem to="/lab">Strategy Lab</NavLinkItem>
            </nav>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <SearchBox />
            <button className="nav-item" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>Watchlist</button>
            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-cyan), var(--accent-purple))', cursor: 'pointer' }}></div>
          </div>
        </header>

        {health && health.status !== 'healthy' && (
          <div style={{ background: health.status === 'offline' ? '#EF4444' : '#F59E0B', color: 'black', padding: '10px 24px', textAlign: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
            ⚠️ {health.message || "Market data temporarily unavailable. Showing cached data where possible."}
          </div>
        )}

        <main style={{ flex: 1, padding: '24px', maxWidth: '1440px', margin: '0 auto', width: '100%' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/screener" element={<Screener />} />
            <Route path="/lab" element={<BacktestLab />} />
            <Route path="/stock/:symbol" element={<StockDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
