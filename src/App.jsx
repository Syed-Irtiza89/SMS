import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './components/Navigation';
import ContactsPage from './pages/ContactsPage';
import MessageDraftPage from './pages/MessageDraftPage';
import SelectContactPage from './pages/SelectContactPage';
import HistoryPage from './pages/HistoryPage';
import LoginPage from './pages/LoginPage';

function App() {
  const [token, setToken] = useState(localStorage.getItem('auth_token'));

  const handleLogin = (newToken) => {
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setToken(null);
  };

  // Protected Route Wrapper
  const ProtectedRoute = ({ children }) => {
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  return (
    <Router>
      <div className="app-container">
        {token && <Navigation onLogout={handleLogout} />}
        <main className="main-content" style={!token ? { padding: 0 } : {}}>
          <Routes>
            <Route path="/login" element={!token ? <LoginPage onLogin={handleLogin} /> : <Navigate to="/" />} />
            
            <Route path="/" element={<ProtectedRoute><Navigate to="/contacts" /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
            <Route path="/message" element={<ProtectedRoute><MessageDraftPage /></ProtectedRoute>} />
            <Route path="/select-contacts" element={<ProtectedRoute><SelectContactPage /></ProtectedRoute>} />
            <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
