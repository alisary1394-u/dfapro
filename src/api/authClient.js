/**
 * Auth client — thin wrapper around the server's /api/auth/* endpoints.
 * Drop-in replacement for base44.auth.*
 */
const req = async (url, options = {}) => {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = Object.assign(new Error(data.message || 'Request failed'), {
      status: res.status,
    });
    throw err;
  }
  return data;
};

export const authClient = {
  me: async () => {
    const data = await req('/api/auth/me');
    return data.user;
  },
  updateMe: async (payload) => {
    const data = await req('/api/auth/me', { method: 'PATCH', body: JSON.stringify(payload) });
    return data.user;
  },
  logout: async () => {
    await req('/api/auth/logout', { method: 'POST' });
  },
  redirectToLogin: () => {
    window.location.assign('/login');
  },
};
