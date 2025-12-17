const API_BASE_URL = '/api';

let authToken = null;

export function setAuthToken(token) {
  authToken = token;
  if (token) {
    localStorage.setItem('uae_roots_token', token);
  } else {
    localStorage.removeItem('uae_roots_token');
  }
}

export function getAuthToken() {
  if (!authToken) {
    authToken = localStorage.getItem('uae_roots_token');
  }
  return authToken;
}

export function clearAuthToken() {
  authToken = null;
  localStorage.removeItem('uae_roots_token');
}

async function fetchAPI(endpoint, options = {}) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'An error occurred' }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

export const api = {
  auth: {
    getToken: (userId, provider, firebaseIdToken) => fetchAPI('/auth/token', {
      method: 'POST',
      body: JSON.stringify({ userId, provider, firebaseIdToken }),
    }),
    sendSmsCode: (phoneNumber) => fetchAPI('/sms/send-code', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    }),
    verifySmsCode: (phoneNumber, code) => fetchAPI('/sms/verify-code', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, code }),
    }),
  },

  users: {
    createOrUpdate: (data) => fetchAPI('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    get: (id) => fetchAPI(`/users/${id}`),
    update: (id, data) => fetchAPI(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => fetchAPI(`/users/${id}`, {
      method: 'DELETE',
    }),
  },

  trees: {
    getAll: (userId) => fetchAPI(userId ? `/trees?userId=${userId}` : '/trees'),
    create: (data) => fetchAPI('/trees', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delete: (id) => fetchAPI(`/trees/${id}`, {
      method: 'DELETE',
    }),
  },

  people: {
    getAll: (treeId) => fetchAPI(`/people?treeId=${treeId}`),
    create: (data) => fetchAPI('/people', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    update: (id, data) => fetchAPI(`/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delete: (id) => fetchAPI(`/people/${id}`, {
      method: 'DELETE',
    }),
    updateBirthOrder: (id, birthOrder) => fetchAPI(`/people/${id}/birthOrder`, {
      method: 'PATCH',
      body: JSON.stringify({ birthOrder }),
    }),
  },

  relationships: {
    getAll: (treeId) => fetchAPI(`/relationships?treeId=${treeId}`),
    create: (data) => fetchAPI('/relationships', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delete: (id) => fetchAPI(`/relationships/${id}`, {
      method: 'DELETE',
    }),
  },
};
