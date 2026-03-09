import { createOfflineClient } from './localStorageEngine';

const offlineClient = createOfflineClient();

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = Object.assign(new Error(data.message || 'Request failed'), {
      status: response.status,
      code: data.code,
      data
    });
    throw error;
  }
  return data;
};

export const base44 = {
  ...offlineClient,
  auth: {
    me: async () => {
      const data = await request('/api/auth/me');
      return data.user;
    },
    updateMe: async (payload) => {
      const data = await request('/api/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(payload)
      });
      return data.user;
    },
    logout: async () => {
      await request('/api/auth/logout', {
        method: 'POST'
      });
    },
    redirectToLogin: () => {
      window.location.assign('/login');
    }
  }
};
