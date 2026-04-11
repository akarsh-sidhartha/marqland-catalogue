import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(null);

  // ── On mount: restore session from localStorage ───────────────────────────
  useEffect(() => {
    console.log('[Auth] Checking localStorage for existing session...');
    try {
      const storedUser  = localStorage.getItem('marqland_user');
      const storedToken = localStorage.getItem('marqland_token');

      console.log('[Auth] Stored token found:', !!storedToken);
      console.log('[Auth] Stored user found:', !!storedUser);

      if (storedUser && storedToken) {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        tokenRef.current = storedToken;
        console.log('[Auth] Session restored for:', parsed.email, '| Role:', parsed.role);
      } else {
        console.log('[Auth] No existing session. Showing login page.');
      }
    } catch (err) {
      console.error('[Auth] Error reading localStorage:', err);
      localStorage.removeItem('marqland_user');
      localStorage.removeItem('marqland_token');
      localStorage.removeItem('marqland_refresh');
    } finally {
      setLoading(false);
      console.log('[Auth] Loading complete.');
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    console.log('[Auth] Logging out...');
    try {
      const token = tokenRef.current;
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // silent
    }
    tokenRef.current = null;
    localStorage.removeItem('marqland_token');
    localStorage.removeItem('marqland_refresh');
    localStorage.removeItem('marqland_user');
    setUser(null);
    console.log('[Auth] Logged out.');
  }, []);

  // ── authFetch ─────────────────────────────────────────────────────────────
  const authFetch = useCallback(async (url, options = {}) => {
    const token = tokenRef.current;
    console.log(`[authFetch] ${options.method || 'GET'} ${url} | Token: ${token ? token.slice(0, 20) + '...' : 'NONE'}`);

    const doRequest = (t) =>
      fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
      });

    let res = await doRequest(token);
    console.log(`[authFetch] Response status: ${res.status} for ${url}`);

    if (res.status === 401) {
      console.log('[authFetch] 401 received — attempting token refresh...');
      const refreshToken = localStorage.getItem('marqland_refresh');
      if (refreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const { accessToken } = await refreshRes.json();
            tokenRef.current = accessToken;
            localStorage.setItem('marqland_token', accessToken);
            console.log('[authFetch] Token refreshed. Retrying original request...');
            res = await doRequest(accessToken);
          } else {
            console.warn('[authFetch] Refresh failed. Logging out.');
            logout();
          }
        } catch (e) {
          console.error('[authFetch] Refresh error:', e);
          logout();
        }
      } else {
        console.warn('[authFetch] No refresh token. Logging out.');
        logout();
      }
    }

    return res;
  }, [logout]);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = async (email, password) => {
    console.log('[Auth] Attempting login for:', email);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    console.log('[Auth] Login response status:', res.status);

    // Clone response so we can log it AND return data
    const data = await res.json();
    console.log('[Auth] Login response data:', JSON.stringify(data, null, 2));

    if (!res.ok) {
      throw new Error(data.message || 'Login failed.');
    }

    if (!data.accessToken) {
      console.error('[Auth] ⚠️ Login succeeded but NO accessToken in response!');
      throw new Error('Server did not return an access token. Check backend logs.');
    }

    console.log('[Auth] ✅ Token received. Saving to localStorage...');
    tokenRef.current = data.accessToken;
    localStorage.setItem('marqland_token',   data.accessToken);
    localStorage.setItem('marqland_refresh', data.refreshToken);
    localStorage.setItem('marqland_user',    JSON.stringify(data.user));

    // Verify it was saved
    const saved = localStorage.getItem('marqland_token');
    console.log('[Auth] Token saved to localStorage:', !!saved);

    setUser(data.user);
    console.log('[Auth] ✅ Login complete. User set:', data.user.email, '| Role:', data.user.role);

    return data.user;
  };

  // ── Permissions ───────────────────────────────────────────────────────────
  const can = useCallback((roles = []) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  const canAccess = useCallback((section) => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const permissions = {
      products:       ['inventory', 'sales', 'accounts'],
      vendors:        ['accounts'],
      clients:        ['sales', 'accounts'],
      catalogues:     ['inventory', 'sales', 'accounts'],
      properties:     ['inventory', 'sales', 'accounts'],
      offsites:       ['inventory', 'sales', 'accounts'],
      orders:         ['sales', 'accounts'],
      challans:       ['inventory', 'sales', 'accounts'],
      sourcinghub:    ['sales', 'accounts'],
      paymenttracker: ['accounts'],
      letterhead:     ['sales', 'accounts'],
      userManagement: [],
    };

    return (permissions[section] || []).includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, authFetch, can, canAccess }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};