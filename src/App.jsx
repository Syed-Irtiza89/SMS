import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import ContactsPage from './pages/ContactsPage';
import MessageDraftPage from './pages/MessageDraftPage';
import SelectContactPage from './pages/SelectContactPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';

// Bug Fix: ProtectedRoute defined OUTSIDE App to prevent remounting on every render
const ProtectedRoute = ({ token, children }) => {
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
  };

  return (
    <Router>
      <div className="app-container">
        {token && <Navigation onLogout={handleLogout} />}
        <main className="main-content" style={!token ? { padding: 0 } : {}}>
          <Routes>
            <Route path="/login" element={!token ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} />
            
            <Route path="/" element={<ProtectedRoute token={token}><Navigate to="/contacts" /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute token={token}><ContactsPage /></ProtectedRoute>} />
            <Route path="/message" element={<ProtectedRoute token={token}><MessageDraftPage /></ProtectedRoute>} />
            <Route path="/select-contacts" element={<ProtectedRoute token={token}><SelectContactPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute token={token}><HistoryPage /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;

