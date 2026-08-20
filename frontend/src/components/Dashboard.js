import React from 'react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  };

  return (
    <div className="page-layout">
      <div className="page-card">
        <h2>Dashboard</h2>
        <p style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>
          Welcome to Concrete Mix Design Calculator. Select an option below to get started.
        </p>
        <nav style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <Link to="/calculate">
            <button type="button" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '2rem 1.5rem' }}>
              <span style={{ fontSize: '1.8rem' }}>🧮</span>
              <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Calculate Mix Design</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '400', opacity: 0.9 }}>Design new concrete mix</span>
            </button>
          </Link>
          <Link to="/history">
            <button type="button" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '2rem 1.5rem' }}>
              <span style={{ fontSize: '1.8rem' }}>📋</span>
              <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>View History</span>
              <span style={{ fontSize: '0.9rem', fontWeight: '400', opacity: 0.9 }}>See past calculations</span>
            </button>
          </Link>
          <button type="button" onClick={handleLogout} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '2rem 1.5rem', background: '#ef4444' }}>
            <span style={{ fontSize: '1.8rem' }}>🚪</span>
            <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Logout</span>
            <span style={{ fontSize: '0.9rem', fontWeight: '400', opacity: 0.9 }}>Sign out</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default Dashboard;

