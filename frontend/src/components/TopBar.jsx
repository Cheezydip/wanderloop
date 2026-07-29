import { useState, useCallback, useRef, useEffect } from 'react';
import { useTrip } from '../context/TripContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getCurrencySymbol } from '../utils/currency';
import ExportModal from './ExportModal';
import SavedTripsModal from './SavedTripsModal';
import UserProfileDropdown from './UserProfileDropdown';
import ThemeSlider from './ThemeSlider';
import NewTripConfirmModal from './NewTripConfirmModal';
import { AlertTriangle, Cloud, User, LogOut, LogIn, UserPlus } from 'lucide-react';

export default function TopBar() {
  const { state, dispatch } = useTrip();
  const { theme, setTheme } = useTheme();
  const { user, logout, openAuthModal } = useAuth();
  const [showBudgetDropdown, setShowBudgetDropdown] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState(state.trip?.budget || 25000);
  const [saveText, setSaveText] = useState('Save');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isSavedTripsOpen, setIsSavedTripsOpen] = useState(false);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const budgetRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (budgetRef.current && !budgetRef.current.contains(event.target)) {
        setShowBudgetDropdown(false);
      }
    }
    if (showBudgetDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showBudgetDropdown]);

  const numDays = state.trip?.days?.length || 0;

  const currencySymbol = getCurrencySymbol(state.trip);

  // Calculate expenses dynamically from global budgetItems state
  const totalSpend = (state.budgetItems || []).reduce((sum, item) => sum + item.amount, 0);
  const budgetLimit = state.trip?.budget || 25000;
  const percentage = Math.min((totalSpend / budgetLimit) * 100, 100);

  // Budget status color thresholds (matches wanderloopmap.html exactly: >90% is danger, >70% is warm, else teal)
  let budgetColorClass = 'bg-accent';
  let budgetTextColorClass = 'text-accent';
  if (percentage > 90) {
    budgetColorClass = 'bg-rose-500';
    budgetTextColorClass = 'text-rose-500 font-bold';
  } else if (percentage > 70) {
    budgetColorClass = 'bg-amber-500';
    budgetTextColorClass = 'text-amber-500';
  }

  const handleSaveBudget = () => {
    dispatch({ type: 'SET_BUDGET', payload: tempBudget });
    setIsEditingBudget(false);
  };

  const handleSave = useCallback(async () => {
    setSaveText('Saved ✓');
    setIsExportModalOpen(true);

    if (user && state.trip) {
      try {
        await fetch('/api/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tripId: state.trip.id,
            title: state.trip.title,
            budget: state.trip.budget,
            currency: state.trip.currency || 'JPY',
            days: state.trip.days,
            budgetItems: state.budgetItems,
            selectedHomestaysByDay: state.selectedHomestaysByDay,
            selectedHomestayId: state.selectedHomestayId,
          }),
        });
      } catch (err) {
        console.error('Failed to sync trip to MongoDB Atlas:', err);
      }
    }

    setTimeout(() => setSaveText('Save'), 2500);
  }, [user, state.trip, state.budgetItems, state.selectedHomestaysByDay, state.selectedHomestayId]);

  const perDay = numDays > 0 ? Math.round(totalSpend / numDays) : 0;

  return (
    <header
      className="h-14 flex items-center justify-between px-5 shrink-0 z-50 relative overflow-visible"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))',
        transition: 'background 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* ─── Left: Brand + Trip Tag ─── */}
      <div className="flex items-center gap-4">
        {/* Brand Logo */}
        <a
          href="#"
          className="flex items-center gap-[7px] no-underline"
          onClick={(e) => {
            e.preventDefault();
            if (state.hasTrip) setIsNewTripModalOpen(true);
          }}
          style={{ textDecoration: 'none' }}
        >
          {/* Globe SVG from reference */}
          <svg viewBox="0 0 32 32" width="20" height="20" fill="none" style={{ color: 'var(--accent)' }}>
            <circle cx="16" cy="16" r="14" stroke="currentColor" strokeWidth="2" />
            <ellipse cx="16" cy="16" rx="6" ry="14" stroke="currentColor" strokeWidth="1.5" />
            <path d="M2 16h28" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="16" cy="16" r="2.5" fill="currentColor" />
          </svg>
          <span
            className="text-base font-extrabold tracking-[-0.04em]"
            style={{ color: 'var(--text)' }}
          >
            wander<span style={{ color: 'var(--accent)' }}>loop</span>
          </span>
        </a>

        {/* Divider */}
        {state.hasTrip && numDays > 0 && (
          <>
            <div
              className="hidden md:block"
              style={{
                width: '1px',
                height: '20px',
                background: 'var(--border, rgba(255,255,255,0.1))',
              }}
            />

            {/* Trip Tag Pill */}
            <div
              className="hidden md:flex items-center gap-[5px] px-[10px] py-[3px] rounded-full text-xs font-semibold"
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid var(--accent-border, rgba(45,212,191,0.15))',
                color: 'var(--accent)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M2 8l4 4 8-8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {state.trip?.title} · {numDays} days
            </div>
          </>
        )}
      </div>

      {/* ─── Right: Budget + Save + Theme Switcher ─── */}
      <div className="flex items-center gap-[10px]">
        {state.hasTrip && (
          <>
            {/* Budget Display */}
            <div className="relative" ref={budgetRef}>
              <button
                onClick={() => {
                  setShowBudgetDropdown(!showBudgetDropdown);
                  setTempBudget(budgetLimit);
                  setIsEditingBudget(false);
                }}
                className={`hidden md:flex items-center gap-[6px] px-3 py-[5px] rounded-lg text-xs cursor-pointer ${
                  totalSpend > budgetLimit ? 'bg-rose-500/15 border-rose-500/40 text-rose-400 font-bold' : ''
                }`}
                style={{
                  background: totalSpend > budgetLimit ? undefined : 'var(--surface-2, rgba(255,255,255,0.03))',
                  border: totalSpend > budgetLimit ? undefined : '1px solid var(--border, rgba(255,255,255,0.06))',
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  color: totalSpend > budgetLimit ? '#f87171' : 'var(--muted)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                {totalSpend > budgetLimit ? (
                  <span className="flex items-center gap-1 text-rose-400 font-bold">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 inline" />
                    <span>Exceeded by {currencySymbol}{(totalSpend - budgetLimit).toLocaleString()}</span>
                  </span>
                ) : (
                  <>
                    <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                      <path
                        d="M8 1v14M5 4h4a2 2 0 010 4H5M5 8h5a2 2 0 010 4H5"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="hidden lg:inline">Budget</span>
                    <span className="font-semibold" style={{ color: 'var(--accent)' }}>
                      {currencySymbol}{perDay.toLocaleString()}/day
                    </span>
                  </>
                )}
              </button>

              {/* Budget Breakdown Dropdown */}
              {showBudgetDropdown && (
                <div
                  className="absolute right-0 mt-2 w-72 p-4 rounded-2xl shadow-2xl z-50 scale-in text-xs"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border, rgba(255,255,255,0.1))',
                  }}
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-sm" style={{ color: 'var(--text)' }}>Trip Expenses</h3>

                    {isEditingBudget ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={tempBudget}
                          onChange={(e) => setTempBudget(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg border font-mono text-[10px] focus:outline-none"
                          style={{
                            background: 'var(--bg)',
                            color: 'var(--text)',
                            borderColor: 'var(--border)',
                          }}
                        />
                        <button
                          onClick={handleSaveBudget}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer"
                          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingBudget(true)}
                        className="text-[10px] hover:underline flex items-center gap-1 cursor-pointer"
                        style={{ color: 'var(--accent)' }}
                      >
                        Edit Limit
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full rounded-full overflow-hidden mb-3" style={{ background: 'var(--surface-3, rgba(255,255,255,0.06))' }}>
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${budgetColorClass}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>

                  {totalSpend > budgetLimit && (
                    <div className="mb-3 p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 inline" />
                        <span>Over Budget</span>
                      </span>
                      <span className="font-mono font-bold">
                        +{currencySymbol}{(totalSpend - budgetLimit).toLocaleString()}
                      </span>
                    </div>
                  )}

                  {/* Expense Breakdown List */}
                  <div className="space-y-2.5 font-mono text-[10px]">
                    {(state.budgetItems || []).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center">
                        <span className="flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
                          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: item.color }}></span> {item.name}
                        </span>
                        <span style={{ color: 'var(--text)' }}>{currencySymbol}{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="h-[1px] my-1" style={{ background: 'var(--border, rgba(255,255,255,0.06))' }}></div>
                    <div className="flex justify-between font-bold text-xs pt-0.5" style={{ color: 'var(--text)' }}>
                      <span>Total</span>
                      <span className={budgetTextColorClass}>{currencySymbol}{totalSpend.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Interview Mode Toggle */}
            <button
              onClick={() => dispatch({ type: 'SET_INTERVIEW_MODE', payload: !state.isInterviewMode })}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all-300 border cursor-pointer"
              style={{
                background: state.isInterviewMode ? 'var(--accent-dim)' : 'var(--surface-2, rgba(255,255,255,0.03))',
                borderColor: state.isInterviewMode ? 'var(--accent-border)' : 'var(--border, rgba(255,255,255,0.06))',
                color: state.isInterviewMode ? 'var(--accent)' : 'var(--muted)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Interview
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              className="flex items-center gap-[6px] px-[14px] py-[6px] rounded-lg text-xs font-semibold cursor-pointer"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--accent-hover, var(--accent))';
                e.currentTarget.style.boxShadow = '0 0 12px var(--accent-glow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--accent)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <svg viewBox="0 0 16 16" fill="none" width="14" height="14">
                <path
                  d="M12.5 14.5h-9a1 1 0 01-1-1v-11a1 1 0 011-1h7l3 3v9a1 1 0 01-1 1z"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M10 14.5v-4h-4v4M10 1.5v3h3"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              {saveText}
            </button>

            {/* New Trip / Exit Button */}
            <button
              onClick={() => setIsNewTripModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-xs font-semibold cursor-pointer border transition-all-300 hover:bg-rose-500/15 hover:border-rose-500/40 hover:text-rose-400"
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
                borderColor: 'var(--border, rgba(255,255,255,0.06))',
                color: 'var(--muted)',
              }}
              title="Exit current itinerary and start a new trip"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">New Trip</span>
            </button>
          </>
        )}

        {/* ─── User Authentication & Cloud Trips Controls ─── */}
        {user ? (
          <div className="flex items-center gap-2 pl-1 border-l" style={{ borderColor: 'var(--border, rgba(255,255,255,0.06))' }}>
            <button
              onClick={() => setIsSavedTripsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-xs font-semibold cursor-pointer border transition-all hover:border-emerald-500/40 hover:text-emerald-400"
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
                borderColor: 'var(--border, rgba(255,255,255,0.06))',
                color: 'var(--text)',
              }}
              title="View all your saved trips"
            >
              <Cloud className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">My Trips</span>
            </button>

            {/* Rich Interactive User Profile Dropdown Menu */}
            <UserProfileDropdown
              onOpenSavedTrips={() => setIsSavedTripsOpen(true)}
              onOpenNewTripModal={() => setIsNewTripModalOpen(true)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-1.5 pl-1 border-l" style={{ borderColor: 'var(--border, rgba(255,255,255,0.06))' }}>
            <button
              onClick={() => openAuthModal('login')}
              className="flex items-center gap-1 px-3 py-[6px] rounded-lg text-xs font-semibold cursor-pointer border transition-colors hover:border-accent hover:text-accent"
              style={{
                background: 'var(--surface-2, rgba(255,255,255,0.03))',
                borderColor: 'var(--border, rgba(255,255,255,0.06))',
                color: 'var(--text)',
              }}
            >
              <LogIn className="w-3.5 h-3.5 text-accent" />
              <span>Log In</span>
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="hidden sm:flex items-center gap-1 px-3 py-[6px] rounded-lg text-xs font-bold cursor-pointer transition-colors"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none',
              }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Sign Up</span>
            </button>
          </div>
        )}

        {/* ─── Theme Switcher ─── */}
        <ThemeSlider />
      </div>

      {/* Export Modal for Google Maps, Apple Maps, GPX, and KML */}
      <ExportModal
        trip={state.trip}
        homestays={state.homestays}
        selectedHomestaysByDay={state.selectedHomestaysByDay}
        selectedHomestayId={state.selectedHomestayId}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />

      {/* Saved Cloud Trips Drawer Modal */}
      <SavedTripsModal
        isOpen={isSavedTripsOpen}
        onClose={() => setIsSavedTripsOpen(false)}
      />

      {/* New Trip Confirmation Modal */}
      <NewTripConfirmModal
        isOpen={isNewTripModalOpen}
        onClose={() => setIsNewTripModalOpen(false)}
        onConfirm={() => dispatch({ type: 'START_NEW_TRIP' })}
      />
    </header>
  );
}
