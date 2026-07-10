import { useState, useEffect, useMemo } from 'react';
import { useTrip, DEFAULT_BUDGET_ITEMS } from '../../context/TripContext';
import { getDayColorHex } from '../../utils/colors';
import { haversine } from '../../utils/haversine';
import { fetchOptimizedOrder } from '../../utils/routeService';

/* ─── Skeleton Shimmer for Generating State ─── */
function SkeletonDay({ idx }) {
  return (
    <div
      className="border rounded-2xl overflow-hidden"
      style={{
        animationDelay: `${idx * 120}ms`,
        background: 'var(--surface-2)',
        borderColor: 'var(--border)'
      }}
    >
      <div className="p-4 flex items-center gap-3">
        <div className="w-1.5 h-6 rounded-full shimmer"></div>
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-16 shimmer rounded"></div>
          <div className="h-2 w-24 shimmer rounded"></div>
        </div>
        <div className="h-3 w-12 shimmer rounded"></div>
      </div>
      <div className="px-4 pb-4 border-t pt-3 space-y-2.5" style={{ borderColor: 'var(--border)' }}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2.5 p-2">
            <div className="w-5 h-5 rounded-full shimmer shrink-0"></div>
            <div className="flex-1 space-y-1">
              <div className="h-2.5 w-3/4 shimmer rounded"></div>
              <div className="h-2 w-1/2 shimmer rounded"></div>
            </div>
            <div className="h-2.5 w-10 shimmer rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ItineraryPanel() {
  const { state, dispatch } = useTrip();
  const [expandedDayId, setExpandedDayId] = useState(null);
  const [activeRationaleId, setActiveRationaleId] = useState(null);
  const [optimizingDayId, setOptimizingDayId] = useState(null);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);

  const totalSpend = (state.budgetItems || []).reduce((sum, item) => sum + item.amount, 0);
  const budgetLimit = state.trip.budget || 25000;
  const percentage = Math.min((totalSpend / budgetLimit) * 100, 100);

  const ADD_COLORS = ['#2dd4bf', '#f59e0b', '#8b5cf6', '#f43f5e', '#84cc16', '#a78bfa', '#06b6d4', '#ec4899'];
  const handleAddBudgetItem = () => {
    const nextColor = ADD_COLORS[(state.budgetItems || []).length % ADD_COLORS.length];
    const newItems = [...(state.budgetItems || []), { name: 'New item', amount: 0, color: nextColor }];
    dispatch({ type: 'SET_BUDGET_ITEMS', payload: newItems });
  };

  const handleRemoveBudgetItem = (idx) => {
    const newItems = (state.budgetItems || []).filter((_, i) => i !== idx);
    dispatch({ type: 'SET_BUDGET_ITEMS', payload: newItems });
  };

  const handleUpdateItemName = (idx, val) => {
    const newItems = (state.budgetItems || []).map((item, i) => i === idx ? { ...item, name: val } : item);
    dispatch({ type: 'SET_BUDGET_ITEMS', payload: newItems });
  };

  const handleUpdateItemAmount = (idx, val) => {
    const newItems = (state.budgetItems || []).map((item, i) => i === idx ? { ...item, amount: Number(val) || 0 } : item);
    dispatch({ type: 'SET_BUDGET_ITEMS', payload: newItems });
  };

  const handleUpdateTotalBudget = (val) => {
    dispatch({ type: 'SET_BUDGET', payload: Number(val) || 0 });
  };

  const handleResetBudget = () => {
    dispatch({ type: 'SET_BUDGET', payload: 25000 });
    dispatch({ type: 'SET_BUDGET_ITEMS', payload: DEFAULT_BUDGET_ITEMS });
  };

  // Sync expandedDayId with state.highlightedDayId bi-directionally
  useEffect(() => {
    if (state.highlightedDayId) {
      setExpandedDayId(state.highlightedDayId);
    }
  }, [state.highlightedDayId]);

  const toggleDay = (dayId) => {
    const nextDayId = expandedDayId === dayId ? null : dayId;
    setExpandedDayId(nextDayId);
    // Dispatch highlight day so the map highlights/filters as well
    dispatch({ type: 'HIGHLIGHT_DAY', payload: dayId });
  };

  const visibleHomestays = useMemo(() => {
    if (!expandedDayId) return [];
    const day = state.trip.days.find(d => d.id === expandedDayId);
    if (!day || !day.stops || day.stops.length === 0) return [];
    return state.homestays.filter(h =>
      day.stops.some(stop => haversine(h.lat, h.lng, stop.lat, stop.lng) <= 5)
    );
  }, [state.homestays, state.trip.days, expandedDayId]);

  // Scroll active stop into view smoothly
  useEffect(() => {
    if (state.activeStopId) {
      const targetDay = state.trip.days.find(d => d.stops.some(s => s.id === state.activeStopId));
      if (targetDay && expandedDayId !== targetDay.id) {
        setExpandedDayId(targetDay.id);
      }
      
      const timer = setTimeout(() => {
        const activeElement = document.getElementById(`stop-row-${state.activeStopId}`);
        if (activeElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [state.activeStopId]);

  // Scroll expanded day into view
  useEffect(() => {
    if (expandedDayId) {
      const activeDayElement = document.getElementById(`day-card-${expandedDayId}`);
      if (activeDayElement) {
        activeDayElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [expandedDayId]);

  // Scroll selected homestay into view
  useEffect(() => {
    if (state.selectedHomestayId) {
      // Find the day this homestay belongs to (first day that has a stop within 5km)
      const home = state.homestays.find(h => h.id === state.selectedHomestayId);
      if (home) {
        const targetDay = state.trip.days.find(d =>
          d.stops.some(stop => haversine(home.lat, home.lng, stop.lat, stop.lng) <= 5)
        );
        if (targetDay && expandedDayId !== targetDay.id) {
          setExpandedDayId(targetDay.id);
        }
      }

      const timer = setTimeout(() => {
        const el = document.getElementById(`homestay-card-${state.selectedHomestayId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [state.selectedHomestayId, state.homestays, state.trip.days]);

  const handleOptimizeStops = async (day) => {
    if (day.stops.length < 3) return;
    setOptimizingDayId(day.id);
    try {
      const coords = day.stops.map(s => [s.lng, s.lat]);
      const data = await fetchOptimizedOrder(coords, 'foot-walking');
      if (data && data.code === 'Ok' && data.waypoints) {
        const stopsWithSequence = day.stops.map((stop, idx) => ({
          stop,
          seq: data.waypoints[idx].waypoint_index
        }));
        stopsWithSequence.sort((a, b) => a.seq - b.seq);
        const optimizedStops = stopsWithSequence.map(item => item.stop);

        dispatch({
          type: 'REORDER_STOPS',
          payload: {
            dayId: day.id,
            stops: optimizedStops
          }
        });
      }
    } catch (err) {
      console.error('Failed to optimize stops:', err);
    } finally {
      setOptimizingDayId(null);
    }
  };

  const handleDeleteStop = (dayId, stopId, e) => {
    e.stopPropagation();
    dispatch({ type: 'REMOVE_STOP', payload: { dayId, stopId } });
    if (activeRationaleId === stopId) {
      setActiveRationaleId(null);
    }
  };

  const handleSelectHomestay = (homestayId) => {
    const nextId = state.selectedHomestayId === homestayId ? null : homestayId;
    dispatch({ type: 'SELECT_HOMESTAY', payload: nextId });
    dispatch({ type: 'SELECT_HOMESTAY_ON_MAP', payload: nextId });
    if (nextId) {
      const home = state.homestays.find(h => h.id === nextId);
      if (home) {
        window.dispatchEvent(new CustomEvent('map-pan-to', { detail: { lat: home.lat, lng: home.lng } }));
      }
    }
  };

  const handleHoverHomestay = (homestayId) => {
    dispatch({ type: 'HOVER_HOMESTAY', payload: homestayId });
    if (homestayId) {
      const home = state.homestays.find(h => h.id === homestayId);
      if (home) {
        window.dispatchEvent(new CustomEvent('map-pan-to', { detail: { lat: home.lat, lng: home.lng } }));
      }
    }
  };

  const handleStopHover = (stopId) => {
    dispatch({ type: 'HOVER_STOP', payload: stopId });
  };

  const handleStopClick = (stopId) => {
    dispatch({ type: 'SELECT_STOP', payload: state.activeStopId === stopId ? null : stopId });
  };

  const numDays = state.trip.days.length;

  return (
    <div
      className="flex flex-col h-full w-full md:w-[360px] shrink-0 overflow-hidden"
      style={{
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        color: 'var(--text)',
        transition: 'background 0.6s cubic-bezier(0.16, 1, 0.3, 1), border 0.6s cubic-bezier(0.16, 1, 0.3, 1), color 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface-2)',
          transition: 'background 0.6s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <h2 className="font-bold text-xs flex items-center gap-2 tracking-wide" style={{ color: 'var(--text)' }}>
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid var(--accent-border)'
            }}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--accent)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          Itinerary
        </h2>
        <span
          className="text-[9px] font-mono px-2 py-0.5 rounded-md"
          style={{
            background: 'var(--surface-3)',
            border: '1px solid var(--border)',
            color: 'var(--muted)'
          }}
        >
          {state.trip.days.reduce((acc, d) => acc + d.stops.length, 0)} Stops · {numDays}D
        </span>
      </div>

      {/* Budget Spent Bar */}
      <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-between text-[11px] font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
          <span>Spent</span>
          <span>
            <strong style={{ color: 'var(--text)' }}>¥{totalSpend.toLocaleString()}</strong> / ¥{budgetLimit.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${percentage}%`,
              backgroundColor: percentage > 90 ? '#ef4444' : percentage > 70 ? '#f59e0b' : 'var(--accent)'
            }}
          ></div>
        </div>
      </div>

      {/* Budget Editor Toggle */}
      <div
        onClick={() => setIsBudgetOpen(!isBudgetOpen)}
        className="flex items-center justify-between px-5 py-2.5 border-b cursor-pointer transition-colors hover:bg-white/[0.02]"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="text-[11px] font-semibold flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
          <svg viewBox="0 0 16 16" fill="none" width="12" height="12">
            <path d="M8 1v14M5 4h4a2 2 0 010 4H5M5 8h5a2 2 0 010 4H5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Edit budget
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform duration-300 ${isBudgetOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          style={{ color: 'var(--muted)' }}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Budget Editor Panel */}
      {isBudgetOpen && (
        <div className="border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface-2)' }}>
          <div className="px-5 py-3 space-y-3">
            {/* Total Budget */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-medium shrink-0" style={{ color: 'var(--muted)' }}>Total budget</label>
              <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--muted)' }}>¥</span>
              <input
                type="number"
                value={budgetLimit}
                onChange={(e) => handleUpdateTotalBudget(e.target.value)}
                className="flex-1 px-2.5 py-1.5 rounded-lg border font-mono text-[11px] outline-none transition-colors focus:border-accent"
                style={{
                  background: 'var(--bg)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)'
                }}
              />
            </div>

            {/* Budget Items List */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
              {(state.budgetItems || []).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-1.5 rounded-lg border"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateItemName(idx, e.target.value)}
                    className="flex-1 text-[11px] font-medium bg-transparent border-none outline-none focus:text-accent"
                    style={{ color: 'var(--text)' }}
                  />
                  <input
                    type="number"
                    value={item.amount}
                    onChange={(e) => handleUpdateItemAmount(idx, e.target.value)}
                    className="w-16 text-right px-1.5 py-0.5 rounded border bg-transparent font-mono text-[10px] outline-none focus:border-accent"
                    style={{ borderColor: 'transparent', color: 'var(--text)' }}
                    onFocus={(e) => e.target.style.borderColor = 'var(--border)'}
                    onBlur={(e) => e.target.style.borderColor = 'transparent'}
                  />
                  <button
                    onClick={() => handleRemoveBudgetItem(idx)}
                    className="p-1 rounded text-muted hover:text-red-400 hover:bg-white/[0.05] transition-all cursor-pointer"
                  >
                    <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add / Reset Buttons */}
            <div className="flex gap-2">
              <button
                onClick={handleAddBudgetItem}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border border-dashed text-[10px] font-semibold cursor-pointer transition-colors"
                style={{
                  background: 'var(--accent-dim)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent)'
                }}
              >
                <svg viewBox="0 0 16 16" fill="none" width="10" height="10">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                Add item
              </button>
              <button
                onClick={handleResetBudget}
                className="px-3 py-1.5 rounded-lg border text-[10px] font-medium cursor-pointer transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Container */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        
        {/* ─── Generating State: Skeleton Shimmers ─── */}
        {state.isGenerating ? (
          <div className="space-y-3 stagger-children">
            <SkeletonDay idx={0} />
            <SkeletonDay idx={1} />
            <SkeletonDay idx={2} />
          </div>
        ) : (
          <>
            {/* Day Cards */}
            <div className="space-y-2.5 stagger-children">
              {state.trip.days.map((day) => {
                const isExpanded = expandedDayId === day.id;
                const colorHex = getDayColorHex(day.colorHue);

                const dayCost = day.stops.reduce((sum, s) => sum + s.costEstimate, 0);
                
                let estCommute = 0;
                const routeData = state.routesData[day.id];
                if (routeData && routeData.features && routeData.features[0] && routeData.features[0].properties.summary) {
                  estCommute = Math.round(routeData.features[0].properties.summary.duration / 60);
                } else {
                  let totalHaversineDist = 0;
                  for (let i = 0; i < day.stops.length - 1; i++) {
                    totalHaversineDist += haversine(day.stops[i].lat, day.stops[i].lng, day.stops[i+1].lat, day.stops[i+1].lng);
                  }
                  estCommute = Math.round(totalHaversineDist * 12);
                }

                return (
                  <div
                    key={day.id}
                    id={`day-card-${day.id}`}
                    className="border rounded-2xl overflow-hidden transition-all duration-300"
                    style={{
                      background: 'var(--surface-2)',
                      borderColor: isExpanded ? `${colorHex}40` : 'var(--border)',
                      boxShadow: isExpanded ? '0 10px 25px -5px rgba(0,0,0,0.1)' : 'none'
                    }}
                  >
                    {/* Day Header Accordion */}
                    <div
                      onClick={() => toggleDay(day.id)}
                      className="px-3.5 py-3 flex items-center justify-between cursor-pointer select-none group"
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Color indicator */}
                        <div
                          className="w-1 h-5 rounded-full"
                          style={{ backgroundColor: colorHex }}
                        ></div>
                        <div>
                          <h3 className="font-bold text-xs flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                            Day {day.dayNumber}
                            <span style={{ color: 'var(--muted)', fontWeight: 'normal', fontSize: '9px' }}>
                              · {day.stops.length} locations
                            </span>
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                          ¥{dayCost.toLocaleString()}
                        </span>
                        <svg
                          className={`w-3.5 h-3.5 transition-transform duration-300 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          style={{ color: 'var(--muted)' }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Day Stops (Expanded Content) */}
                    {isExpanded && (
                      <div
                        className="px-3.5 pb-3.5 pt-2 space-y-1.5 slide-up border-t"
                        style={{ borderColor: 'var(--border)' }}
                      >
                        {day.stops.length === 0 ? (
                          <p className="text-[10px] py-3 text-center" style={{ color: 'var(--muted)' }}>No stops added yet</p>
                        ) : (
                          day.stops.map((stop, idx) => {
                            const isHovered = state.hoveredStopId === stop.id;
                            const isActive = state.activeStopId === stop.id;

                            const nextStop = day.stops[idx + 1];
                            let commuteText = '';
                            if (nextStop) {
                              const routeData = state.routesData[day.id];
                              if (routeData && routeData.features && routeData.features[0] && routeData.features[0].properties.legs && routeData.features[0].properties.legs[idx]) {
                                const leg = routeData.features[0].properties.legs[idx];
                                const distance = leg.distance;
                                const duration = leg.duration;
                                const mins = Math.round(duration / 60);
                                const distStr = distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;
                                commuteText = `🚶 ${distStr} · ${mins} min walking`;
                              } else {
                                const dist = haversine(stop.lat, stop.lng, nextStop.lat, nextStop.lng);
                                const mins = Math.round(dist * 12);
                                const distStr = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
                                commuteText = `🚶 ${distStr} · ~${mins} min`;
                              }
                            }

                            return (
                              <div key={stop.id} className="space-y-1">
                                <div
                                  id={`stop-row-${stop.id}`}
                                  onClick={() => handleStopClick(stop.id)}
                                  onMouseEnter={() => handleStopHover(stop.id)}
                                  onMouseLeave={() => handleStopHover(null)}
                                  className="p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all duration-200 group/stop cursor-pointer"
                                  style={{
                                    background: isActive
                                      ? 'var(--accent-dim)'
                                      : isHovered
                                      ? 'var(--surface-3)'
                                      : 'var(--surface)',
                                    borderColor: isActive
                                      ? 'var(--accent-border)'
                                      : isHovered
                                      ? 'var(--border)'
                                      : 'var(--border)'
                                  }}
                                >
                                  <div className="flex items-start gap-2 min-w-0">
                                    {/* Drag handle */}
                                    <div className="flex flex-col gap-[2px] mt-1 opacity-0 group-hover/stop:opacity-40 transition-opacity cursor-grab shrink-0">
                                      <div className="flex gap-[2px]">
                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}></span>
                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}></span>
                                      </div>
                                      <div className="flex gap-[2px]">
                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}></span>
                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}></span>
                                      </div>
                                      <div className="flex gap-[2px]">
                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}></span>
                                        <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }}></span>
                                      </div>
                                    </div>

                                    {/* Index bubble */}
                                    <span
                                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center font-mono text-[8px] font-bold"
                                      style={{ backgroundColor: colorHex, color: 'var(--bg)' }}
                                    >
                                      {stop.order}
                                    </span>
                                    <div className="min-w-0">
                                      <h4 className="font-semibold truncate text-[11px]" style={{ color: 'var(--text)' }}>{stop.name}</h4>
                                      <span className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>{stop.timeEstimate}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono text-[9px]" style={{ color: 'var(--muted)' }}>
                                      {stop.costEstimate === 0 ? 'Free' : `¥${stop.costEstimate.toLocaleString()}`}
                                    </span>
                                    <button
                                      onClick={(e) => handleDeleteStop(day.id, stop.id, e)}
                                      className="p-0.5 rounded hover:text-rose-400 hover:bg-white/[0.05] opacity-0 group-hover/stop:opacity-100 transition-all cursor-pointer"
                                      style={{ color: 'var(--muted)' }}
                                      title="Remove stop"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Rationale & Nearby POIs Popover */}
                                {isActive && (
                                  <div
                                    className="mx-1 p-2.5 rounded-lg text-[10px] leading-relaxed scale-in space-y-2.5 text-left border"
                                    style={{
                                      background: 'var(--accent-dim)',
                                      borderColor: 'var(--accent-border)',
                                      color: 'var(--text)'
                                    }}
                                  >
                                    <div>
                                      <span className="font-bold uppercase tracking-wider text-[7.5px] block mb-1" style={{ color: 'var(--accent)' }}>
                                        AI Rationale · Why this?
                                      </span>
                                      {stop.rationale}
                                    </div>

                                    {/* Nearby Recommendations */}
                                    <div className="pt-2.5 border-t" style={{ borderColor: 'var(--accent-border)' }}>
                                      <span className="font-bold uppercase tracking-wider text-[7.5px] block mb-1.5 flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                                        <span>📍</span> Nearby Cafes, Restaurants & Shops
                                      </span>
                                      {state.loadingPOIs ? (
                                        <div className="flex items-center gap-1.5 py-1">
                                          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '0ms' }}></span>
                                          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '150ms' }}></span>
                                          <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'var(--accent)', animationDelay: '300ms' }}></span>
                                          <span className="text-[8px] font-mono" style={{ color: 'var(--muted)' }}>Searching nearby places...</span>
                                        </div>
                                      ) : state.nearbyPOIs && state.nearbyPOIs.length > 0 ? (
                                        <div className="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 no-scrollbar">
                                          {state.nearbyPOIs.map((poi) => {
                                            let icon = '📍';
                                            if (poi.category === 'food') icon = '🍱';
                                            else if (poi.category === 'cafe') icon = '☕';
                                            else if (poi.category === 'sight') icon = '🏛️';
                                            return (
                                              <div 
                                                key={poi.id} 
                                                onClick={() => {
                                                  window.dispatchEvent(new CustomEvent('show-poi-popup', { detail: poi }));
                                                }}
                                                className="flex justify-between items-start gap-2 p-1.5 rounded border transition-colors cursor-pointer"
                                                style={{
                                                  background: 'var(--surface)',
                                                  borderColor: 'var(--border)'
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                              >
                                                <div className="min-w-0 flex-1">
                                                  <div className="font-semibold truncate text-[9.5px] flex items-center gap-1" style={{ color: 'var(--text)' }}>
                                                    <span>{icon}</span>
                                                    <span>{poi.name}</span>
                                                  </div>
                                                  <div className="text-[8px] truncate" style={{ color: 'var(--muted)' }}>{poi.address}</div>
                                                </div>
                                                <div className="text-[8px] font-mono shrink-0 font-bold" style={{ color: 'var(--warm)' }}>
                                                  ★ {poi.rating}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      ) : (
                                        <div className="text-[8px]" style={{ color: 'var(--muted)' }}>No nearby places found.</div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {commuteText && (
                                  <div className="flex items-center gap-2 pl-3 py-1 my-0.5 text-[9px] font-mono" style={{ color: 'var(--muted)' }}>
                                    <div className="w-4 flex justify-center">
                                      <div className="w-0.5 h-3 border-l border-dashed" style={{ borderColor: 'var(--border)' }}></div>
                                    </div>
                                    <div className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] flex items-center gap-1">
                                      {commuteText}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {/* Card Footer Totals */}
                        <div
                          className="pt-2 border-t flex items-center justify-between font-mono text-[9px] mt-1"
                          style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                        >
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            ~{estCommute} min transit
                          </span>
                          <span className="font-semibold text-white/70" style={{ color: 'var(--text)' }}>¥{dayCost.toLocaleString()}</span>
                        </div>

                        {/* Add / Re-optimize Actions */}
                        <div className="pt-2 flex gap-1.5">
                          <button
                            className="flex-1 py-1.5 rounded-lg border text-[9px] font-semibold transition-all cursor-pointer"
                            style={{
                              background: 'var(--surface)',
                              borderColor: 'var(--border)',
                              color: 'var(--muted)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--accent-border)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                          >
                            + Add Stop
                          </button>
                          <button
                            onClick={() => handleOptimizeStops(day)}
                            disabled={optimizingDayId === day.id || day.stops.length < 3}
                            className="flex-1 py-1.5 rounded-lg text-[9px] font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{
                              background: 'var(--accent-dim)',
                              border: '1px solid var(--accent-border)',
                              color: 'var(--accent)'
                            }}
                            onMouseEnter={(e) => { if (optimizingDayId !== day.id && day.stops.length >= 3) e.currentTarget.style.background = 'rgba(232,93,58,0.15)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent-dim)'; }}
                          >
                            {optimizingDayId === day.id ? 'Optimizing...' : 'Re-optimize'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Homestay Recommendations Section */}
            {state.homestays.length > 0 && (
              <div
                className="space-y-3 pt-3 border-t"
                style={{ borderColor: 'var(--border)' }}
              >
                <div>
                  <h3 className="font-bold text-xs flex items-center gap-2" style={{ color: 'var(--text)' }}>
                    <div
                      className="w-5 h-5 rounded-md flex items-center justify-center"
                      style={{
                        background: 'var(--accent-dim)',
                        border: '1px solid var(--accent-border)'
                      }}
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--accent)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    Lodging Matches
                  </h3>
                  <p className="text-[9px] mt-0.5 ml-7" style={{ color: 'var(--muted)' }}>Ranked by route fit, price & ratings</p>
                </div>

                {expandedDayId ? (
                  <div className="space-y-2 stagger-children">
                    {visibleHomestays.length > 0 ? (
                      visibleHomestays.map((home) => {
                        const isSelected = state.selectedHomestayId === home.id;
                        const activeDayNum = state.trip.days.find(d => d.id === expandedDayId)?.dayNumber;
                        return (
                          <div
                            key={home.id}
                            id={`homestay-card-${home.id}`}
                            onMouseEnter={() => handleHoverHomestay(home.id)}
                            onMouseLeave={() => handleHoverHomestay(null)}
                            className="p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer"
                            style={{
                              background: isSelected
                                ? 'var(--accent-dim)'
                                : 'var(--surface-2)',
                              borderColor: isSelected
                                ? 'var(--accent-border)'
                                : 'var(--border)'
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <h4 className="font-bold text-[11px] flex items-center gap-1.5" style={{ color: 'var(--text)' }}>
                                <span className="text-sm opacity-70">⌂</span>
                                {home.name}
                              </h4>
                              <div className="flex items-center gap-1 text-[9px] font-mono" style={{ color: 'var(--warm)' }}>
                                <span>★</span>
                                <span>{home.rating}</span>
                                <span style={{ color: 'var(--muted)' }}>({home.reviewCount})</span>
                              </div>
                            </div>

                            <p className="text-[9px] font-medium mt-1.5 font-mono flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              {home.avgCommuteMinutes} min avg to Day {activeDayNum || '?'} stops
                            </p>

                            <div className="flex flex-wrap gap-1 mt-2">
                              {home.amenities.map((amenity, idx) => (
                                <span
                                  key={idx}
                                  className="px-1.5 py-0.5 rounded border text-[8px] font-mono"
                                  style={{
                                    background: 'var(--surface-3)',
                                    borderColor: 'var(--border)',
                                    color: 'var(--muted)'
                                  }}
                                >
                                  {amenity}
                                </span>
                              ))}
                            </div>

                            <div className="h-[1px] my-2.5" style={{ background: 'var(--border)' }}></div>

                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-mono text-xs font-bold" style={{ color: 'var(--text)' }}>
                                  ¥{home.pricePerNight.toLocaleString()}
                                </span>
                                <span className="text-[8px]" style={{ color: 'var(--muted)' }}> / night</span>
                              </div>
                              <button
                                onClick={() => handleSelectHomestay(home.id)}
                                className="px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all transform active:scale-95 cursor-pointer"
                                style={
                                  isSelected
                                    ? {
                                        background: 'var(--accent)',
                                        color: 'var(--bg)'
                                      }
                                    : {
                                        background: 'var(--surface-3)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text)'
                                      }
                                }
                              >
                                {isSelected ? '✓ Selected' : 'Choose'}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div
                        className="p-4 rounded-xl border text-center"
                        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                      >
                        <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
                          No nearby lodging found for this day's stops.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="p-4 rounded-xl border text-center space-y-2"
                    style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg mx-auto flex items-center justify-center"
                      style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-border)' }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--accent)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                      </svg>
                    </div>
                    <p className="text-[10px] font-semibold" style={{ color: 'var(--text)' }}>
                      Select a day to see lodging
                    </p>
                    <p className="text-[9px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                      Click on a day above to discover nearby homestays and lodging options matched to that day's route.
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
