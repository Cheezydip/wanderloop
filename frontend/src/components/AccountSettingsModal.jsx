import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { useTrip } from '../context/TripContext';
import {
  X,
  User,
  Mail,
  Lock,
  Heart,
  Plus,
  Trash2,
  CheckCircle,
  Loader2,
  Compass,
  ArrowRight,
} from 'lucide-react';

export const PRESET_AVATARS = [
  { id: 'adventurer-1', name: 'The Explorer', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Felix&backgroundColor=0d9488' },
  { id: 'adventurer-2', name: 'The Nomad', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Aneka&backgroundColor=0f766e' },
  { id: 'adventurer-3', name: 'The Backpacker', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Milo&backgroundColor=14b8a6' },
  { id: 'adventurer-4', name: 'The Voyager', url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Zion&backgroundColor=065f46' },
  { id: 'lorelei-1', name: 'The Wanderer', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Jasper&backgroundColor=0d9488' },
  { id: 'lorelei-2', name: 'The Hiker', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Sasha&backgroundColor=0f766e' },
  { id: 'lorelei-3', name: 'The Pilot', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Kai&backgroundColor=14b8a6' },
  { id: 'lorelei-4', name: 'The Captain', url: 'https://api.dicebear.com/7.x/lorelei/svg?seed=Nala&backgroundColor=065f46' },
  { id: 'big-smile-1', name: 'Sunny Traveler', url: 'https://api.dicebear.com/7.x/big-smile/svg?seed=Leo&backgroundColor=0d9488' },
  { id: 'big-smile-2', name: 'Beach Lover', url: 'https://api.dicebear.com/7.x/big-smile/svg?seed=Maya&backgroundColor=0f766e' },
  { id: 'bottts-1', name: 'Tech Nomad', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=WanderBot&backgroundColor=0d9488' },
  { id: 'bottts-2', name: 'AI Co-Pilot', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=LoopBot&backgroundColor=14b8a6' },
];

export default function AccountSettingsModal({ isOpen, onClose, initialTab = 'profile' }) {
  const { user, updateProfile, addToWishlist, removeFromWishlist } = useAuth();
  const { dispatch } = useTrip();

  const [activeTab, setActiveTab] = useState(initialTab); // 'profile' | 'wishlist'

  // Profile Form States
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(null);
  const [profileError, setProfileError] = useState(null);

  // Wishlist States
  const [wishlist, setWishlist] = useState(user?.wishlist || []);
  const [destName, setDestName] = useState('');
  const [destCountry, setDestCountry] = useState('');
  const [destNotes, setDestNotes] = useState('');
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [wishlistError, setWishlistError] = useState(null);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setSelectedAvatar(user.avatar || '');
      setWishlist(user.wishlist || []);
    }
  }, [user]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen || !user) return null;

  // Handle Profile Update
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!name.trim()) {
      setProfileError('Username cannot be empty');
      return;
    }

    if (!email.trim()) {
      setProfileError('Email address cannot be empty');
      return;
    }

    if (newPassword && !currentPassword) {
      setProfileError('Please enter your current password to set a new password');
      return;
    }

    setProfileSubmitting(true);
    try {
      await updateProfile(name, email, currentPassword, newPassword, selectedAvatar);
      setProfileSuccess('Profile updated successfully!');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Add Item to Wishlist
  const handleAddWishlist = async (e) => {
    e.preventDefault();
    if (!destName.trim()) return;

    setWishlistLoading(true);
    setWishlistError(null);
    try {
      const updated = await addToWishlist({
        name: destName,
        country: destCountry,
        notes: destNotes,
      });
      setWishlist(updated);
      setDestName('');
      setDestCountry('');
      setDestNotes('');
    } catch (err) {
      setWishlistError(err.message);
    } finally {
      setWishlistLoading(false);
    }
  };

  // Remove Item from Wishlist
  const handleRemoveWishlist = async (id) => {
    try {
      const updated = await removeFromWishlist(id);
      setWishlist(updated);
    } catch (err) {
      alert(err.message);
    }
  };

  // Plan trip from wishlist item
  const handlePlanWishlistTrip = (item) => {
    onClose();
    dispatch({
      type: 'START_QUESTIONNAIRE',
      payload: `Trip to ${item.name}${item.country ? ', ' + item.country : ''}. ${item.notes ? item.notes : ''}`,
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md sm:max-w-lg rounded-2xl p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh] my-auto"
        style={{
          background: 'var(--surface, #14171d)',
          border: '1px solid var(--border, rgba(255,255,255,0.1))',
          color: 'var(--text, #f3f4f6)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          style={{
            background: 'var(--surface-2, rgba(255,255,255,0.05))',
            color: 'var(--muted, #9ca3af)',
            border: 'none',
          }}
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mb-6 p-1 rounded-xl w-fit" style={{ background: 'var(--surface-2, rgba(255,255,255,0.04))', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={{
              background: activeTab === 'profile' ? 'var(--accent, #2dd4bf)' : 'transparent',
              color: activeTab === 'profile' ? 'var(--bg, #090a0f)' : 'var(--muted, #9ca3af)',
            }}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & Password</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('wishlist')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer"
            style={{
              background: activeTab === 'wishlist' ? 'var(--accent, #2dd4bf)' : 'transparent',
              color: activeTab === 'wishlist' ? 'var(--bg, #090a0f)' : 'var(--muted, #9ca3af)',
            }}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Wishlist ({wishlist.length})</span>
          </button>
        </div>

        {/* TAB 1: Profile & Password */}
        {activeTab === 'profile' && (
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4">
            {/* User Avatar Card Header */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl mb-1" style={{ background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
              {selectedAvatar || user.avatar ? (
                <img src={selectedAvatar || user.avatar} alt={user.name} className="w-12 h-12 rounded-full object-cover border-2 border-emerald-400/50 shadow-md transition-transform" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-stone-950 font-black text-base shadow-md">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-extrabold text-sm truncate" style={{ color: 'var(--text)' }}>{user.name}</h3>
                <p className="text-xs truncate opacity-75" style={{ color: 'var(--muted)' }}>{user.email}</p>
              </div>
            </div>

            <h2 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
              Account Settings
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Update your account username, select a custom avatar persona, or change your password.
            </p>

            {profileSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            {profileError && (
              <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold">
                {profileError}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {/* Avatar Persona Selector */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                  Choose Avatar Persona
                </label>
                <div className="grid grid-cols-6 gap-2 p-2 rounded-2xl" style={{ background: 'var(--surface-2, rgba(255,255,255,0.02))', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
                  {PRESET_AVATARS.map((item) => {
                    const isSelected = selectedAvatar === item.url;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedAvatar(item.url)}
                        className={`relative p-1 rounded-xl transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center ${
                          isSelected ? 'ring-2 ring-emerald-400 bg-emerald-500/20' : 'hover:bg-white/5'
                        }`}
                        title={item.name}
                      >
                        <img src={item.url} alt={item.name} className="w-9 h-9 rounded-full object-cover" />
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 text-stone-950 flex items-center justify-center text-[10px] font-extrabold shadow">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none"
                    style={{
                      background: 'var(--surface-2, rgba(255,255,255,0.04))',
                      borderColor: 'var(--border, rgba(255,255,255,0.08))',
                      color: 'var(--text)',
                    }}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--muted)' }}>
                  Username / Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none"
                    style={{
                      background: 'var(--surface-2, rgba(255,255,255,0.04))',
                      borderColor: 'var(--border, rgba(255,255,255,0.08))',
                      color: 'var(--text)',
                    }}
                    required
                  />
                </div>
              </div>

              <div className="pt-2 border-t" style={{ borderColor: 'var(--border, rgba(255,255,255,0.06))' }}>
                <h3 className="text-xs font-bold mb-3 uppercase tracking-wider" style={{ color: 'var(--accent, #2dd4bf)' }}>
                  Change Password (Optional)
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none"
                        style={{
                          background: 'var(--surface-2, rgba(255,255,255,0.04))',
                          borderColor: 'var(--border, rgba(255,255,255,0.08))',
                          color: 'var(--text)',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: 'var(--muted)' }}>
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-3" style={{ color: 'var(--muted)' }} />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs outline-none"
                        style={{
                          background: 'var(--surface-2, rgba(255,255,255,0.04))',
                          borderColor: 'var(--border, rgba(255,255,255,0.08))',
                          color: 'var(--text)',
                        }}
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={profileSubmitting}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: 'var(--accent, #2dd4bf)',
                  color: 'var(--bg, #090a0f)',
                  border: 'none',
                }}
              >
                {profileSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <span>Save Profile Changes</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: Destination Wishlist */}
        {activeTab === 'wishlist' && (
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar space-y-4 flex flex-col">
            <h2 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
              Destination Wishlist
            </h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Save bucket-list places you want to visit and plan trips for them with 1 click.
            </p>

            {/* Add Destination Form */}
            <form onSubmit={handleAddWishlist} className="p-3.5 rounded-xl space-y-2.5" style={{ background: 'var(--surface-2, rgba(255,255,255,0.03))', border: '1px solid var(--border, rgba(255,255,255,0.06))' }}>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Destination Name (e.g. Kyoto, Bali, Swiss Alps)"
                  value={destName}
                  onChange={(e) => setDestName(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border text-xs outline-none"
                  style={{
                    background: 'var(--surface, #14171d)',
                    borderColor: 'var(--border, rgba(255,255,255,0.08))',
                    color: 'var(--text)',
                  }}
                  required
                />
                <input
                  type="text"
                  placeholder="Country (e.g. Japan)"
                  value={destCountry}
                  onChange={(e) => setDestCountry(e.target.value)}
                  className="w-32 px-3 py-2 rounded-lg border text-xs outline-none"
                  style={{
                    background: 'var(--surface, #14171d)',
                    borderColor: 'var(--border, rgba(255,255,255,0.08))',
                    color: 'var(--text)',
                  }}
                />
              </div>
              <input
                type="text"
                placeholder="Notes (e.g. Must visit cherry blossoms in April)"
                value={destNotes}
                onChange={(e) => setDestNotes(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-xs outline-none"
                style={{
                  background: 'var(--surface, #14171d)',
                  borderColor: 'var(--border, rgba(255,255,255,0.08))',
                  color: 'var(--text)',
                }}
              />
              <button
                type="submit"
                disabled={wishlistLoading || !destName.trim()}
                className="flex items-center justify-center gap-1.5 w-full py-2.5 px-3 rounded-xl text-xs font-bold cursor-pointer transition-all active:scale-[0.99] disabled:opacity-50"
                style={{
                  background: 'var(--accent, #2dd4bf)',
                  color: 'var(--bg, #090a0f)',
                  border: 'none',
                }}
              >
                {wishlistLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add to Wishlist</span>
                  </>
                )}
              </button>
            </form>

            {/* Wishlist Items List */}
            <div className="flex-1 space-y-2 mt-2">
              {wishlist.length === 0 ? (
                <div className="py-8 text-center space-y-1 text-xs" style={{ color: 'var(--muted)' }}>
                  <Heart className="w-8 h-8 mx-auto text-rose-500/40 mb-2" />
                  <p className="font-semibold">Your Wishlist is Empty</p>
                  <p className="text-[11px]">Add destinations above to build your travel bucket list!</p>
                </div>
              ) : (
                wishlist.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border flex items-center justify-between transition-all"
                    style={{
                      background: 'var(--surface-2, rgba(255,255,255,0.03))',
                      borderColor: 'var(--border, rgba(255,255,255,0.06))',
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-xs" style={{ color: 'var(--text)' }}>
                          {item.name}
                        </h4>
                        {item.country && (
                          <span
                            className="px-2 py-0.5 rounded-md text-[10px] border"
                            style={{
                              background: 'var(--surface-3, rgba(255,255,255,0.06))',
                              borderColor: 'var(--border, rgba(255,255,255,0.1))',
                              color: 'var(--muted)',
                            }}
                          >
                            {item.country}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>
                          {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePlanWishlistTrip(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer hover:opacity-80"
                        style={{
                          background: 'var(--surface-3, rgba(255,255,255,0.08))',
                          color: 'var(--accent, #2dd4bf)',
                          border: '1px solid var(--border, rgba(255,255,255,0.1))',
                        }}
                        title="Plan a trip to this destination"
                      >
                        <Compass className="w-3.5 h-3.5" />
                        <span>Plan Trip</span>
                      </button>
                      <button
                        onClick={() => handleRemoveWishlist(item.id || item._id || item.name)}
                        className="p-1.5 rounded-lg transition-colors cursor-pointer hover:text-rose-400 hover:bg-rose-500/10"
                        style={{ color: 'var(--muted)' }}
                        title="Remove from wishlist"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
