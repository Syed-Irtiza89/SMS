const API_BASE_URL = 'http://localhost:5000/api';

const getHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  login: async (username, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      if (response.ok) {
        localStorage.setItem('auth_token', data.token);
        return { ok: true, data };
      }
      return { ok: false, error: data.error };
    } catch (e) {
      return { ok: false, error: 'Connection failed' };
    }
  },

  getContacts: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/contacts`, {
        headers: getHeaders()
      });
      const data = await response.json();
      return { ok: response.ok, data };
    } catch (e) {
      return { ok: false, error: 'Connection failed' };
    }
  },

  addContact: async (name, phone) => {
    try {
      const response = await fetch(`${API_BASE_URL}/contacts`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, phone })
      });
      const data = await response.json();
      return { ok: response.ok, data };
    } catch (e) {
      return { ok: false, error: 'Connection failed' };
    }
  },

  deleteContact: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/contacts/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      return { ok: response.ok };
    } catch (e) {
      return { ok: false, error: 'Connection failed' };
    }
  },

  uploadContacts: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${API_BASE_URL}/contacts/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: formData
      });
      const data = await response.json();
      return { ok: response.ok, data };
    } catch (e) {
      return { ok: false, error: 'Connection failed' };
    }
  },

  sendSMS: async (message, contactIds) => {
    try {
      const response = await fetch(`${API_BASE_URL}/send-sms`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ message, contactIds })
      });
      const data = await response.json();
      return { ok: response.ok, data };
    } catch (e) {
      return { ok: false, error: 'Connection failed' };
    }
  },

  getHistory: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/history`, {
        headers: getHeaders()
      });
      const data = await response.json();
      return { ok: response.ok, data };
    } catch (e) {
      return { ok: false, error: 'Connection failed' };
    }
  }
};

// Keep mockApi export for compatibility if any component still uses it explicitly
export const mockApi = api;

