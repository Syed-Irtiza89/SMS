// Mock API Service using LocalStorage
// This replaces the backend calls since we are now frontend-only.

const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  CONTACTS: 'sms_contacts',
  HISTORY: 'sms_history'
};

// Initialize with some mock data if empty
const initMockData = () => {
  if (!localStorage.getItem(STORAGE_KEYS.CONTACTS)) {
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify([
      { id: 1, name: 'Sample Lead 1', phone: '+1234567890' },
      { id: 2, name: 'Sample Lead 2', phone: '+1987654321' }
    ]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.HISTORY)) {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify([]));
  }
};

initMockData();

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApi = {
  login: async (username, password) => {
    await delay(800);
    if (username === 'admin' && password === 'password') {
      const token = 'mock-jwt-token-' + Date.now();
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
      return { ok: true, data: { token } };
    }
    return { ok: false, error: 'Invalid username or password (use admin/password)' };
  },

  getContacts: async () => {
    await delay(500);
    const contacts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS) || '[]');
    return { ok: true, data: { contacts } };
  },

  addContact: async (name, phone) => {
    await delay(500);
    const contacts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS) || '[]');
    const newContact = { id: Date.now(), name, phone };
    contacts.push(newContact);
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    return { ok: true, data: newContact };
  },

  deleteContact: async (id) => {
    await delay(500);
    let contacts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS) || '[]');
    contacts = contacts.filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(contacts));
    return { ok: true };
  },

  uploadContacts: async (fileContent) => {
    await delay(1000);
    // Note: In real frontend-only, we parse CSV on client. 
    // This function assumes we passed the parsed contacts or it handles parsing.
    // For simplicity, let's assume this is called with an array of contacts.
    const contacts = JSON.parse(localStorage.getItem(STORAGE_KEYS.CONTACTS) || '[]');
    const newContacts = fileContent.map((c, index) => ({
      id: Date.now() + index,
      name: c.name || 'Unknown',
      phone: c.phone || ''
    }));
    const updated = [...contacts, ...newContacts];
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(updated));
    return { ok: true, data: { inserted: newContacts.length, skipped: 0 } };
  },

  sendSMS: async (message, contactIds) => {
    await delay(1500);
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    const newEntry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      message,
      recipients_count: contactIds.length,
      status: 'Sent'
    };
    history.unshift(newEntry);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history));
    return { ok: true, data: { status: 'Sent', sent: contactIds.length, failed: 0 } };
  },

  getHistory: async () => {
    await delay(500);
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
    return { ok: true, data: { history } };
  }
};
