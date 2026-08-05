const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function getCsrfCookie() {
  const match = document.cookie.match(/(?:^|; )ec_csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function rawRequest(path, { method = 'GET', body, isForm } = {}) {
  const headers = {};
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = getCsrfCookie();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: 'include',
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

// The access-token cookie is short-lived. On a 401 (other than from the refresh call
// itself or the login/register flow), silently try to refresh the session once and
// replay the original request before surfacing an error to the caller.
async function request(path, options = {}) {
  const { res, data } = await rawRequest(path, options);
  if (res.ok) return data;

  const isAuthFlow = path === '/auth/refresh' || path === '/auth/login' || path === '/auth/register';
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
  primeCsrf: () => request('/csrf'),
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
  generateQuiz: (formData) => request('/quiz/generate', { method: 'POST', body: formData, isForm: true }),
  adminUsers: () => request('/admin/users'),
  listEvents: (date) => request(`/schedule?date=${encodeURIComponent(date)}`),
  createEvent: (payload) => request('/schedule', { method: 'POST', body: payload }),
  deleteEvent: (id) => request(`/schedule/${id}`, { method: 'DELETE' }),
};
