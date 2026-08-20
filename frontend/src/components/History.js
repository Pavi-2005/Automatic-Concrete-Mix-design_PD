import React, { useState, useEffect } from 'react';
import { mixAPI } from '../services/api';
import { Link, useNavigate } from 'react-router-dom';

const History = () => {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);

  useEffect(() => {
    mixAPI.history().then(({ data }) => setHistory(data));
  }, []);

  const downloadPDF = (id) => {
    mixAPI.pdf(id).then(({ data }) => {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mix-${id}.pdf`;
      a.click();
    });
  };

  const downloadExcel = (id) => {
    mixAPI.excel(id).then(({ data }) => {
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mix-${id}.xlsx`;
      a.click();
    });
  };

  return (
    <div className="page-layout">
      <div className="page-card">
        <button type="button" onClick={() => navigate('/dashboard')} style={{ marginBottom: '1.5rem', background: '#6b7280', alignSelf: 'flex-start' }}>
          ← Back to Dashboard
        </button>
        <h2>📋 Calculation History</h2>
        {history.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
            borderRadius: '12px',
            color: '#6b7280'
          }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No calculations yet</p>
            <p style={{ fontSize: '0.95rem' }}>Start by creating a new mix design to see calculations here</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Grade</th>
                <th>Specimen</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.map(mix => (
                <tr key={mix._id}>
                  <td>
                    <span className="badge" style={{ background: '#1e40af', color: 'white' }}>
                      {mix.inputData.grade}
                    </span>
                  </td>
                  <td>
                    <span className="badge" style={{ background: '#059669', color: 'white' }}>
                      {mix.inputData.specimenType ? mix.inputData.specimenType.charAt(0).toUpperCase() + mix.inputData.specimenType.slice(1) : 'Cube'}
                    </span>
                  </td>
                  <td style={{ color: '#6b7280' }}>
                    {new Date(mix.createdAt).toLocaleDateString('en-IN', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <Link to={`/result/${mix._id}`}>
                        <button type="button" className="btn-small" style={{ background: '#1e40af' }}>
                          📄 View
                        </button>
                      </Link>
                      <button type="button" className="btn-small" onClick={() => downloadPDF(mix._id)} style={{ background: '#ef4444' }}>
                        📥 PDF
                      </button>
                      <button type="button" className="btn-small" onClick={() => downloadExcel(mix._id)} style={{ background: '#10b981' }}>
                        📊 Excel
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default History;

