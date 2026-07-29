const API_BASE_URL = "/api";

// Request tracing. No form data, but one line per call is noisy in production.
// console.error is left active so failures still surface.
const DEBUG = false;

// One user action can be several HTTP calls — adding a person with two parents
// is three. The undo stack needs to know they belong together, and only the
// BROWSER knows that: three separate requests would otherwise be three separate
// groups server-side, which is exactly the problem.
//
// Held in a module variable rather than threaded through every call signature.
// Safe because the write guards (writeInFlight, the submit lock) prevent two
// actions overlapping; beginAction/endAction are always paired in try/finally.
let currentActionGroup = null;

export function beginAction() {
  currentActionGroup =
    globalThis.crypto?.randomUUID?.() ||
    `a${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return currentActionGroup;
}

export function endAction() {
  currentActionGroup = null;
}

async function fetchAPI(endpoint, options = {}) {
  try {
    const headers = {
      "Content-Type": "application/json",
      ...(currentActionGroup ? { "X-Action-Group": currentActionGroup } : {}),
      ...options.headers,
    };

    DEBUG && console.log(`[API] ${options.method || 'GET'} ${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      credentials: "include",
      ...options,
    });

    DEBUG && console.log(`[API] ${endpoint} - Status: ${response.status}`);
    
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "An error occurred" }));
      console.error(`[API] ${endpoint} - Error:`, error);
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[API] Error (${endpoint}):`, error);
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
    batchDelete: (treeId, ids, label, relationshipIds) =>
      fetchAPI("/people/batch-delete", {
        method: "POST",
        body: JSON.stringify({ treeId, ids, label, relationshipIds }),
      }),
    updateBirthOrder: (id, birthOrder) =>
      fetchAPI(`/people/${id}/birthOrder`, {
        method: "PATCH",
        body: JSON.stringify({ birthOrder }),
      }),
  },

  deletions: {
    list: (treeId) => fetchAPI(`/deletions/${treeId}`),
    restore: (deletionId) =>
      fetchAPI(`/deletions/${deletionId}/restore`, {
        method: "POST",
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
    setStatus: (id, status) =>
      fetchAPI(`/relationships/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
  },

  identities: {
    list: () => fetchAPI("/auth/identities"),
    linkGoogle: (firebaseIdToken) =>
      fetchAPI("/auth/link/google", {
        method: "POST",
        body: JSON.stringify({ firebaseIdToken }),
      }),
    unlink: (id) =>
      fetchAPI(`/auth/identities/${id}`, { method: "DELETE" }),
  },

  history: {
    // Read-only. The undo path was removed — see the note in server/index.js.
    get: (treeId) => fetchAPI(`/history/${treeId}`),
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
