import React, { createContext, useContext, useState, useEffect } from 'react';
import { apiFetch } from '../utils/api.js';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [merchant, setMerchant] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('revivepay_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('revivepay_token');
      if (!storedToken) {
        await quickLogin('billing@saasifycloud.io');
        setIsLoading(false);
        return;
      }

      try {
        const res = await apiFetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (res.ok) {
          const profile = await res.json();
          setMerchant(profile);
          setToken(storedToken);
        } else {
          localStorage.removeItem('revivepay_token');
          setMerchant(null);
          setToken(null);
        }
      } catch {
        // Leave state on error
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Login failed' };
      }

      localStorage.setItem('revivepay_token', data.token);
      setToken(data.token);
      setMerchant(data.merchant);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const signup = async (name, email, password) => {
    try {
      const res = await apiFetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.message || 'Signup failed' };
      }

      localStorage.setItem('revivepay_token', data.token);
      setToken(data.token);
      setMerchant(data.merchant);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const quickLogin = async (email) => {
    return await login(email, 'password123');
  };

  const logout = () => {
    localStorage.removeItem('revivepay_token');
    setToken(null);
    setMerchant(null);
  };

  return (
    <AuthContext.Provider
      value={{
        merchant,
        token,
        isLoading,
        login,
        signup,
        quickLogin,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
