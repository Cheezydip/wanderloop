import { useState } from 'react';
import { useTrip } from '../context/TripContext';

export default function TopBar() {
  const { state, dispatch } = useTrip();
  const [showBudgetDropdown, setShowBudgetDropdown] = useState(false);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState(state.trip.budget || 25000);

  const numDays = state.trip.days.length;
  
  // Calculate expenses
  const selectedHomestay = state.homestays.find(h => h.id === state.selectedHomestayId);
  const lodgingCost = selectedHomestay ? selectedHomestay.pricePerNight * numDays : 0;
  
  const activitiesCost = state.trip.days.reduce((total, day) => {
    return total + day.stops.reduce((dayTotal, stop) => dayTotal + stop.costEstimate, 0);
  }, 0);
  
  // Mock standard estimates for food and transit per day
  const foodCost = 2000 * numDays;
  const transitCost = 1000 * numDays;
  
  const totalSpend = lodgingCost + activitiesCost + foodCost + transitCost;
  const budgetLimit = state.trip.budget || 25000;
  const percentage = Math.min((totalSpend / budgetLimit) * 100, 100);
  
  // Budget status color
  let budgetColorClass = 'bg-accent';
  let budgetTextColorClass = 'text-accent';
  if (totalSpend > budgetLimit) {
    budgetColorClass = 'bg-rose-500';
    budgetTextColorClass = 'text-rose-500 font-bold';
  } else if (totalSpend > budgetLimit * 0.85) {
    budgetColorClass = 'bg-amber-500';
    budgetTextColorClass = 'text-amber-500';
  }

  const handleSaveBudget = () => {
    dispatch({ type: 'SET_BUDGET', payload: tempBudget });
    setIsEditingBudget(false);
  };

  return (
    <header className="h-14 border-b border-white/[0.06] bg-[rgba(22,29,27,0.85)] backdrop-blur-xl px-5 flex items-center justify-between z-30 relative">
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-accent to-emerald-400 flex items-center justify-center shadow-lg shadow-accent/20">
          <svg className="w-4.5 h-4.5 text-bg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent leading-tight">
            Wanderloop
          </h1>
          <span className="text-[8px] text-muted tracking-[0.2em] uppercase font-mono block -mt-0.5">
            AI Trip Planner
          </span>
        </div>
      </div>

      {/* Trip Title Pill (Desktop) */}
      {state.hasTrip && numDays > 0 && (
        <div className="hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
          </span>
          <span className="text-xs font-semibold">{state.trip.title}</span>
          <span className="text-[10px] text-muted font-mono px-1.5 py-0.5 rounded bg-white/[0.04]">
            {numDays}D
          </span>
        </div>
      )}

      {/* Action Controls */}
      <div className="flex items-center gap-2">
        {state.hasTrip && (
          <>
            {/* Interview Mode Toggle */}
            <button
              onClick={() => dispatch({ type: 'SET_INTERVIEW_MODE', payload: !state.isInterviewMode })}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all-300 border cursor-pointer ${
                state.isInterviewMode
                  ? 'bg-accent/10 border-accent/30 text-accent'
                  : 'bg-white/[0.03] border-white/[0.06] text-muted hover:text-white hover:bg-white/[0.06]'
              }`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Interview
            </button>

            {/* Budget Dropdown Toggle */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowBudgetDropdown(!showBudgetDropdown);
                  setTempBudget(budgetLimit);
                  setIsEditingBudget(false);
                }}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all-300 cursor-pointer ${
                  showBudgetDropdown ? 'bg-white/[0.06] border-accent/20' : ''
                }`}
              >
                <svg className="w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`font-mono ${budgetTextColorClass}`}>
                  ¥{totalSpend.toLocaleString()}
                </span>
                <span className="text-muted">/</span>
                <span className="font-mono text-muted">¥{budgetLimit.toLocaleString()}</span>
                <svg
                  className={`w-3 h-3 text-muted transition-transform duration-200 ${showBudgetDropdown ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Budget Breakdown Dropdown */}
              {showBudgetDropdown && (
                <div className="absolute right-0 mt-2 w-72 glass-panel p-4 rounded-2xl shadow-2xl z-50 scale-in text-xs">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-white text-sm">Trip Expenses</h3>
                    
                    {isEditingBudget ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={tempBudget}
                          onChange={(e) => setTempBudget(Number(e.target.value))}
                          className="w-20 px-2 py-1 rounded-lg bg-bg text-white border border-white/20 font-mono text-[10px] focus:outline-none focus:border-accent"
                        />
                        <button onClick={handleSaveBudget} className="px-2 py-1 bg-accent text-bg rounded-lg text-[10px] font-bold hover:bg-accent/80 cursor-pointer">
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingBudget(true)}
                        className="text-[10px] text-accent hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Edit Limit
                      </button>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="h-1.5 w-full bg-white/[0.06] rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${budgetColorClass}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>

                  {/* Expense Breakdown List */}
                  <div className="space-y-2.5 font-mono text-[10px]">
                    {[
                      { label: 'Lodging', value: lodgingCost, color: 'bg-accent' },
                      { label: 'Activities', value: activitiesCost, color: 'bg-amber-400' },
                      { label: 'Food (Est.)', value: foodCost, color: 'bg-violet-400' },
                      { label: 'Transit (Est.)', value: transitCost, color: 'bg-rose-400' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-muted flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-sm ${color}`}></span> {label}
                        </span>
                        <span className="text-white">¥{value.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="h-[1px] bg-white/[0.06] my-1"></div>
                    <div className="flex justify-between font-bold text-xs text-white pt-0.5">
                      <span>Total</span>
                      <span className={budgetTextColorClass}>¥{totalSpend.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* New Trip Button */}
            <button
              onClick={() => dispatch({ type: 'START_NEW_TRIP' })}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-white/[0.03] border border-white/[0.06] text-muted hover:text-white hover:bg-white/[0.06] transition-all-300 cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              New Trip
            </button>
          </>
        )}

        {/* Save Button */}
        {state.hasTrip && (
          <button className="px-4 py-1.5 rounded-lg text-xs font-bold bg-accent text-bg shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:bg-accent/90 transition-all-300 transform active:scale-95 cursor-pointer">
            Save
          </button>
        )}
      </div>
    </header>
  );
}
