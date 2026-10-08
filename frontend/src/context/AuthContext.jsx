import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext();

async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (err) {
    if (!res.ok) {
      throw new Error(`Server connection error (${res.status}). Please check backend status.`);
    }
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Server request failed (${res.status})`);
  }

  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(null); // 'login' | 'signup' | null
  const [error, setError] = useState(null);

  // Check if user has an active session cookie on startup
  const checkAuthStatus = useCallback(async () => {
    try {
      const data = await safeFetchJson('/api/auth/me', {
        headers: { 'Content-Type': 'application/json' },
      });
      setUser(data);
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
      const data = await safeFetchJson('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
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
      const data = await safeFetchJson('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      setUser(data);
      setAuthModalOpen(null);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const loginWithGoogle = async (authPayload) => {
    setError(null);
    try {
      const body = typeof authPayload === 'string' ? { credential: authPayload } : authPayload;
      const data = await safeFetchJson('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setUser(data);
      setAuthModalOpen(null);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const updateProfile = async (name, email, currentPassword, newPassword, avatar) => {
    setError(null);
    try {
      const data = await safeFetchJson('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, currentPassword, newPassword, avatar }),
      });
      setUser(data);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      setUser(null);
      try {
        sessionStorage.removeItem('wanderloop_session_active');
      } catch (err) {}
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

  const updateWishlist = (newWishlist) => {
    setUser((prev) => (prev ? { ...prev, wishlist: newWishlist } : null));
  };

  const addToWishlist = async ({ name, country = '', notes = '', category = 'General' }) => {
    if (!user) {
      openAuthModal('login');
      throw new Error('Please log in to save items to your wishlist.');
    }
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || '') + '/api/auth/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, country, notes, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to add item to wishlist');
      }
      updateWishlist(data);
      return data;
    } catch (err) {
      console.error('[addToWishlist error]:', err);
      throw err;
    }
  };

  const removeFromWishlist = async (idOrName) => {
    if (!user) return;
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/auth/wishlist/${encodeURIComponent(idOrName)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to remove item from wishlist');
      }
      updateWishlist(data);
      return data;
    } catch (err) {
      console.error('[removeFromWishlist error]:', err);
      throw err;
    }
  };

  const isInWishlist = (name) => {
    if (!user || !user.wishlist || !name) return false;
    const searchName = name.toLowerCase().trim();
    return user.wishlist.some(
      (item) => item.name && item.name.toLowerCase().trim() === searchName
    );
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
        loginWithGoogle,
        logout,
        updateProfile,
        updateWishlist,
        addToWishlist,
        removeFromWishlist,
        isInWishlist,
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
