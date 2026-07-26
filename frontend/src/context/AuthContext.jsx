import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(null); // 'login' | 'signup' | null
  const [error, setError] = useState(null);

  // Check if user has an active session cookie on startup
  const checkAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.warn('[AuthContext]: Failed to check auth status:', err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const signup = async (name, email, password) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Signup failed');
      }
      setUser(data);
      setAuthModalOpen(null);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }
      setUser(data);
      setAuthModalOpen(null);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateProfile = async (name, email, currentPassword, newPassword) => {
    setError(null);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }
      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setUser(null);
    }
  };

  const openAuthModal = (type = 'login') => {
    setError(null);
    setAuthModalOpen(type);
  };

  const closeAuthModal = () => {
    setError(null);
    setAuthModalOpen(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authModalOpen,
        error,
        signup,
        login,
        logout,
        updateProfile,
        openAuthModal,
        closeAuthModal,
        checkAuthStatus,
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
