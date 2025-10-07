// Use relative URL - Vite proxy will forward to backend
const API_BASE_URL = '/api';

async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
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
  trees: {
    getAll: () => fetchAPI('/trees'),
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
