/**
 * frontend/src/api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Authenticated axios instance.
 * Uses getBaseUrl() so it works in both:
 *   - Local dev:   http://localhost:5000/api
 *   - Production:  https://internalportal.marqland.com/api
 *
 * USAGE in any page component:
 *   import api from '../api';
 *   api.get('/products')        ← no need to add /api, baseURL handles it
 *   api.post('/vendors', data)
 *   api.put('/clients/123', data)
 *   api.delete('/products/456')
 * ─────────────────────────────────────────────────────────────────────────────
 */

import axios from 'axios';
import { getBaseUrl } from './baseurl'; // Your existing baseurl.js

const api = axios.create({
  baseURL: getBaseUrl(), // e.g. "http://localhost:5000/api" or "https://internalportal.marqland.com/api"
  timeout: 30000,
});

// ── REQUEST INTERCEPTOR: attach JWT token to every request ────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('marqland_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── RESPONSE INTERCEPTOR: handle expired tokens ───────────────────────────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem('marqland_refresh');

      if (!refreshToken) {
        forceLogout();
        return Promise.reject(error);
      }

      try {
        // Use plain axios (not the intercepted instance) to avoid infinite loop
        const { data } = await axios.post(
          `${getBaseUrl()}/auth/refresh`,
          { refreshToken }
        );

        const newToken = data.accessToken;
        localStorage.setItem('marqland_token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
        originalRequest.headers['Authorization']     = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return api(originalRequest);

      } catch (refreshError) {
        processQueue(refreshError, null);
        forceLogout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

const forceLogout = () => {
  localStorage.removeItem('marqland_token');
  localStorage.removeItem('marqland_refresh');
  localStorage.removeItem('marqland_user');
  window.location.href = '/';
};

export default api;