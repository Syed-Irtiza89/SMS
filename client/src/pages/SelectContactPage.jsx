import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, CheckSquare, Square } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const SelectContactPage = () => {
  const [contacts, setContacts] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [messageDraft, setMessageDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const draft = localStorage.getItem('sms_draft');
    if (!draft) {
      navigate('/message');
    } else {
      setMessageDraft(draft);
    }

    const fetchContacts = async () => {
      try {
        const res = await fetch(`${API_BASE}/contacts`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
        });
        const data = await res.json();
        if (data.contacts) setContacts(data.contacts);
      } catch (error) {
        console.error("Error fetching contacts:", error);
      }
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
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(v => v !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSend = async () => {
    if (selectedIds.length === 0) return;
    
    // Quick confirmation
    if (!window.confirm(`Are you sure you want to send this SMS to ${selectedIds.length} contacts?`)) return;

    setSending(true);
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/send`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ message: messageDraft, contactIds: selectedIds })
      });
      const data = await res.json();
      
      if (res.ok) {
        setResult({ type: 'success', data });
      } else {
        setResult({ type: 'error', error: data.error || 'Failed to send batch SMS.' });
      }
    } catch (error) {
      setResult({ type: 'error', error: 'Network error communicating with server.' });
    } finally {
      setSending(false);
    }
  };

  const goHistory = () => {
    navigate('/history');
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

      {result && (
        <div style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', 
             backgroundColor: result.type === 'error' ? '#FEF2F2' : '#E6FFFA', 
             color: result.type === 'error' ? '#B91C1C' : '#047857', border: '1px solid currentColor' }}>
          {result.type === 'error' ? result.error : (
            <div>
              <strong>Batch SMS Processed:</strong><br />
              Status: {result.data.status} <br />
              Sent: {result.data.sent} <br />
              Failed: {result.data.failed} <br />
              <button onClick={goHistory} className="btn btn-secondary" style={{ marginTop: '10px', padding: '6px 12px' }}>View History</button>
            </div>
          )}
        </div>
      )}

      <div className="glass-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>Contacts Directory</h3>
          <button 
            className="btn btn-primary" 
            disabled={selectedIds.length === 0 || sending}
            onClick={handleSend}
          >
            {sending ? <div className="spinner"></div> : <><Send size={18} /> Send to {selectedIds.length}</>}
          </button>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>
                <input 
                  type="checkbox" 
                  className="custom-checkbox"
                  checked={selectedIds.length === contacts.length && contacts.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Name</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length > 0 ? contacts.map(c => (
              <tr key={c.id}>
                <td>
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
              <tr><td colSpan="3" style={{ textAlign: 'center' }}>No contacts found. Go back and upload some!</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SelectContactPage;
