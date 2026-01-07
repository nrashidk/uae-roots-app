const API_BASE_URL = "/api";

async function fetchAPI(endpoint, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      credentials: "include",
      ...options,
    });

    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "An error occurred" }));
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
    getToken: (userId, provider, firebaseIdToken, email) =>
      fetchAPI("/auth/token", {
        method: "POST",
        body: JSON.stringify({ userId, provider, firebaseIdToken, email }),
      }),
    sendSmsCode: (phoneNumber) =>
      fetchAPI("/sms/send-code", {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      }),
    verifySmsCode: (phoneNumber, code) =>
      fetchAPI("/sms/verify-code", {
        method: "POST",
        body: JSON.stringify({ phoneNumber, code }),
      }),
    logout: () =>
      fetchAPI("/auth/logout", {
        method: "POST",
      }),
    check: () => fetchAPI("/auth/check"),
  },

  users: {
    createOrUpdate: (data) =>
      fetchAPI("/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    get: (id) => fetchAPI(`/users/${encodeURIComponent(id)}`),
    update: (id, data) =>
      fetchAPI(`/users/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      fetchAPI(`/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
  },

  trees: {
    getAll: (userId) =>
      fetchAPI(
        userId ? `/trees?userId=${encodeURIComponent(userId)}` : "/trees",
      ),
    create: (data) =>
      fetchAPI("/trees", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      fetchAPI(`/trees/${id}`, {
        method: "DELETE",
      }),
  },

  people: {
    getAll: (treeId) => fetchAPI(`/people?treeId=${treeId}`),
    search: (treeId, query) =>
      fetchAPI(
        `/people/search?treeId=${treeId}&query=${encodeURIComponent(query)}`,
      ),
    create: (data) =>
      fetchAPI("/people", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id, data) =>
      fetchAPI(`/people/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      fetchAPI(`/people/${id}`, {
        method: "DELETE",
      }),
    updateBirthOrder: (id, birthOrder) =>
      fetchAPI(`/people/${id}/birthOrder`, {
        method: "PATCH",
        body: JSON.stringify({ birthOrder }),
      }),
  },

  relationships: {
    getAll: (treeId) => fetchAPI(`/relationships?treeId=${treeId}`),
    create: (data) =>
      fetchAPI("/relationships", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id) =>
      fetchAPI(`/relationships/${id}`, {
        method: "DELETE",
      }),
  },

  history: {
    get: (treeId) => fetchAPI(`/history/${treeId}`),
    undo: (historyId) =>
      fetchAPI(`/history/undo/${historyId}`, {
        method: "POST",
      }),
  },

  export: {
    tree: (treeId, format = "json") => {
      const url = `${API_BASE_URL}/export/${treeId}?format=${format}`;

      if (format === "json") {
        return fetchAPI(`/export/${treeId}?format=${format}`);
      }

      return fetch(url, {
        credentials: "include",
      })
        .then((res) => {
          if (!res.ok) throw new Error("Export failed");
          return res.blob();
        })
        .then((blob) => {
          const extension = format === "gedcom" ? "ged" : format;
          const link = document.createElement("a");
          link.href = URL.createObjectURL(blob);
          link.download = `family-tree.${extension}`;
          link.click();
          URL.revokeObjectURL(link.href);
          return { success: true };
        });
    },
  },
};

// Store only resolvedUserId in memory (JWT stays in httpOnly cookie for security)
let authState = {
  resolvedUserId: null,
  timestamp: null,
};

export function setAuthToken(token, userId) {
  if (userId) {
    authState = {
      resolvedUserId: userId,
      timestamp: Date.now(),
    };
  }
}

export function getAuthToken() {
  if (authState.resolvedUserId) {
    return authState;
  }
  return null;
}

export function clearAuthToken() {
  authState = {
    resolvedUserId: null,
    timestamp: null,
  };
}
