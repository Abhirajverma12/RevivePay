import React, { createContext, useContext, useState, useEffect } from 'react';

export interface MerchantPolicy {
  id: string;
  merchant_id: string;
  max_retries: number;
  max_discount_pct: number;
  high_value_approval_threshold: number;
}

export interface Merchant {
  id: string;
  name: string;
  email: string;
  policy?: MerchantPolicy;
}

interface AuthContextType {
  merchant: Merchant | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  quickLogin: (email: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('revivepay_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Validate session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('revivepay_token');
      if (!storedToken) {
        // Automatically default-login to demo merchant for a seamless out-of-the-box experience
        await quickLogin('billing@saasifycloud.io');
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
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
        // If network error, leave state
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
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
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/signup', {
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
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error' };
    }
  };

  const quickLogin = async (email: string) => {
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
