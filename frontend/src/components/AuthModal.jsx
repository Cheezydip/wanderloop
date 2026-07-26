import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, X, ArrowRight, Loader2 } from 'lucide-react';

export default function AuthModal() {
  const { authModalOpen, closeAuthModal, login, signup, openAuthModal, error: authError } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState(null);

  if (!authModalOpen) return null;

  const isSignup = authModalOpen === 'signup';

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
