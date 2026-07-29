import { useState, useEffect, useMemo, useRef } from 'react';
import { useTrip, DEFAULT_BUDGET_ITEMS } from '../../context/TripContext';
import { useAuth } from '../../context/AuthContext';
import { getDayColorHex } from '../../utils/colors';
import { haversine } from '../../utils/haversine';
import { fetchOptimizedOrder } from '../../utils/routeService';
import { getCurrencySymbol } from '../../utils/currency';
import { getStopLabel, CategoryIcon } from '../../utils/stopUtils';
import { buildGoogleMapsUrl, buildSinglePlaceGoogleMapsUrl } from '../../utils/exportUtils';
import { AlertTriangle, Footprints, Car, Train, Compass, Star, Trash2, Moon, MapPin, Heart } from 'lucide-react';

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
  const { user, addToWishlist, removeFromWishlist, isInWishlist } = useAuth();
  const [expandedDayId, setExpandedDayId] = useState(null);
  const [activeRationaleId, setActiveRationaleId] = useState(null);
  const [optimizingDayId, setOptimizingDayId] = useState(null);
  const [isBudgetOpen, setIsBudgetOpen] = useState(false);
  const [wishlistSaving, setWishlistSaving] = useState(false);

  const tripDestinationName = state.trip?.title || 'Trip Destination';
  const isTripWishlisted = isInWishlist(tripDestinationName);

  const handleToggleTripWishlist = async () => {
    if (wishlistSaving) return;
    setWishlistSaving(true);
    try {
      if (isTripWishlisted) {
        await removeFromWishlist(tripDestinationName);
      } else {
        await addToWishlist({
          name: tripDestinationName,
          notes: `Saved from Wanderloop itinerary (${state.trip?.days?.length || 0} Days)`,
          category: 'Destination',
        });
      }
    } catch (err) {
      console.error('Failed to update wishlist:', err);
    } finally {
      setWishlistSaving(false);
    }
  };

  // ─── Drag-and-Drop State ───
  const [dragState, setDragState] = useState({ dayId: null, dragIdx: null, overIdx: null });

  const handleDragStart = (e, dayId, idx) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', idx.toString());
    setDragState({ dayId, dragIdx: idx, overIdx: null });
  };

  const handleDragOver = (e, dayId, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragState.dayId === dayId && dragState.overIdx !== idx) {
      setDragState(prev => ({ ...prev, overIdx: idx }));
    }
  };

  const handleDrop = (e, dayId, dropIdx) => {
    e.preventDefault();
    const { dragIdx } = dragState;
    if (dragIdx === null || dragIdx === dropIdx || dragState.dayId !== dayId) {
      setDragState({ dayId: null, dragIdx: null, overIdx: null });
      return;
    }
    const day = state.trip?.days?.find(d => d.id === dayId);
    if (!day) return;
    const newStops = [...day.stops];
    const [moved] = newStops.splice(dragIdx, 1);
    newStops.splice(dropIdx, 0, moved);
    dispatch({ type: 'REORDER_STOPS', payload: { dayId, stops: newStops } });
    setDragState({ dayId: null, dragIdx: null, overIdx: null });
  };

  const handleDragEnd = () => {
    setDragState({ dayId: null, dragIdx: null, overIdx: null });
  };

  // ─── Add Stop Modal State ───
  const [addStopModalDayId, setAddStopModalDayId] = useState(null);
  const [newStopName, setNewStopName] = useState('');
  const [newStopCost, setNewStopCost] = useState('');
  const [newStopTime, setNewStopTime] = useState('10:00 AM - 12:00 PM');
  const [newStopRationale, setNewStopRationale] = useState('');

  const currencySymbol = getCurrencySymbol(state.trip);
  const totalSpend = (state.budgetItems || []).reduce((sum, item) => sum + item.amount, 0);
  const budgetLimit = state.trip?.budget || 25000;
  const percentage = Math.min((totalSpend / budgetLimit) * 100, 100);
  const isOverBudget = totalSpend > budgetLimit;
  const exceededAmount = isOverBudget ? totalSpend - budgetLimit : 0;

  const handleOpenAddStopModal = (dayId) => {
    setAddStopModalDayId(dayId);
    setNewStopName('');
    setNewStopCost('');
    setNewStopTime('10:00 AM - 12:00 PM');
    setNewStopRationale('');
  };

  const handleConfirmAddStop = async (e) => {
    e.preventDefault();
    if (!newStopName.trim()) return;

    const stopTitle = newStopName.trim();
    const costNum = Number(newStopCost) || 0;
    const targetDay = state.trip?.days?.find(d => d.id === addStopModalDayId);
    const baseStop = targetDay?.stops?.[targetDay?.stops?.length - 1] || targetDay?.stops?.[0];
    const baseLat = baseStop?.lat || state.mapCenter?.lat || 35.6895;
    const baseLng = baseStop?.lng || state.mapCenter?.lng || 139.6917;

    let stopLat = baseLat + (Math.random() - 0.5) * 0.005;
    let stopLng = baseLng + (Math.random() - 0.5) * 0.005;

    try {
      const res = await fetch(`/api/geocode?text=${encodeURIComponent(stopTitle)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          const [geoLng, geoLat] = data.features[0].geometry.coordinates;
          if (typeof geoLat === 'number' && typeof geoLng === 'number' && !isNaN(geoLat) && !isNaN(geoLng)) {
            stopLat = geoLat;
            stopLng = geoLng;
          }
        }
      }
    } catch (geoErr) {
      console.warn('Manual stop geocode fallback:', geoErr);
    }

    const newStop = {
      id: `s-added-${Date.now()}`,
      name: stopTitle,
      lat: stopLat,
      lng: stopLng,
      timeEstimate: newStopTime || '10:00 AM - 12:00 PM',
      costEstimate: costNum,
      rationale: newStopRationale.trim() || 'Custom user added stop',
      order: (targetDay?.stops?.length || 0) + 1
    };

    dispatch({ type: 'ADD_STOP', payload: { dayId: addStopModalDayId, stop: newStop } });
    setAddStopModalDayId(null);
  };

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

  // Sync expandedDayId with state.highlightedDayId when map or external actions highlight a day
  useEffect(() => {
    setExpandedDayId(state.highlightedDayId || null);
  }, [state.highlightedDayId]);

  const toggleDay = (dayId) => {
    const nextDayId = expandedDayId === dayId ? null : dayId;
    setExpandedDayId(nextDayId);
    // Dispatch highlight day so the map highlights/filters as well (or null if collapsing)
    dispatch({ type: 'HIGHLIGHT_DAY', payload: nextDayId });
  };

  const visibleHomestays = useMemo(() => {
    if (!state.homestays || state.homestays.length === 0) return [];
    if (!expandedDayId || !state.trip?.days) return state.homestays;
    const day = state.trip.days.find(d => d.id === expandedDayId);
    if (!day || !day.stops || day.stops.length === 0) return state.homestays;
    const nearby = state.homestays.filter(h =>
      day.stops.some(stop => haversine(h.lat, h.lng, stop.lat, stop.lng) <= 50)
    );
    return nearby.length > 0 ? nearby : state.homestays;
  }, [state.homestays, state.trip?.days, expandedDayId]);

  // Scroll active stop into view smoothly
  useEffect(() => {
    if (state.activeStopId && state.trip?.days) {
      const targetDay = state.trip.days.find(d => d.stops?.some(s => s.id === state.activeStopId));
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

  // Scroll selected homestay into view ONLY when selectedHomestayId changes
  const prevHomestayRef = useRef(state.selectedHomestayId);
  useEffect(() => {
    if (state.selectedHomestayId && state.selectedHomestayId !== prevHomestayRef.current) {
      prevHomestayRef.current = state.selectedHomestayId;
      const home = state.homestays.find(h => h.id === state.selectedHomestayId);
      if (home && state.trip?.days) {
        const targetDay = state.trip.days.find(d =>
          d.stops?.some(stop => haversine(home.lat, home.lng, stop.lat, stop.lng) <= 25)
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
    } else {
      prevHomestayRef.current = state.selectedHomestayId;
    }
  }, [state.selectedHomestayId]);

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

  const handleSelectHomestay = (homestayId, targetDayId = null) => {
    const dayId = targetDayId || expandedDayId || state.highlightedDayId || state.trip?.days?.[0]?.id || 'day-1';
    if (!expandedDayId) {
      setExpandedDayId(dayId);
    }
    dispatch({ type: 'SELECT_HOMESTAY', payload: { dayId, homestayId } });
    dispatch({ type: 'SELECT_HOMESTAY_ON_MAP', payload: homestayId });
    if (homestayId) {
      const home = state.homestays.find(h => h.id === homestayId);
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

  const numDays = state.trip?.days?.length || 0;

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

        <div className="flex items-center gap-2">
          {/* Wishlist Destination Heart Button */}
          <button
            type="button"
            onClick={handleToggleTripWishlist}
            disabled={wishlistSaving}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer border"
            style={{
              background: isTripWishlisted ? 'rgba(244, 63, 94, 0.15)' : 'var(--surface-3)',
              borderColor: isTripWishlisted ? 'rgba(244, 63, 94, 0.4)' : 'var(--border)',
              color: isTripWishlisted ? '#f43f5e' : 'var(--muted)',
            }}
            title={isTripWishlisted ? 'Remove destination from Wishlist' : 'Save destination to Wishlist'}
          >
            <Heart className={`w-3.5 h-3.5 ${isTripWishlisted ? 'fill-rose-500 text-rose-500' : ''}`} />
            <span>{isTripWishlisted ? 'Saved' : 'Wishlist'}</span>
          </button>

          <span
            className="text-[9px] font-mono px-2 py-0.5 rounded-md"
            style={{
              background: 'var(--surface-3)',
              border: '1px solid var(--border)',
              color: 'var(--muted)'
            }}
          >
            {state.trip?.days?.reduce((acc, d) => acc + (d.stops?.length || 0), 0) || 0} Stops · {numDays}D
          </span>
        </div>
      </div>

      {/* Budget Spent Bar */}
      <div className="px-5 py-3.5 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex justify-between text-[11px] font-medium mb-1.5" style={{ color: 'var(--muted)' }}>
          <span>Spent</span>
          <span>
            <strong style={{ color: isOverBudget ? '#f87171' : 'var(--text)' }}>
              {currencySymbol}{totalSpend.toLocaleString()}
            </strong> / {currencySymbol}{budgetLimit.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-rose-500 animate-pulse' : ''}`}
            style={{
              width: `${percentage}%`,
              backgroundColor: isOverBudget ? '#ef4444' : percentage > 70 ? '#f59e0b' : 'var(--accent)'
            }}
          ></div>
        </div>
        {isOverBudget && (
          <div className="mt-2.5 px-3 py-1.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 text-[10px] font-semibold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 inline" />
              <span>Budget Exceeded</span>
            </span>
            <span className="font-mono font-bold text-[11px]">
              +{currencySymbol}{exceededAmount.toLocaleString()} over limit
            </span>
          </div>
        )}
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
              <span className="text-[11px] font-mono shrink-0" style={{ color: 'var(--muted)' }}>{currencySymbol}</span>
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
              {state.trip?.days?.map((day) => {
                const isExpanded = expandedDayId === day.id;
                const colorHex = getDayColorHex(day.colorHue);

                const dayCost = day.stops?.reduce((sum, s) => sum + s.costEstimate, 0) || 0;
                
                let estCommute = 0;
                const routeData = state.routesData[day.id];
                if (routeData && routeData.features && routeData.features[0] && routeData.features[0].properties.summary) {
                  estCommute = Math.round(routeData.features[0].properties.summary.duration / 60);
                } else if (day.stops) {
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

                      <div className="flex items-center gap-2">
                        {(() => {
                          const dayHotelIds = state.selectedHomestaysByDay?.[day.id] || [];
                          const dayHotels = (state.homestays || []).filter(h => dayHotelIds.includes(h.id));
                          const dayStopsWithHotel = [
                            ...dayHotels.map(h => ({ name: `${h.name} (Hotel)`, lat: h.lat, lng: h.lng })),
                            ...(day.stops || [])
                          ];
                          return (
                            <a
                              href={buildGoogleMapsUrl(dayStopsWithHotel, 'transit', state.trip?.title)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded hover:bg-white/10 text-muted hover:text-accent transition-colors flex items-center gap-1 text-[10px]"
                              title={`Open Day ${day.dayNumber} route in Google Maps`}
                            >
                              <svg className="w-3 h-3 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                              </svg>
                              <span className="hidden sm:inline text-[9px]">Maps</span>
                            </a>
                          );
                        })()}
                        <span className="font-mono text-[10px]" style={{ color: 'var(--muted)' }}>
                          {currencySymbol}{dayCost.toLocaleString()}
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
                            const isDragging = dragState.dayId === day.id && dragState.dragIdx === idx;
                            const isDragOver = dragState.dayId === day.id && dragState.overIdx === idx;
                            const stopLabelInfo = getStopLabel(stop, day.stops);

                            const nextStop = day.stops[idx + 1];
                            let commuteText = '';
                            if (nextStop) {
                              const routeData = state.routesData[day.id];
                              if (routeData && routeData.features && routeData.features[0] && routeData.features[0].properties.legs && routeData.features[0].properties.legs[idx]) {
                                const leg = routeData.features[0].properties.legs[idx];
                                const distance = leg.distance;
                                const distStr = distance < 1000 ? `${Math.round(distance)}m` : `${(distance / 1000).toFixed(1)}km`;
                                if (distance < 1500) {
                                  const mins = Math.round(leg.duration / 60);
                                  commuteText = `${distStr} · ${mins} min walk`;
                                } else if (distance < 15000) {
                                  const driveMins = Math.max(1, Math.round(distance / 500));
                                  commuteText = `${distStr} · ~${driveMins} min drive`;
                                } else {
                                  const trainMins = Math.max(1, Math.round(distance / 800));
                                  commuteText = `${distStr} · ~${trainMins} min train`;
                                }
                              } else {
                                const dist = haversine(stop.lat, stop.lng, nextStop.lat, nextStop.lng);
                                const distStr = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
                                if (dist < 1.5) {
                                  const mins = Math.max(1, Math.round(dist / 0.08));
                                  commuteText = `${distStr} · ~${mins} min walk`;
                                } else if (dist < 15) {
                                  const driveMins = Math.max(1, Math.round(dist / 0.5));
                                  commuteText = `${distStr} · ~${driveMins} min drive`;
                                } else {
                                  const trainMins = Math.max(1, Math.round(dist / 0.8));
                                  commuteText = `${distStr} · ~${trainMins} min train`;
                                }
                              }
                            }

                            return (
                              <div key={stop.id} className="space-y-1">
                                {/* Drag insertion indicator */}
                                {isDragOver && dragState.dragIdx !== null && dragState.dragIdx > idx && (
                                  <div className="drag-insertion-line visible" />
                                )}
                                <div
                                  id={`stop-row-${stop.id}`}
                                  draggable
                                  onDragStart={(e) => handleDragStart(e, day.id, idx)}
                                  onDragOver={(e) => handleDragOver(e, day.id, idx)}
                                  onDrop={(e) => handleDrop(e, day.id, idx)}
                                  onDragEnd={handleDragEnd}
                                  onClick={() => handleStopClick(stop.id)}
                                  onMouseEnter={() => handleStopHover(stop.id)}
                                  onMouseLeave={() => handleStopHover(null)}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all duration-200 group/stop cursor-pointer ${isDragging ? 'stop-tile-dragging' : ''}`}
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
                                    <div className="flex flex-col gap-[2px] mt-1 opacity-0 group-hover/stop:opacity-40 transition-opacity cursor-grab shrink-0"
                                      onMouseDown={(e) => { e.currentTarget.parentElement.parentElement.draggable = true; }}
                                    >
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
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-[8px] font-mono px-1 py-0.5 rounded shrink-0 font-bold" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                                          {stopLabelInfo.label}
                                        </span>
                                        <h4 className="font-semibold truncate text-[11px]" style={{ color: 'var(--text)' }}>{stop.name}</h4>
                                      </div>
                                      <span className="text-[9px] font-mono" style={{ color: 'var(--muted)' }}>{stop.timeEstimate}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono text-[9px]" style={{ color: 'var(--muted)' }}>
                                      {stop.costEstimate === 0 ? 'Free' : `${currencySymbol}${stop.costEstimate.toLocaleString()}`}
                                    </span>
                                    <a
                                      href={buildSinglePlaceGoogleMapsUrl(stop, state.trip?.title)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-0.5 rounded hover:text-blue-400 hover:bg-white/[0.05] opacity-0 group-hover/stop:opacity-100 transition-all cursor-pointer"
                                      style={{ color: 'var(--muted)' }}
                                      title="Open location in Google Maps"
                                    >
                                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                      </svg>
                                    </a>
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
                                        <Compass className="w-3 h-3 text-accent inline" /> Nearby Cafes, Restaurants & Shops
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
                                          {(() => {
                                            const panelPoiCounters = { cafe: 0, food: 0, sight: 0, hotel: 0, other: 0 };
                                            return state.nearbyPOIs.map((poi) => {
                                              let categoryLabel = 'POI';
                                              const cat = poi.category || 'other';
                                              if (cat === 'food') { categoryLabel = 'Food'; panelPoiCounters.food++; }
                                              else if (cat === 'cafe') { categoryLabel = 'Cafe'; panelPoiCounters.cafe++; }
                                              else if (cat === 'sight') { categoryLabel = 'Sight'; panelPoiCounters.sight++; }
                                              else if (cat === 'hotel') { categoryLabel = 'Hotel'; panelPoiCounters.hotel++; }
                                              else { panelPoiCounters.other++; }
                                              const labelNum = panelPoiCounters[cat] || panelPoiCounters.other;
                                              const poiLabel = `${categoryLabel} ${labelNum}`;
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
                                                      <CategoryIcon iconType={cat} size={11} className="text-accent shrink-0" />
                                                      <span className="text-[8px] font-mono px-1 py-0 rounded" style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{poiLabel}</span>
                                                      <span>{poi.name}</span>
                                                    </div>
                                                    <div className="text-[8px] truncate" style={{ color: 'var(--muted)' }}>{poi.address}</div>
                                                  </div>
                                                  <div className="text-[8px] font-mono shrink-0 font-bold flex items-center gap-0.5" style={{ color: 'var(--warm)' }}>
                                                    <Star size={9} className="fill-amber-400 text-amber-400 inline" /> {poi.rating}
                                                  </div>
                                                </div>
                                              );
                                            });
                                          })()}
                                        </div>
                                      ) : (
                                        <div className="text-[8px]" style={{ color: 'var(--muted)' }}>No nearby places found.</div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Drag insertion indicator (below) */}
                                {isDragOver && dragState.dragIdx !== null && dragState.dragIdx < idx && (
                                  <div className="drag-insertion-line visible" />
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

                        {/* Selected Lodgings / Stay at Hotel section at the end of day's activities */}
                        {(() => {
                          const selectedHotelIdsForDay = state.selectedHomestaysByDay?.[day.id] || [];
                          const selectedHotelsForDay = state.homestays.filter(h => selectedHotelIdsForDay.includes(h.id));
                          
                          if (selectedHotelsForDay.length === 0) return null;

                          return (
                            <div className="pt-2.5 border-t mt-2.5 space-y-2" style={{ borderColor: 'var(--border)' }}>
                              <div className="flex items-center justify-between px-0.5">
                                <span className="text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 font-mono" style={{ color: 'var(--warm)' }}>
                                  <Moon className="w-3 h-3 text-amber-400 inline shrink-0" /> Overnight Stay ({selectedHotelsForDay.length})
                                </span>
                              </div>

                              {selectedHotelsForDay.map((hotel) => (
                                <div
                                  key={`stay-${hotel.id}`}
                                  className="p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all"
                                  style={{
                                    background: 'var(--surface)',
                                    borderColor: 'var(--warm)',
                                    boxShadow: '0 2px 10px rgba(245, 158, 11, 0.08)'
                                  }}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 font-bold text-xs" style={{ background: 'var(--warm)', color: '#0a0c10' }}>
                                      <CategoryIcon iconType="hotel" size={14} className="text-stone-900" />
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-bold text-[11px] truncate" style={{ color: 'var(--text)' }}>
                                        Stay at {hotel.name}
                                      </h4>
                                      <div className="flex items-center gap-2 text-[9px] font-mono" style={{ color: 'var(--muted)' }}>
                                        <span style={{ color: 'var(--warm)' }} className="flex items-center gap-0.5"><Star size={9} className="fill-amber-400 text-amber-400 inline" /> {hotel.rating}</span>
                                        <span>·</span>
                                        <span>{currencySymbol}{hotel.pricePerNight.toLocaleString()} / night</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <a
                                      href={buildSinglePlaceGoogleMapsUrl(hotel, state.trip?.title)}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1 rounded text-muted hover:text-amber-400 hover:bg-white/[0.05] transition-all cursor-pointer"
                                      title={`Open ${hotel.name} in Google Maps`}
                                    >
                                      <svg className="w-3.5 h-3.5 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                      </svg>
                                    </a>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSelectHomestay(hotel.id, day.id);
                                      }}
                                      className="p-1 rounded text-muted hover:text-rose-400 hover:bg-white/[0.05] transition-all cursor-pointer"
                                      title="Remove lodging reservation"
                                    >
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}

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
                          <span className="font-semibold text-white/70" style={{ color: 'var(--text)' }}>{currencySymbol}{dayCost.toLocaleString()}</span>
                        </div>

                        {/* Add / Re-optimize Actions */}
                        <div className="pt-2 flex gap-1.5">
                          <button
                            onClick={() => handleOpenAddStopModal(day.id)}
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
                    Lodging Matches {expandedDayId && state.trip?.days ? `(Day ${state.trip.days.find(d => d.id === expandedDayId)?.dayNumber || ''})` : ''}
                  </h3>
                  <p className="text-[9px] mt-0.5 ml-7" style={{ color: 'var(--muted)' }}>Ranked by route fit, price & ratings</p>
                </div>

                <div className="space-y-2 stagger-children">
                  {visibleHomestays.length > 0 ? (
                    visibleHomestays.map((home) => {
                      const activeDayId = expandedDayId;
                      const daySelectedIds = activeDayId ? (state.selectedHomestaysByDay?.[activeDayId] || []) : [];
                      const isSelected = Boolean(activeDayId && daySelectedIds.includes(home.id));
                      const activeDayNum = activeDayId ? state.trip?.days?.find(d => d.id === activeDayId)?.dayNumber : null;
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
                              <CategoryIcon iconType="hotel" size={12} className="text-accent" />
                              {home.name}
                            </h4>
                            <div className="flex items-center gap-1 text-[9px] font-mono" style={{ color: 'var(--warm)' }}>
                              <Star size={9} className="fill-amber-400 text-amber-400 inline" />
                              <span>{home.rating}</span>
                              <span style={{ color: 'var(--muted)' }}>({home.reviewCount})</span>
                            </div>
                          </div>

                          <p className="text-[9px] font-medium mt-1.5 font-mono flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            {home.avgCommuteMinutes} min avg to {activeDayNum ? `Day ${activeDayNum}` : 'itinerary'} stops
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
                                {currencySymbol}{home.pricePerNight.toLocaleString()}
                              </span>
                              <span className="text-[8px]" style={{ color: 'var(--muted)' }}> / night</span>
                            </div>
                            <button
                              onClick={() => handleSelectHomestay(home.id, activeDayId)}
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
                        No lodging matches found.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Stop Modal */}
      {addStopModalDayId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div
            className="w-full max-w-md p-6 rounded-2xl border shadow-2xl space-y-4 text-left scale-in"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="flex justify-between items-center pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <h3 className="font-bold text-sm flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <span className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                  <MapPin className="w-3.5 h-3.5" />
                </span>
                Add Stop to Day {state.trip?.days?.find(d => d.id === addStopModalDayId)?.dayNumber || ''}
              </h3>
              <button
                onClick={() => setAddStopModalDayId(null)}
                className="text-muted hover:text-text text-base font-bold leading-none cursor-pointer px-2 py-1 rounded hover:bg-white/[0.05]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAddStop} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Stop / Location Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Palace Museum, Cafe Central"
                  value={newStopName}
                  onChange={(e) => setNewStopName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs font-medium outline-none focus:border-accent"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Estimated Cost ({currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0 for free"
                    value={newStopCost}
                    onChange={(e) => setNewStopCost(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-accent"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Time Slot</label>
                  <input
                    type="text"
                    placeholder="10:00 AM - 12:00 PM"
                    value={newStopTime}
                    onChange={(e) => setNewStopTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border text-xs font-mono outline-none focus:border-accent"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold mb-1" style={{ color: 'var(--muted)' }}>Notes / Rationale</label>
                <input
                  type="text"
                  placeholder="Why you're adding this spot..."
                  value={newStopRationale}
                  onChange={(e) => setNewStopRationale(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-accent"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                />
              </div>

              {/* Live Budget Exceeded Warning Box */}
              {(() => {
                const addedCost = Number(newStopCost) || 0;
                const projTotal = totalSpend + addedCost;
                const isProjExceeded = projTotal > budgetLimit;
                const projExceededAmt = projTotal - budgetLimit;

                if (isProjExceeded) {
                  return (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 inline mt-0.5" />
                      <div className="space-y-0.5">
                        <strong className="block font-bold text-rose-400">Budget Exceeded Warning</strong>
                        <p className="text-[11px] leading-relaxed text-rose-300/90">
                          Adding this stop ({currencySymbol}{addedCost.toLocaleString()}) will push total trip expenses to <span className="font-mono font-bold">{currencySymbol}{projTotal.toLocaleString()}</span>, exceeding your budget by <span className="font-mono font-extrabold text-rose-300 underline">{currencySymbol}{projExceededAmt.toLocaleString()}</span>!
                        </p>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddStopModalDayId(null)}
                  className="flex-1 py-2 rounded-xl border text-xs font-semibold hover:bg-white/[0.05] transition-colors cursor-pointer"
                  style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-all transform active:scale-95 shadow-md cursor-pointer"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}
                >
                  Add Stop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
