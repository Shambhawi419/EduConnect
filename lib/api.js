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
    const refreshed = await rawRequest('/auth/refresh', { method: 'POST' });
    if (refreshed.res.ok) {
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
  generateQuiz: (formData) =>
    request('/quiz/generate', { method: 'POST', body: formData, isForm: true }),
  adminUsers: () => request('/admin/users'),
  listEvents: (date) => request(`/schedule?date=${encodeURIComponent(date)}`),
  createEvent: (payload) => request('/schedule', { method: 'POST', body: payload }),
  deleteEvent: (id) => request(`/schedule/${id}`, { method: 'DELETE' }),
};
