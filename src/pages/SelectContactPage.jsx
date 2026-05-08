import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Users } from 'lucide-react';
import { api } from '../api';

const SelectContactPage = () => {
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const draft = localStorage.getItem('sms_draft');
    if (!draft) {
      navigate('/message');
      return;
    }
    setMessageDraft(draft);

    const fetchContacts = async () => {
      setLoadingContacts(true);
      const { ok, data } = await api.getContacts();
      if (ok) setContacts(data.contacts || []);
      setLoadingContacts(false);
    };
    fetchContacts();
  }, [navigate]);

  const handleSelectAll = () => {
    if (selectedIds.length === contacts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(contacts.map(c => c.id));
    }
  };

  const handleToggle = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Send this SMS to ${selectedIds.length} contact${selectedIds.length !== 1 ? 's' : ''}?`)) return;

    setSending(true);
    setResult(null);

    const { ok, data, error } = await api.sendSMS(messageDraft, selectedIds);
    if (ok) {
      setResult({ type: 'success', data });
      // Clear the draft after a successful send
      localStorage.removeItem('sms_draft');
    } else {
      setResult({ type: 'error', error: error || 'Failed to send SMS.' });
    }
    setSending(false);
  };

  return (
    <div>
      <h1>Select Recipients</h1>
      <p>Choose the contacts who will receive your drafted message.</p>

      {/* Message Preview */}
      <div className="glass-card" style={{ marginBottom: '20px', padding: '15px' }}>
        <h4 style={{ margin: '0 0 10px 0', color: 'var(--color-primary)' }}>Message Preview:</h4>
        <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--color-text-dark)' }}>"{messageDraft}"</p>
      </div>

      {/* Result Banner */}
      {result && (
        <div style={{
          marginBottom: '20px', padding: '15px', borderRadius: '8px',
          backgroundColor: result.type === 'error' ? '#FEF2F2' : '#E6FFFA',
          color: result.type === 'error' ? '#B91C1C' : '#047857',
          border: '1px solid currentColor'
        }}>
          {result.type === 'error' ? result.error : (
            <div>
              <strong>✅ Batch SMS Processed</strong><br />
              Status: <strong>{result.data.status}</strong>{result.data.simulation ? ' (Simulation Mode)' : ''}<br />
              Sent: <strong>{result.data.sent}</strong> &nbsp;|&nbsp;
              Failed: <strong>{result.data.failed}</strong> &nbsp;|&nbsp;
              Total: <strong>{result.data.total}</strong><br />
              {result.data.errors && result.data.errors.length > 0 && (
                <details style={{ marginTop: '8px' }}>
                  <summary style={{ cursor: 'pointer' }}>Show failed numbers ({result.data.errors.length})</summary>
                  <ul style={{ margin: '8px 0 0 16px', fontSize: '0.85rem' }}>
                    {result.data.errors.map((e, i) => (
                      <li key={i}>{e.number}: {e.error}</li>
                    ))}
                  </ul>
                </details>
              )}
              <button onClick={() => navigate('/history')} className="btn btn-secondary"
                style={{ marginTop: '10px', padding: '6px 12px' }}>
                View History
              </button>
            </div>
          )}
        </div>
      )}

      {/* Contacts Table */}
      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>
            <Users size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Contacts Directory
            {contacts.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: '0.85rem', fontWeight: 400, color: 'var(--color-text-light)' }}>
                ({selectedIds.length} of {contacts.length} selected)
              </span>
            )}
          </h3>
          <button
            className="btn btn-primary"
            disabled={selectedIds.length === 0 || sending}
            onClick={handleSend}
          >
            {sending
              ? <><div className="spinner" /> Sending…</>
              : <><Send size={18} /> Send to {selectedIds.length}</>
            }
          </button>
        </div>

        {loadingContacts ? (
          <p style={{ textAlign: 'center', padding: '20px' }}>Loading contacts…</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '50px' }}>
                  <input
                    type="checkbox"
                    className="custom-checkbox"
                    checked={selectedIds.length === contacts.length && contacts.length > 0}
                    onChange={handleSelectAll}
                    title="Select / deselect all"
                  />
                </th>
                <th>Name</th>
                <th>Phone</th>
              </tr>
            </thead>
            <tbody>
              {contacts.length > 0 ? contacts.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => handleToggle(c.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="custom-checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => handleToggle(c.id)}
                    />
                  </td>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '30px' }}>
                    No contacts found. <a href="/contacts" style={{ color: 'var(--color-primary)' }}>Add some first!</a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SelectContactPage;
