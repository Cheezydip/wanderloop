import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import AccountSettingsModal from './AccountSettingsModal';
import {
  User,
  Cloud,
  PlusCircle,
  LogOut,
  ChevronDown,
  Heart,
  Settings,
} from 'lucide-react';

export default function UserProfileDropdown({ onOpenSavedTrips }) {
  const { user, logout } = useAuth();
  const { dispatch } = useTrip();
  const [isOpen, setIsOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState('profile');
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fetch count of user's saved trips in MongoDB Atlas
  useEffect(() => {
    if (isOpen && user) {
      fetch('/api/trips')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setSavedCount(data.length);
        })
        .catch(() => setSavedCount(null));
    }
  }, [isOpen, user]);

  if (!user) return null;

  const wishlistCount = (user.wishlist || []).length;

  const handleOpenAccountSettings = (tab = 'profile') => {
    setIsOpen(false);
    setSettingsInitialTab(tab);
    setSettingsModalOpen(true);
  };

  return (
    <>
      <div className="relative inline-block text-left" ref={dropdownRef}>
        {/* Profile Badge Trigger Button */}
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all active:scale-[0.98]"
          style={{
            background: isOpen
              ? 'var(--surface-3, rgba(255,255,255,0.08))'
              : 'var(--surface-2, rgba(255,255,255,0.03))',
            borderColor: isOpen ? 'var(--accent, #2dd4bf)' : 'var(--border, rgba(255,255,255,0.08))',
            color: 'var(--text, #f3f4f6)',
            boxShadow: isOpen ? '0 0 12px rgba(45, 212, 191, 0.15)' : 'none',
          }}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-extrabold text-[10px]">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="max-w-[110px] truncate">{user.name}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-stone-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-emerald-400' : ''
            }`}
          />
        </button>

        {/* Dropdown Menu Overlay */}
        {isOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-2xl p-2 shadow-2xl z-[100] no-scrollbar"
            style={{
              background: 'var(--surface, #14171d)',
              border: '1px solid var(--border, rgba(255,255,255,0.1))',
              color: 'var(--text, #f3f4f6)',
              boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border)',
              animation: 'fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* User Header Section */}
            <div className="p-3 rounded-xl mb-1.5" style={{ background: 'var(--surface-2, rgba(255,255,255,0.03))' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-stone-950 font-black text-sm shadow-md">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-extrabold text-sm truncate" style={{ color: 'var(--text)' }}>
                    {user.name}
                  </h4>
                  <p className="text-[11px] truncate opacity-70" style={{ color: 'var(--muted, #9ca3af)' }}>
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Cloud Sync Status Indicator */}
              <div className="mt-2.5 pt-2 border-t flex items-center justify-between text-[10px]" style={{ borderColor: 'var(--border, rgba(255,255,255,0.06))' }}>
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Cloud Synced
                </span>
                <span className="font-mono text-stone-400">
                  {savedCount !== null ? `${savedCount} Saved ${savedCount === 1 ? 'Trip' : 'Trips'}` : 'Cloud Connected'}
                </span>
              </div>
            </div>

            {/* Menu Actions */}
            <div className="space-y-0.5">
              {/* 1. My Saved Cloud Trips */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (onOpenSavedTrips) onOpenSavedTrips();
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left hover:bg-emerald-500/10 hover:text-emerald-400 group"
                style={{ color: 'var(--text)' }}
              >
                <div className="flex items-center gap-2.5">
                  <Cloud className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                  <span>My Saved Trips</span>
                </div>
                {savedCount !== null && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    {savedCount}
                  </span>
                )}
              </button>

              {/* 2. Destination Wishlist */}
              <button
                onClick={() => handleOpenAccountSettings('wishlist')}
                className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left hover:bg-rose-500/10 hover:text-rose-400 group"
                style={{ color: 'var(--text)' }}
              >
                <div className="flex items-center gap-2.5">
                  <Heart className="w-4 h-4 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span>Destination Wishlist</span>
                </div>
                {wishlistCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    {wishlistCount}
                  </span>
                )}
              </button>

              {/* 3. Change Username & Password */}
              <button
                onClick={() => handleOpenAccountSettings('profile')}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left hover:bg-white/5 group"
                style={{ color: 'var(--text)' }}
              >
                <Settings className="w-4 h-4 text-teal-400 group-hover:rotate-45 transition-transform" />
                <span>Change Username & Password</span>
              </button>

              {/* 4. Start New Trip */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  if (window.confirm('Are you sure you want to start a new trip?')) {
                    dispatch({ type: 'START_NEW_TRIP' });
                  }
                }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left hover:bg-white/5"
                style={{ color: 'var(--text)' }}
              >
                <PlusCircle className="w-4 h-4 text-accent" />
                <span>Start New Trip</span>
              </button>

              {/* Divider */}
              <div className="my-1 border-t" style={{ borderColor: 'var(--border, rgba(255,255,255,0.06))' }} />

              {/* 5. Log Out */}
              <button
                onClick={() => {
                  setIsOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all text-left text-rose-400 hover:bg-rose-500/15"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out ({user.name})</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Account Settings & Wishlist Modal */}
      <AccountSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        initialTab={settingsInitialTab}
      />
    </>
  );
}
