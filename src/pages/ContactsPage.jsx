import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { UploadCloud, Plus, Trash2 } from 'lucide-react';
import { mockApi } from '../api';


const ContactsPage = () => {
  const [contacts, setContacts] = useState([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState({ text: '', type: '' });

  const fetchContacts = async () => {
    const { ok, data } = await mockApi.getContacts();
    if (ok) setContacts(data.contacts);
  };

  useEffect(() => {
    fetchContacts();
  }, []);

  const handleAddContact = async (e) => {
    e.preventDefault();
    if (!name || !phone) return;
    setLoading(true);
    const { ok, data, error } = await mockApi.addContact(name, phone);
    if (ok) {
      setMsg({ text: 'Contact added successfully!', type: 'success' });
      setName('');
      setPhone('');
      fetchContacts();
    } else {
      setMsg({ text: error || 'Failed to add contact', type: 'error' });
    }
    setLoading(false);
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this contact?")) return;
    const { ok } = await mockApi.deleteContact(id);
    if (ok) {
      setMsg({ text: 'Contact deleted successfully!', type: 'success' });
      fetchContacts();
    }
    setTimeout(() => setMsg({ text: '', type: '' }), 3000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { ok, data } = await mockApi.uploadContacts(results.data);
        if (ok) {
          setMsg({ text: `Upload complete. Added: ${data.inserted}.`, type: 'success' });
          fetchContacts();
        }
        setUploading(false);
        e.target.value = null;
        setTimeout(() => setMsg({ text: '', type: '' }), 4000);
      }
    });
  };

  return (
    <div>
      <h1>Manage Contacts</h1>
      <p>Add individual contacts or upload a CSV list to quickly populate your database.</p>

      {msg.text && (
        <div style={{ marginBottom: '20px', padding: '10px', borderRadius: '8px', 
             backgroundColor: msg.type === 'error' ? '#FEF2F2' : '#E6FFFA', 
             color: msg.type === 'error' ? '#B91C1C' : '#047857', border: '1px solid currentColor' }}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
        <div className="glass-card">
          <h3>Add Manually</h3>
          <form onSubmit={handleAddContact}>
            <div className="form-group">
              <label>Name</label>
              <input 
                type="text" 
                placeholder="John Doe" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input 
                type="text" 
                placeholder="+1234567890" 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <div className="spinner"></div> : <><Plus size={18} /> Add Contact</>}
            </button>
          </form>
        </div>

        <div className="glass-card">
          <h3>Upload via CSV</h3>
          <p style={{ fontSize: '0.9rem' }}>Ensure your CSV header contains `name` and `phone`.</p>
          <div style={{
            border: '2px dashed var(--color-border)',
            borderRadius: 'var(--border-radius)',
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--color-surface)',
            cursor: 'pointer',
            position: 'relative'
          }}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              style={{
                opacity: 0,
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                cursor: 'pointer'
              }}
            />
            <UploadCloud size={48} color="var(--color-primary)" style={{ marginBottom: '15px' }} />
            <h4 style={{ color: 'var(--color-text-dark)', marginBottom: '5px' }}>Drag & Drop or Click to Upload</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
              {uploading ? 'Processing CSV...' : 'Supports .CSV files'}
            </p>
          </div>
        </div>
      </div>

      <div className="glass-card" style={{ marginTop: '30px' }}>
        <h3>Your Contacts ({contacts.length})</h3>
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Phone</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {contacts.length > 0 ? contacts.map(c => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.phone}</td>
                <td style={{ textAlign: 'center' }}>
                    <button 
                      onClick={() => handleDelete(c.id)} 
                      style={{ background: 'transparent', border: 'none', color: '#B91C1C', cursor: 'pointer' }}
                      title="Delete Contact"
                    >
                        <Trash2 size={18} />
                    </button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="4" style={{ textAlign: 'center' }}>No contacts found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ContactsPage;
