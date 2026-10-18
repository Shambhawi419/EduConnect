// Same-origin now, so no API base URL and no credentials:'include' juggling —
// cookies are sent automatically. Relative paths only.
const API_BASE = '/api';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// The CSRF token is held in memory rather than read from document.cookie, so the
// same code works whether or not the cookie is readable by JS.
let csrfToken = null;
let csrfInFlight = null;

async function fetchCsrfToken() {
  const res = await fetch(`${API_BASE}/csrf`);
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  csrfToken = data.csrfToken || null;
  return csrfToken;
}

// Collapses concurrent callers onto one request so a burst of mutations doesn't
// fire several /csrf calls at once.
async function ensureCsrfToken() {
  if (csrfToken) return csrfToken;
  if (!csrfInFlight) {
    csrfInFlight = fetchCsrfToken().finally(() => {
      csrfInFlight = null;
    });
  }
  return csrfInFlight;
}

async function rawRequest(path, { method = 'GET', body, isForm } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';

  if (MUTATING_METHODS.has(method)) {
    const token = await ensureCsrfToken();
    if (token) headers['X-CSRF-Token'] = token;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// Several requests can 401 at once when the access cookie expires. Each one used
// to call /auth/refresh itself, and the second refresh with an already-rotated
// token looks like theft to the server. All callers now share one in-flight call.
let refreshInFlight = null;

function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = rawRequest('/auth/refresh', { method: 'POST' }).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function request(path, options = {}) {
  let { res, data } = await rawRequest(path, options);
  if (res.ok) return data;

  // A stale CSRF token: drop the cached one, fetch fresh, retry once.
  if (res.status === 403 && /csrf/i.test(data.message || '')) {
    csrfToken = null;
    await ensureCsrfToken();
    ({ res, data } = await rawRequest(path, options));
    if (res.ok) return data;
  }

  // The access cookie is short-lived — silently refresh and replay once.
  const isAuthFlow =
    path === '/auth/refresh' || path === '/auth/login' || path === '/auth/register';
  if (res.status === 401 && !isAuthFlow) {
    const refreshed = await refreshSession();
    // 409 means another tab/request refreshed a moment ago; its new cookies are
    // already in place, so wait briefly and replay.
    const raced = refreshed.res.status === 409;
    if (refreshed.res.ok || raced) {
      if (raced) await new Promise((resolve) => setTimeout(resolve, 300));
      const retry = await rawRequest(path, options);
      if (retry.res.ok) return retry.data;
      throw new Error(retry.data.message || 'Request failed');
    }
  }

  throw new Error(data.message || 'Request failed');
}

export const api = {
  primeCsrf: () => ensureCsrfToken(),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  verifyMfaLogin: (payload) => request('/auth/mfa/verify-login', { method: 'POST', body: payload }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  logoutAll: () => request('/auth/logout-all', { method: 'POST' }),
  me: () => request('/auth/me'),
  mfaSetup: () => request('/auth/mfa/setup', { method: 'POST' }),
  mfaEnable: (code) => request('/auth/mfa/enable', { method: 'POST', body: { code } }),
  mfaDisable: (code) => request('/auth/mfa/disable', { method: 'POST', body: { code } }),
  chat: (message, history) => request('/chatbot', { method: 'POST', body: { message, history } }),
  quizDocuments: () => request('/quiz/documents'),
  uploadQuizDocument: (formData) =>
    request('/quiz/documents', { method: 'POST', body: formData, isForm: true }),
  deleteQuizDocument: (id) => request(`/quiz/documents/${id}`, { method: 'DELETE' }),
  generateQuiz: (payload) => request('/quiz/generate', { method: 'POST', body: payload }),
  adminUsers: () => request('/admin/users'),
  // from/to are ISO timestamps for the start and end of the viewed day in the
  // browser's own timezone, so the server doesn't have to guess the user's day.
  listEvents: (from, to) =>
    request(`/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  createEvent: (payload) => request('/schedule', { method: 'POST', body: payload }),
  updateEvent: (id, payload) => request(`/schedule/${id}`, { method: 'PATCH', body: payload }),
  deleteEvent: (id) => request(`/schedule/${id}`, { method: 'DELETE' }),
};
