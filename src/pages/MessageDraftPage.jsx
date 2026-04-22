import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

const MessageDraftPage = () => {
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  // Load drafted message if exists
  useEffect(() => {
    const saved = localStorage.getItem('sms_draft');
    if (saved) setMessage(saved);
  }, []);

  const handleContinue = () => {
    if (!message.trim()) return;
    localStorage.setItem('sms_draft', message);
    navigate('/select-contacts');
  };

  return (
    <div>
      <h1>Draft Message</h1>
      <p>Compose the standard SMS message you wish to send to your target leads.</p>

      <div className="glass-card" style={{ maxWidth: '800px' }}>
        <div className="form-group">
          <label>Standard Message Content</label>
          <textarea 
            rows="8"
            placeholder="Hi there! We have an exclusive offer for you..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ resize: 'vertical' }}
          ></textarea>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)' }}>
            Characters: {message.length} (1 SMS roughly 160 chars)
          </span>
          <button 
            className="btn btn-primary" 
            onClick={handleContinue}
            disabled={!message.trim()}
          >
            Select Contacts <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageDraftPage;
