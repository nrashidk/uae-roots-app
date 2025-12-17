const API_BASE_URL = '/api';

async function fetchAPI(endpoint, options = {}) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      credentials: 'include',
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

async function fetchAPIWithFile(endpoint, formData) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
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
    logout: () => fetchAPI('/auth/logout', {
      method: 'POST',
    }),
    check: () => fetchAPI('/auth/check'),
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
    search: (treeId, query) => fetchAPI(`/people/search?treeId=${treeId}&query=${encodeURIComponent(query)}`),
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

  upload: {
    photo: (file) => {
      const formData = new FormData();
      formData.append('photo', file);
      return fetchAPIWithFile('/upload/photo', formData);
    },
  },

  history: {
    get: (treeId) => fetchAPI(`/history/${treeId}`),
    undo: (historyId) => fetchAPI(`/history/undo/${historyId}`, {
      method: 'POST',
    }),
  },

  export: {
    tree: (treeId, format = 'json') => {
      const url = `${API_BASE_URL}/export/${treeId}?format=${format}`;
      
      if (format === 'json') {
        return fetchAPI(`/export/${treeId}?format=${format}`);
      }
      
      return fetch(url, {
        credentials: 'include',
      }).then(res => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      }).then(blob => {
        const extension = format === 'gedcom' ? 'ged' : format;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `family-tree.${extension}`;
        link.click();
        URL.revokeObjectURL(link.href);
        return { success: true };
      });
    },
  },
};

export function setAuthToken() {}
export function getAuthToken() { return null; }
export function clearAuthToken() {}
