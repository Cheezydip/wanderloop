import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTrip } from '../context/TripContext';
import { useAuth } from '../context/AuthContext';
import { getCurrencySymbol } from '../utils/currency';
import { X, Calendar, MapPin, Trash2, ArrowUpRight, Loader2, Cloud, RefreshCw, LogIn } from 'lucide-react';

export default function SavedTripsModal({ isOpen, onClose }) {
  const { state, dispatch } = useTrip();
  const { user, openAuthModal } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchSavedTrips = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trips', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch saved trips from database');
      }
      const data = await res.json();
      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Fetch trips error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      fetchSavedTrips();
    }
  }, [isOpen, user, fetchSavedTrips]);

  if (!isOpen) return null;

  // Unauthenticated user fallback popup instead of blank page
  if (!user) {
    return createPortal(
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="w-full max-w-sm p-6 rounded-3xl border shadow-2xl text-center space-y-4 relative overflow-hidden"
          style={{
            background: 'var(--surface, #14171d)',
            borderColor: 'var(--border, rgba(255,255,255,0.08))',
            color: 'var(--text, #f3f4f6)',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
              Log In to View Trips
            </h3>
            <p className="text-xs text-stone-400 mt-1 leading-relaxed">
              Log in to your account to view, restore, and sync your saved itineraries across all your devices.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold border border-white/10 text-stone-300 hover:bg-white/5 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
                if (openAuthModal) openAuthModal('login');
              }}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-500 text-stone-950 hover:bg-emerald-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Log In Now</span>
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  const handleLoadTrip = (savedTrip) => {
    if (!savedTrip) return;
    dispatch({
      type: 'RESTORE_TRIP',
      payload: {
        trip: {
          id: savedTrip.tripId,
          title: savedTrip.title || 'Saved Itinerary',
          budget: savedTrip.budget || 25000,
          currency: savedTrip.currency || 'JPY',
          days: savedTrip.days || [],
          messages: savedTrip.messages || [],
        },
        hasTrip: true,
        selectedHomestaysByDay: savedTrip.selectedHomestaysByDay || {},
        selectedHomestayId: savedTrip.selectedHomestayId || null,
        budgetItems: savedTrip.budgetItems || [],
      },
    });
    onClose();
  };

  const executeDeleteTrip = async (tripIdToDelete) => {
    setDeletingId(tripIdToDelete);
    setConfirmDeleteId(null);
    try {
      const res = await fetch(`/api/trips/${tripIdToDelete}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete trip');
      }
      setTrips((prev) => prev.filter((t) => t.tripId !== tripIdToDelete && t._id !== tripIdToDelete));
    } catch (err) {
      setError(err.message || 'Could not delete trip');
    } finally {
      setDeletingId(null);
    }
  };

  const userName = user?.name || user?.username || user?.email?.split('@')[0] || 'User';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-xl rounded-3xl p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[85vh]"
        style={{
          background: 'var(--surface, #14171d)',
          border: '1px solid var(--border, rgba(255,255,255,0.08))',
          color: 'var(--text, #f3f4f6)',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10"
          style={{
            background: 'var(--surface-2, rgba(255,255,255,0.05))',
            color: 'var(--muted, #9ca3af)',
            border: 'none',
          }}
          aria-label="Close saved trips modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <Cloud className="w-5 h-5 text-emerald-400" />
          <h2 className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--text)' }}>
            My Saved Trips
          </h2>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--muted, #9ca3af)' }}>
          All itineraries saved to your cloud account for <strong>{userName}</strong>
        </p>

        {/* Trips List Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 no-scrollbar my-2">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--muted)' }}>
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              <span className="text-xs">Loading saved trips...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs text-center space-y-2">
              <p>{error}</p>
              <button
                onClick={fetchSavedTrips}
                className="px-3 py-1 rounded-lg bg-rose-500/20 text-rose-300 font-semibold cursor-pointer hover:bg-rose-500/30"
              >
                Try Again
              </button>
            </div>
          ) : trips.length === 0 ? (
            <div
              className="p-8 rounded-2xl border text-center space-y-2"
              style={{ background: 'var(--surface-2, rgba(255,255,255,0.02))', borderColor: 'var(--border, rgba(255,255,255,0.06))' }}
            >
              <div className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Cloud className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>No Trips Saved Yet</h3>
              <p className="text-xs max-w-sm mx-auto leading-relaxed" style={{ color: 'var(--muted)' }}>
                Click the <strong>Save</strong> button in the top bar anytime to save your current itinerary to your account!
              </p>
            </div>
          ) : (
            trips.map((savedTrip) => {
              if (!savedTrip) return null;
              const daysCount = (savedTrip.days || []).length;
              let stopsCount = 0;
              (savedTrip.days || []).forEach((d) => {
                if (d && d.stops) {
                  stopsCount += (d.stops || []).length;
                }
              });
              const isCurrent = state.trip?.id === savedTrip.tripId;
              const currencySymbol = getCurrencySymbol(savedTrip);

              return (
                <div
                  key={savedTrip._id || savedTrip.tripId}
                  onClick={() => handleLoadTrip(savedTrip)}
                  className="p-4 rounded-2xl border flex items-center justify-between transition-all cursor-pointer group hover:border-emerald-500/40"
                  style={{
                    background: isCurrent ? 'rgba(16, 185, 129, 0.08)' : 'var(--surface-2, rgba(255,255,255,0.03))',
                    borderColor: isCurrent ? 'rgba(16, 185, 129, 0.3)' : 'var(--border, rgba(255,255,255,0.06))',
                  }}
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm truncate" style={{ color: 'var(--text)' }}>
                        {savedTrip.title || 'Untitled Trip'}
                      </h3>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                          Active Trip
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px] font-mono" style={{ color: 'var(--muted)' }}>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {daysCount} {daysCount === 1 ? 'Day' : 'Days'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {stopsCount} {stopsCount === 1 ? 'Stop' : 'Stops'}
                      </span>
                      <span>•</span>
                      <span>Budget: {currencySymbol}{(savedTrip.budget || 25000).toLocaleString()}</span>
                    </div>

                    <div className="text-[10px] mt-1.5 font-mono opacity-70" style={{ color: 'var(--muted)' }}>
                      Updated {new Date(savedTrip.updatedAt || savedTrip.createdAt || Date.now()).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {confirmDeleteId === (savedTrip.tripId || savedTrip._id) ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            executeDeleteTrip(savedTrip.tripId || savedTrip._id);
                          }}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-rose-500 text-white cursor-pointer hover:bg-rose-600"
                        >
                          Delete?
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-2 py-1 rounded-lg text-[10px] font-medium text-stone-400 hover:text-white cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLoadTrip(savedTrip);
                          }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-stone-950"
                        >
                          <span>Load</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(savedTrip.tripId || savedTrip._id);
                          }}
                          disabled={deletingId === (savedTrip.tripId || savedTrip._id)}
                          className="p-2 rounded-xl text-stone-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                          title="Delete trip"
                        >
                          {deletingId === (savedTrip.tripId || savedTrip._id) ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--border, rgba(255,255,255,0.06))' }}>
          <button
            onClick={fetchSavedTrips}
            className="flex items-center gap-1 text-xs font-semibold text-stone-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh list</span>
          </button>
          <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
            Cloud Synced ✓
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
