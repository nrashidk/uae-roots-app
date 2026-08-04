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

// One place the app learns its session has ended. api.js cannot navigate or
// render, so it raises the fact and App.jsx decides what to do about it.
let sessionEndedHandler = null;
let sessionEndedNotified = false;

export function onSessionEnded(handler) {
  sessionEndedHandler = handler;
}

function notifySessionEnded(message) {
  // Once per session. A single expiry can fail five in-flight requests at the
  // same moment, and five alerts is worse than none.
  if (sessionEndedNotified) return;
  sessionEndedNotified = true;
  try {
    sessionEndedHandler?.(message);
  } catch (error) {
    console.error("Session-ended handler failed:", error);
  }
}

// Called after a successful sign-in, so the next expiry is announced again.
export function resetSessionEndedNotice() {
  sessionEndedNotified = false;
}

// Has the session already ended? Callers use this to stay quiet about their own
// failure — "فشل في إضافة الشخص" is noise when the reason is that you were signed
// out, and the banner says so already.
export function isSessionEnded() {
  return sessionEndedNotified;
}

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

      // The session is gone — expired, terminated by a sign-in elsewhere, or
      // never there. Tell the app ONCE, centrally, instead of leaving every
      // caller to show its own error and carry on: without this the user stays on
      // a screen that looks signed in while every request fails, which is what
      // happened when a session ended mid-edit.
      if (response.status === 401 && error?.sessionEnded) {
        notifySessionEnded(error.error);
      }

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
    // proof is the re-authentication the server demands: { firebaseIdToken } for a
    // Google session, { phoneNumber, code } for a phone one.
    delete: (id, proof = {}) =>
      fetchAPI(`/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        body: JSON.stringify(proof),
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
    // The code itself is sent by api.auth.sendSmsCode — this only checks it and
    // attaches the identity, instead of issuing a session the way login does.
    sendPhoneCode: (phoneNumber) =>
      fetchAPI("/auth/link/phone/send", {
        method: "POST",
        body: JSON.stringify({ phoneNumber }),
      }),
    linkPhone: (phoneNumber, code) =>
      fetchAPI("/auth/link/phone", {
        method: "POST",
        body: JSON.stringify({ phoneNumber, code }),
      }),
    unlink: (id) =>
      fetchAPI(`/auth/identities/${id}`, { method: "DELETE" }),
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
