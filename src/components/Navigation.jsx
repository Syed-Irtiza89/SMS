import React from 'react';
import { NavLink } from 'react-router-dom';
import { Users, FileText, Send, History, LogOut } from 'lucide-react';
import './Navigation.css';

const Navigation = ({ onLogout }) => {
  const navItems = [
    { path: '/contacts', icon: <Users size={20} />, label: 'Contacts' },
    { path: '/message', icon: <FileText size={20} />, label: 'Message' },
    { path: '/select-contacts', icon: <Send size={20} />, label: 'Send SMS' },
    { path: '/history', icon: <History size={20} />, label: 'History' },
  ];

  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>SMS System</h2>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>Admin Dashboard</div>
      </div>
      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <div style={{ padding: '20px', borderTop: '1px solid var(--color-border)' }}>
        <button onClick={onLogout} className="btn" style={{ width: '100%', background: 'transparent', color: 'var(--color-text-light)', border: '1px solid var(--color-border)' }}>
          <LogOut size={18} /> Logout
        </button>
      </div>
    </nav>
  );
};

export default Navigation;
