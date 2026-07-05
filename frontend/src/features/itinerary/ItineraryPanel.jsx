import { useState } from 'react';
import { useTrip } from '../../context/TripContext';
import { getDayColorBorderClass, getDayColorBgClass, getDayColorHex } from '../../utils/colors';

/* ─── Skeleton Shimmer for Generating State ─── */
function SkeletonDay({ idx }) {
  return (
    <div
      className="border border-white/[0.04] rounded-2xl bg-[rgba(22,29,27,0.4)] overflow-hidden"
      style={{ animationDelay: `${idx * 120}ms` }}
    >
      <div className="p-4 flex items-center gap-3">
        <div className="w-1.5 h-6 rounded-full shimmer"></div>
        <div className="space-y-1.5 flex-1">
          <div className="h-3 w-16 shimmer rounded"></div>
          <div className="h-2 w-24 shimmer rounded"></div>
        </div>
        <div className="h-3 w-12 shimmer rounded"></div>
      </div>
      <div className="px-4 pb-4 border-t border-white/[0.04] pt-3 space-y-2.5">
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
  const [expandedDayId, setExpandedDayId] = useState('day-1');
  const [activeRationaleId, setActiveRationaleId] = useState(null);

  const toggleDay = (dayId) => {
    setExpandedDayId(expandedDayId === dayId ? null : dayId);
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
  };

  const handleHoverHomestay = (homestayId) => {
    dispatch({ type: 'HOVER_HOMESTAY', payload: homestayId });
  };

  const handleStopHover = (stopId) => {
    dispatch({ type: 'HOVER_STOP', payload: stopId });
  };

  const handleStopClick = (stopId) => {
    dispatch({ type: 'SELECT_STOP', payload: state.activeStopId === stopId ? null : stopId });
  };

  const numDays = state.trip.days.length;

  return (
    <div className="flex flex-col h-full bg-[rgba(22,29,27,0.4)] border-l border-white/[0.06] w-full md:w-[360px] shrink-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between bg-[rgba(22,29,27,0.3)]">
        <h2 className="font-bold text-xs flex items-center gap-2 text-white tracking-wide">
          <div className="w-6 h-6 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          Itinerary
        </h2>
        <span className="text-[9px] text-muted font-mono bg-white/[0.04] border border-white/[0.05] px-2 py-0.5 rounded-md">
          {state.trip.days.reduce((acc, d) => acc + d.stops.length, 0)} Stops · {numDays}D
        </span>
      </div>

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
                const borderCol = getDayColorBorderClass(day.colorHue);
                const bgCol = getDayColorBgClass(day.colorHue);
                const colorHex = getDayColorHex(day.colorHue);

                const dayCost = day.stops.reduce((sum, s) => sum + s.costEstimate, 0);
                const estCommute = day.stops.length * 25;

                return (
                  <div
                    key={day.id}
                    className={`border rounded-2xl bg-[rgba(22,29,27,0.5)] overflow-hidden transition-all-300 ${
                      isExpanded ? `border-white/[0.08] shadow-lg` : 'border-white/[0.04] hover:bg-[rgba(22,29,27,0.7)]'
                    }`}
                    style={isExpanded ? { borderColor: `${colorHex}20` } : {}}
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
                          <h3 className="font-bold text-xs text-white flex items-center gap-1.5">
                            Day {day.dayNumber}
                            <span className="text-[9px] font-normal text-muted">
                              · {day.stops.length} locations
                            </span>
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[10px] text-muted">
                          ¥{dayCost.toLocaleString()}
                        </span>
                        <svg
                          className={`w-3.5 h-3.5 text-muted transition-transform duration-300 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Day Stops (Expanded Content) */}
                    {isExpanded && (
                      <div className="px-3.5 pb-3.5 border-t border-white/[0.04] pt-2 space-y-1.5 slide-up">
                        {day.stops.length === 0 ? (
                          <p className="text-[10px] text-muted py-3 text-center">No stops added yet</p>
                        ) : (
                          day.stops.map((stop) => {
                            const isHovered = state.hoveredStopId === stop.id;
                            const isActive = state.activeStopId === stop.id;

                            return (
                              <div key={stop.id} className="space-y-1">
                                <div
                                  onClick={() => handleStopClick(stop.id)}
                                  onMouseEnter={() => handleStopHover(stop.id)}
                                  onMouseLeave={() => handleStopHover(null)}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all-300 group/stop cursor-pointer ${
                                    isActive
                                      ? 'bg-accent/5 border-accent/20 shadow-sm'
                                      : isHovered
                                      ? 'bg-white/[0.04] border-white/[0.06]'
                                      : 'bg-white/[0.01] border-white/[0.03] hover:bg-white/[0.03]'
                                  }`}
                                >
                                  <div className="flex items-start gap-2 min-w-0">
                                    {/* Drag handle */}
                                    <div className="flex flex-col gap-[2px] mt-1 opacity-0 group-hover/stop:opacity-40 transition-opacity cursor-grab shrink-0">
                                      <div className="flex gap-[2px]">
                                        <span className="w-1 h-1 rounded-full bg-muted"></span>
                                        <span className="w-1 h-1 rounded-full bg-muted"></span>
                                      </div>
                                      <div className="flex gap-[2px]">
                                        <span className="w-1 h-1 rounded-full bg-muted"></span>
                                        <span className="w-1 h-1 rounded-full bg-muted"></span>
                                      </div>
                                      <div className="flex gap-[2px]">
                                        <span className="w-1 h-1 rounded-full bg-muted"></span>
                                        <span className="w-1 h-1 rounded-full bg-muted"></span>
                                      </div>
                                    </div>

                                    {/* Index bubble */}
                                    <span
                                      className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center font-mono text-[8px] font-bold text-bg"
                                      style={{ backgroundColor: colorHex }}
                                    >
                                      {stop.order}
                                    </span>
                                    <div className="min-w-0">
                                      <h4 className="font-semibold text-white truncate text-[11px]">{stop.name}</h4>
                                      <span className="text-[9px] text-muted font-mono">{stop.timeEstimate}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono text-[9px] text-muted">
                                      {stop.costEstimate === 0 ? 'Free' : `¥${stop.costEstimate.toLocaleString()}`}
                                    </span>
                                    <button
                                      onClick={(e) => handleDeleteStop(day.id, stop.id, e)}
                                      className="p-0.5 rounded text-muted hover:text-rose-400 hover:bg-white/[0.05] opacity-0 group-hover/stop:opacity-100 transition-all cursor-pointer"
                                      title="Remove stop"
                                    >
                                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  </div>
                                </div>

                                {/* Rationale Popover */}
                                {isActive && (
                                  <div className="mx-1 p-2.5 rounded-lg bg-accent/5 border border-accent/10 text-[10px] text-accent/80 leading-relaxed scale-in">
                                    <span className="font-bold uppercase tracking-wider text-[7px] text-accent block mb-1">
                                      AI Rationale · Why this?
                                    </span>
                                    {stop.rationale}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}

                        {/* Card Footer Totals */}
                        <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between font-mono text-[9px] text-muted mt-1">
                          <span className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            ~{estCommute} min transit
                          </span>
                          <span className="font-semibold text-white/70">¥{dayCost.toLocaleString()}</span>
                        </div>

                        {/* Add / Re-optimize Actions */}
                        <div className="pt-2 flex gap-1.5">
                          <button className="flex-1 py-1.5 rounded-lg border border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.05] text-[9px] text-muted hover:text-white font-semibold transition-all cursor-pointer">
                            + Add Stop
                          </button>
                          <button className="flex-1 py-1.5 rounded-lg border border-accent/10 bg-accent/5 hover:bg-accent/10 text-[9px] text-accent font-semibold transition-all cursor-pointer">
                            Re-optimize
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
              <div className="space-y-3 pt-3 border-t border-white/[0.06]">
                <div>
                  <h3 className="font-bold text-xs text-white flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <svg className="w-3 h-3 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    Lodging Matches
                  </h3>
                  <p className="text-[9px] text-muted mt-0.5 ml-7">Ranked by route fit, price & ratings</p>
                </div>

                <div className="space-y-2 stagger-children">
                  {state.homestays.map((home) => {
                    const isSelected = state.selectedHomestayId === home.id;
                    return (
                      <div
                        key={home.id}
                        onMouseEnter={() => handleHoverHomestay(home.id)}
                        onMouseLeave={() => handleHoverHomestay(null)}
                        className={`p-3.5 rounded-2xl border transition-all-300 cursor-pointer ${
                          isSelected
                            ? 'bg-accent/5 border-accent/20 shadow-lg shadow-accent/5'
                            : 'bg-[rgba(22,29,27,0.4)] border-white/[0.04] hover:bg-[rgba(22,29,27,0.6)] hover:border-white/[0.08]'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-[11px] text-white flex items-center gap-1.5">
                            <span className="text-sm opacity-70">⌂</span>
                            {home.name}
                          </h4>
                          <div className="flex items-center gap-1 text-[9px] font-mono text-amber-400">
                            <span>★</span>
                            <span>{home.rating}</span>
                            <span className="text-muted">({home.reviewCount})</span>
                          </div>
                        </div>

                        <p className="text-[9px] text-accent font-medium mt-1.5 font-mono flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          {home.avgCommuteMinutes} min avg to Day 1–{numDays} stops
                        </p>

                        <div className="flex flex-wrap gap-1 mt-2">
                          {home.amenities.map((amenity, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/[0.04] text-[8px] text-muted font-mono"
                            >
                              {amenity}
                            </span>
                          ))}
                        </div>

                        <div className="h-[1px] bg-white/[0.04] my-2.5"></div>

                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-mono text-xs font-bold text-white">
                              ¥{home.pricePerNight.toLocaleString()}
                            </span>
                            <span className="text-[8px] text-muted"> / night</span>
                          </div>
                          <button
                            onClick={() => handleSelectHomestay(home.id)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all transform active:scale-95 cursor-pointer ${
                              isSelected
                                ? 'bg-accent text-bg hover:bg-accent/80'
                                : 'bg-white/[0.04] text-white hover:bg-white/[0.08] border border-white/[0.06]'
                            }`}
                          >
                            {isSelected ? '✓ Selected' : 'Choose'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
