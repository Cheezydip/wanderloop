import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, X, ArrowRight, Loader2 } from 'lucide-react';

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, login, signup, loginWithGoogle, openAuthModal, error: authError } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  const isSignup = authModalOpen === 'signup';

  const handleGoogleSignIn = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleSubmitting(true);
      setLocalError(null);
      try {
        await loginWithGoogle({ accessToken: tokenResponse.access_token });
      } catch (err) {
        setLocalError(err.message || 'Google login failed.');
      } finally {
        setGoogleSubmitting(false);
      }
    },
    onError: () => {
      setLocalError('Google Sign-In was cancelled or failed.');
    },
  });

  const onGoogleButtonClick = () => {
    setLocalError(null);
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'placeholder_google_client_id') {
      setLocalError(
        'Google Client ID is not configured yet. Please add VITE_GOOGLE_CLIENT_ID to your .env file to enable Google Auth.'
      );
      return;
    }
    handleGoogleSignIn();
  };

  if (!authModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !password || (isSignup && !name)) {
      setLocalError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      if (isSignup) {
        await signup(name, email, password);
      } else {
        await login(email, password);
      }
      // Reset fields on success
      setName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setLocalError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const currentError = localError || authError;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAuthModal();
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        style={{
          background: 'var(--surface, #14171d)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          color: 'var(--text, #f3f4f6)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={closeAuthModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          style={{
            background: 'var(--surface-2, rgba(255,255,255,0.05))',
            color: 'var(--muted, #9ca3af)',
            border: 'none',
          }}
          aria-label="Close authentication modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Tabs */}
        <div className="flex items-center justify-center gap-2 mb-6 p-1 rounded-xl" style={{ background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center"
            style={{
              background: !isSignup ? 'var(--accent, #2dd4bf)' : 'transparent',
              color: !isSignup ? 'var(--bg, #090a0f)' : 'var(--muted, #9ca3af)',
            }}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => openAuthModal('signup')}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center"
            style={{
              background: isSignup ? 'var(--accent, #2dd4bf)' : 'transparent',
              color: isSignup ? 'var(--bg, #090a0f)' : 'var(--muted, #9ca3af)',
            }}
          >
            Sign Up
          </button>
        </div>

        {/* Modal Title */}
        <h2 className="text-xl font-extrabold tracking-tight mb-1 text-center" style={{ color: 'var(--text)' }}>
          {isSignup ? 'Create Your Account' : 'Welcome Back to Wanderloop'}
        </h2>
        <p className="text-xs text-center mb-5" style={{ color: 'var(--muted, #9ca3af)' }}>
          {isSignup
            ? 'Sign up to save itineraries to your cloud account and access trips anywhere.'
            : 'Log in to access your saved trips and cloud itineraries.'}
        </p>

        {/* Error Alert */}
        {currentError && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
            {currentError}
          </div>
        )}

        {/* Google Sign-In Button */}
        <div className="mb-4">
          <button
            type="button"
            onClick={onGoogleButtonClick}
            disabled={googleSubmitting || submitting}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl text-xs font-bold transition-all cursor-pointer hover:bg-white/10 active:scale-[0.99] disabled:opacity-50"
            style={{
              background: 'var(--surface-2, rgba(255,255,255,0.04))',
              border: '1px solid var(--border, rgba(255,255,255,0.1))',
              color: 'var(--text, #f3f4f6)',
            }}
          >
            {googleSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>{isSignup ? 'Sign up with Google' : 'Continue with Google'}</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="w-full border-t" style={{ borderColor: 'var(--border, rgba(255,255,255,0.08))' }} />
          <span className="absolute px-3 text-[10px] font-semibold uppercase tracking-wider" style={{ background: 'var(--surface, #14171d)', color: 'var(--muted, #9ca3af)' }}>
            or continue with email
          </span>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignup && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
                <input
                  type="text"
                  placeholder="e.g. Rupayan Saha"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none transition-colors"
                  style={{
                    background: 'var(--surface-2, rgba(255,255,255,0.03))',
                    borderColor: 'var(--border, rgba(255,255,255,0.08))',
                    color: 'var(--text)',
                  }}
                  required={isSignup}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none transition-colors"
                style={{
                  background: 'var(--surface-2, rgba(255,255,255,0.03))',
                  borderColor: 'var(--border, rgba(255,255,255,0.08))',
                  color: 'var(--text)',
                }}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--muted)' }}>
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none transition-colors"
                style={{
                  background: 'var(--surface-2, rgba(255,255,255,0.03))',
                  borderColor: 'var(--border, rgba(255,255,255,0.08))',
                  color: 'var(--text)',
                }}
                required
                minLength={6}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
            style={{
              background: 'var(--accent, #2dd4bf)',
              color: 'var(--bg, #090a0f)',
              border: 'none',
              boxShadow: '0 4px 14px rgba(45, 212, 191, 0.25)',
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{isSignup ? 'Creating Account...' : 'Logging in...'}</span>
              </>
            ) : (
              <>
                <span>{isSignup ? 'Create Free Account' : 'Log In to Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Footer switch prompt */}
        <div className="mt-5 pt-4 border-t text-center text-xs" style={{ borderColor: 'var(--border, rgba(255,255,255,0.06))', color: 'var(--muted)' }}>
          {isSignup ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="font-bold cursor-pointer hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Log In
              </button>
            </span>
          ) : (
            <span>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="font-bold cursor-pointer hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                Sign Up
              </button>
            </span>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
