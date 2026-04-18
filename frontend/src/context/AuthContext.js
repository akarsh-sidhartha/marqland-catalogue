import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API = process.env.REACT_APP_API_URL || '';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // true while we validate stored token

  // ── On mount: restore session then fetch fresh user data from /api/auth/me ──
  // This ensures allowedRoutes changes made by admin are picked up on next login.
  useEffect(() => {
    const token = localStorage.getItem('marqland_token');
    if (!token) { setLoading(false); return; }

    // Optimistically restore from storage so UI shows instantly
    const stored = localStorage.getItem('marqland_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }

    // Then fetch fresh data from server to pick up any allowedRoutes changes
    fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.ok ? res.json() : null)
      .then(fresh => {
        if (fresh) {
          setUser(fresh);
          localStorage.setItem('marqland_user', JSON.stringify(fresh));
        }
      })
      .catch(() => { /* network error — keep using stored user */ })
      .finally(() => setLoading(false));
  }, []);

  // ── Attach token to every fetch call ─────────────────────────────────────
  const authFetch = useCallback(async (url, options = {}) => {
    let token = localStorage.getItem('marqland_token');

    const makeRequest = async (t) => {
      return fetch(`${API}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          Authorization: `Bearer ${t}`,
        },
      });
    };

    let res = await makeRequest(token);

    // If access token expired, try refresh
    if (res.status === 401) {
      const refreshToken = localStorage.getItem('marqland_refresh');
      if (refreshToken) {
        try {
          const refreshRes = await fetch(`${API}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const { accessToken } = await refreshRes.json();
            localStorage.setItem('marqland_token', accessToken);
            res = await makeRequest(accessToken); // Retry original request
          } else {
            // Refresh also failed — force logout
            logout();
          }
        } catch {
          logout();
        }
      } else {
        logout();
      }
    }

    return res;
  }, []); // eslint-disable-line

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');

    localStorage.setItem('marqland_token', data.accessToken);
    localStorage.setItem('marqland_refresh', data.refreshToken);
    localStorage.setItem('marqland_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try {
      const token = localStorage.getItem('marqland_token');
      if (token) {
        await fetch(`${API}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch { /* silent fail */ }

    localStorage.removeItem('marqland_token');
    localStorage.removeItem('marqland_refresh');
    localStorage.removeItem('marqland_user');
    setUser(null);
  }, []);

  // ── Permission helpers ────────────────────────────────────────────────────

  /**
   * Check if current user has one of the given roles
   * Usage: can(['admin', 'accounts'])
   */
  const can = useCallback((roles = []) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  /**
   * Role-based visibility map for sidebar navigation
   * Returns true if the user should see this section
   */
  const canAccess = useCallback((section) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const permissions = {
      products:        ['inventory', 'sales', 'accounts'],
      vendors:         ['accounts'],
      clients:         ['sales', 'accounts'],
      catalogues:      ['inventory', 'sales', 'accounts'],
      properties:      ['inventory', 'sales', 'accounts'],
      offsites:        ['inventory', 'sales', 'accounts'],
      orders:          ['sales', 'accounts'],
      challans:        ['inventory', 'sales', 'accounts'],
      sourcinghub:     ['sales', 'accounts'],
      paymenttracker:  ['accounts'],
      letterhead:      ['sales', 'accounts'],
      userManagement:  [], // admin only — handled by admin check above
    };

    return (permissions[section] || []).includes(user.role);
  }, [user]);

  // ── Manually refresh current user from server (call after admin saves routes) ──
  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('marqland_token');
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const fresh = await res.json();
        setUser(fresh);
        localStorage.setItem('marqland_user', JSON.stringify(fresh));
      }
    } catch { /* silent */ }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authFetch, can, canAccess, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};