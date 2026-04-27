const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

let accessToken = null;
let refreshTimeoutId = null;

function scheduleRefresh() {
  if (refreshTimeoutId) {
    window.clearTimeout(refreshTimeoutId);
  }

  if (!accessToken) {
    refreshTimeoutId = null;
    return;
  }

  refreshTimeoutId = window.setTimeout(async () => {
    try {
      await refreshAccessToken();
    } catch (_error) {
      clearAccessToken();
    }
  }, REFRESH_INTERVAL_MS);
}

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token.length > 0 ? token : null;
  scheduleRefresh();
}

export function getAccessToken() {
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;

  if (refreshTimeoutId) {
    window.clearTimeout(refreshTimeoutId);
    refreshTimeoutId = null;
  }
}

async function parseResponse(response) {
  let payload = null;

  try {
    payload = await response.json();
  } catch (_error) {
    payload = null;
  }

  return payload;
}

async function request(path, options = {}, retryOnUnauthorized = true) {
  const headers = new Headers(options.headers || {});

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const payload = await parseResponse(response);

  if (response.status === 401 && retryOnUnauthorized) {
    try {
      await refreshAccessToken();
      return request(path, options, false);
    } catch (_error) {
      clearAccessToken();
    }
  }

  if (!response.ok) {
    const error = new Error(payload?.message || 'Request failed.');
    error.status = response.status;
    throw error;
  }

  return payload;
}

export async function refreshAccessToken() {
  const payload = await request(
    '/api/auth/refresh',
    {
      method: 'POST',
    },
    false
  );

  setAccessToken(payload.accessToken);
  return payload;
}

export async function register({ username, password, displayName }) {
  const payload = await request(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ username, password, displayName }),
    },
    false
  );

  setAccessToken(payload.accessToken);
  return payload;
}

export async function login({ username, password }) {
  const payload = await request(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    },
    false
  );

  setAccessToken(payload.accessToken);
  return payload;
}

export async function logout() {
  await request(
    '/api/auth/logout',
    {
      method: 'POST',
    },
    false
  );

  clearAccessToken();
}

export async function getMe() {
  return request('/api/auth/me', { method: 'GET' });
}

export async function apiFetch(path, options = {}) {
  return request(path, options);
}
