import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

const HistoryPage = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await fetch(`${API_BASE}/history`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        const data = await res.json();
        if (data.history) setHistory(data.history);
      } catch (error) {
        console.error("Error fetching history:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div>
      <h1>SMS History</h1>
      <p>View records of previously sent batches.</p>

      <div className="glass-card">
        {loading ? (
          <p>Loading history...</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Message Content</th>
                <th>Recipients</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length > 0 ? history.map(row => (
                <tr key={row.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{new Date(row.timestamp).toLocaleString()}</td>
                  <td style={{ maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={row.message}>
                    {row.message}
                  </td>
                  <td>{row.recipients_count}</td>
                  <td>
                    <span className={`badge ${row.status === 'Sent' ? 'success' : 'failed'}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="4" style={{ textAlign: 'center' }}>No SMS history found.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
