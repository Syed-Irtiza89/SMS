import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { mockApi } from '../api';


const LoginPage = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { ok, data, error } = await mockApi.login(username, password);
    
    if (ok) {
      onLogin(data.token);
      navigate('/');
    } else {
      setError(error || 'Invalid credentials');
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
      <div className="glass-card" style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
          <div style={{ background: 'var(--color-primary-light)', padding: '15px', borderRadius: '50%' }}>
            <Lock size={32} color="var(--color-primary)" />
          </div>
        </div>
        <h2 style={{ marginBottom: '10px' }}>Admin Portal</h2>
        <p style={{ marginBottom: '30px' }}>Sign in to access the SMS System</p>
        
        {error && (
            <div style={{ padding: '10px', marginBottom: '20px', borderRadius: '8px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid currentColor' }}>
                {error}
            </div>
        )}

        <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
          <div className="form-group">
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
             <label>Password</label>
             <input 
               type="password" 
               value={password} 
               onChange={(e) => setPassword(e.target.value)} 
               required 
             />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
            {loading ? <div className="spinner"></div> : 'Secure Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
