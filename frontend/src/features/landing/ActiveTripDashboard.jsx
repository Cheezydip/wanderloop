import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Pencil,
  Copy,
  FolderArchive,
  Trash2,
  RefreshCw,
  ArrowLeftRight,
  Coins,
  MapPin,
  Check,
} from 'lucide-react';

const EXCHANGE_RATES = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  JPY: 155.4,
  INR: 83.95,
  YER: 250.25,
  AUD: 1.52,
  CNY: 7.23,
};

const CITY_PRESETS = [
  { name: 'Beijing', kanji: '北京', startAug: 11, endAug: 19, daysLeft: 8, buddies: 'DU', travelers: '1 TRAVELER', places: 4 },
  { name: 'Tokyo', kanji: '東京', startAug: 24, endAug: 2, daysLeft: 14, buddies: 'AK', travelers: '2 TRAVELERS', places: 6 },
  { name: 'Paris', kanji: 'PARIS', startAug: 5, endAug: 12, daysLeft: 22, buddies: 'DU', travelers: '1 TRAVELER', places: 5 },
];

export default function ActiveTripDashboard({ onTripClick }) {
  const { user, removeFromWishlist } = useAuth();
  const [selectedCityIdx, setSelectedCityIdx] = useState(0);
  const [toastMessage, setToastMessage] = useState('');

  // Currency Converter State
  const [fromAmount, setFromAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('CAD');
  const [isRefreshingRate, setIsRefreshingRate] = useState(false);

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const calculateConversion = () => {
    const num = parseFloat(fromAmount);
    if (isNaN(num) || num <= 0) return '-';
    const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
    const toRate = EXCHANGE_RATES[toCurrency] || 1;
    const converted = (num / fromRate) * toRate;
    return converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSwapCurrencies = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  const handleRefreshRate = () => {
    setIsRefreshingRate(true);
    setTimeout(() => {
      setIsRefreshingRate(false);
      triggerToast('Exchange rates updated');
    }, 600);
  };

  // 1. Fetch saved trips from cloud
  const [savedTrips, setSavedTrips] = useState([]);

  useEffect(() => {
    if (user) {
      fetch('/api/trips')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) setSavedTrips(data);
        })
        .catch(err => console.error('Failed to load saved trips for dashboard:', err));
    } else {
      setSavedTrips([]);
    }
  }, [user]);

  // 2. Combine wishlist + saved trips
  const combinedList = [];
  if (user && user.wishlist) {
    user.wishlist.forEach(w => combinedList.push({ ...w, isWishlist: true }));
  }
  savedTrips.forEach(t => {
    combinedList.push({
      name: t.title || 'Saved Trip',
      isSavedTrip: true,
      tripId: t.tripId || t._id,
      originalData: t
    });
  });

  // 3. Determine active list (combined or fallback presets)
  const hasUserList = combinedList.length > 0;
  const rawList = hasUserList ? combinedList : CITY_PRESETS;

  // 4. Ensure index is valid
  const safeIdx = selectedCityIdx >= rawList.length ? 0 : selectedCityIdx;
  const selectedRawItem = rawList[safeIdx];

  // 3. Helper to generate full preset structure for sparse wishlist items
  const getDisplayData = (item) => {
    if (!hasUserList) return item; // Already full preset

    const nameStr = item.name || 'Unknown';
    let sum = 0;
    for (let i = 0; i < nameStr.length; i++) sum += nameStr.charCodeAt(i);

    // Deterministic mock data
    const kanji = nameStr.substring(0, 2).toUpperCase();
    const startAug = (sum % 20) + 1;
    const endAug = startAug + (sum % 10) + 2;
    const daysLeft = (sum % 15) + 1;
    const buddies = (nameStr.charAt(0) + nameStr.charAt(nameStr.length - 1)).toUpperCase();
    const numTravelers = (sum % 4) + 1;
    const travelers = numTravelers + ' TRAVELER' + (numTravelers > 1 ? 'S' : '');
    const places = (sum % 8) + 2;

    return {
      ...item,
      name: nameStr,
      kanji,
      startAug,
      endAug,
      daysLeft,
      buddies,
      travelers,
      places
    };
  };

  const currentPreset = getDisplayData(selectedRawItem);

  const [fetchedImages, setFetchedImages] = useState({});

  useEffect(() => {
    if (!currentPreset) return;
    if (currentPreset.img || fetchedImages[currentPreset.name]) return;

    const fetchImage = async () => {
      try {
        // Clean up the name for better search results (e.g., "Trip to Tokyo" -> "Tokyo", "Kyoto, Japan" -> "Kyoto")
        let searchTerm = currentPreset.name.split(',')[0].trim();
        searchTerm = searchTerm.replace(/^(Trip to|Vacation in|Journey to|Visit to|Weekend in|Days in)\s+/i, '').trim();

        // Use 'titles' instead of 'generator=search' to avoid pulling random images for vague names
        const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(searchTerm)}&prop=pageimages&format=json&pithumbsize=800&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = data.query?.pages;
        if (pages) {
          const pageId = Object.keys(pages)[0];
          if (pages[pageId].thumbnail?.source) {
            setFetchedImages(prev => ({ ...prev, [currentPreset.name]: pages[pageId].thumbnail.source }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch dashboard image:', err);
      }
    };
    fetchImage();
  }, [currentPreset?.name]);

  const bgImg = currentPreset?.img || fetchedImages[currentPreset?.name];

  return (
    <>
      {/* Dashboard Grid — no wrapping section, embeds directly in hero */}
      <div className="atd-grid">

        {/* LEFT: Active Trip Card */}
        <div
          className="atd-trip-card"
          onClick={() => onTripClick && onTripClick(currentPreset)}
          style={{ cursor: onTripClick ? 'pointer' : 'default', position: 'relative' }}
        >

          {bgImg && (
            <>
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${bgImg})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  filter: 'blur(1px)',
                  transform: 'scale(1.1)' // Prevent blurred edges from leaking
                }}
              />
              <div className="absolute inset-0 bg-black/30 z-0" />
            </>
          )}

          {/* Ambient glow */}
          <div className="atd-trip-glow z-0" />

          {/* Top Bar */}
          <div className="atd-trip-topbar relative z-10" onClick={e => e.stopPropagation()}>
            <div className="atd-live-badge">
              <span className="atd-live-dot" />
              LIVE NOW
            </div>
            <div className="atd-actions">
              <button onClick={() => {
                navigator.clipboard.writeText(currentPreset.name);
                triggerToast('Destination copied');
              }} className="atd-action-btn" title="Copy destination">
                <Copy size={15} />
              </button>
              <button onClick={() => triggerToast('Trip archived')} className="atd-action-btn" title="Archive trip">
                <FolderArchive size={15} />
              </button>
              <button
                onClick={() => {
                  const next = (safeIdx + 1) % rawList.length;
                  setSelectedCityIdx(next);
                  triggerToast(`Switched to ${rawList[next].name}`);
                }}
                className="atd-action-btn"
                title="Next trip"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={async () => {
                  if (hasUserList) {
                    if (selectedRawItem.isSavedTrip) {
                      try {
                        const res = await fetch(`/api/trips/${selectedRawItem.tripId}`, { method: 'DELETE' });
                        if (res.ok) {
                          setSavedTrips(prev => prev.filter(t => t.tripId !== selectedRawItem.tripId && t._id !== selectedRawItem.tripId));
                          triggerToast('Deleted saved trip');
                          if (safeIdx >= combinedList.length - 1) setSelectedCityIdx(0);
                        } else {
                          triggerToast('Failed to delete saved trip');
                        }
                      } catch (e) {
                        triggerToast('Error removing item');
                      }
                    } else if (selectedRawItem.isWishlist) {
                      try {
                        await removeFromWishlist(selectedRawItem.name);
                        triggerToast('Removed from wishlist');
                        if (safeIdx >= combinedList.length - 1) setSelectedCityIdx(0);
                      } catch (e) {
                        triggerToast('Error removing item');
                      }
                    }
                  } else {
                    triggerToast('Demo trip deleted');
                  }
                }}
                className="atd-action-btn atd-action-btn--danger"
                title={hasUserList ? "Delete item" : "Delete demo trip"}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>

          {/* City Watermark */}
          <div className="atd-city-watermark relative z-10">
            <h2 className="atd-city-kanji">{currentPreset.kanji}</h2>
            <div className="atd-city-name">{currentPreset.name} • Active Itinerary</div>
          </div>

          {/* Bottom Stats Pill */}
          <div className="atd-stats-pill relative z-10">
            <div className="atd-stats-grid">
              <div className="atd-stat">
                <span className="atd-stat-label">BUDDIES</span>
                <div className="atd-stat-avatar">{currentPreset.buddies}</div>
                <span className="atd-stat-value">{currentPreset.travelers}</span>
              </div>
              <div className="atd-stat">
                <span className="atd-stat-label">TRIP DATES</span>
                <div className="atd-stat-dates">
                  <span>{currentPreset.startAug}</span>
                  <span className="atd-stat-arrow">→</span>
                  <span>{currentPreset.endAug}</span>
                </div>
                <span className="atd-stat-value">AUG • AUG</span>
              </div>
              <div className="atd-stat">
                <span className="atd-stat-label">ONGOING</span>
                <div className="atd-stat-countdown">{currentPreset.daysLeft}</div>
                <span className="atd-stat-value">DAYS LEFT</span>
              </div>
              <div className="atd-stat">
                <span className="atd-stat-label">PLACES</span>
                <div className="atd-stat-icon-wrap">
                  <MapPin size={15} />
                </div>
                <span className="atd-stat-value">{currentPreset.places} DESTINATIONS</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Currency Converter */}
        <div className="atd-currency-card">
          {/* Header */}
          <div className="atd-currency-header">
            <div className="atd-currency-title">
              <Coins size={15} />
              <span>CURRENCY</span>
            </div>
            <button onClick={handleRefreshRate} className="atd-refresh-btn" title="Refresh rates">
              <RefreshCw size={14} className={isRefreshingRate ? 'atd-spin' : ''} />
            </button>
          </div>

          {/* Conversion Block */}
          <div className="atd-conversion">
            {/* FROM */}
            <div className="atd-conv-box atd-conv-box--from">
              <span className="atd-conv-label">FROM</span>
              <input
                type="number"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                className="atd-conv-input"
                placeholder="0"
              />
              <select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)} className="atd-conv-select">
                {Object.keys(EXCHANGE_RATES).map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>

            {/* SWAP */}
            <button onClick={handleSwapCurrencies} className="atd-swap-btn" title="Swap currencies">
              <ArrowLeftRight size={14} />
            </button>

            {/* TO */}
            <div className="atd-conv-box">
              <span className="atd-conv-label">TO</span>
              <div className="atd-conv-result">{calculateConversion()}</div>
              <select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)} className="atd-conv-select">
                {Object.keys(EXCHANGE_RATES).map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Rate Footer */}
          <div className="atd-rate-footer">
            1 {fromCurrency} = {((EXCHANGE_RATES[toCurrency] || 1) / (EXCHANGE_RATES[fromCurrency] || 1)).toFixed(4)} {toCurrency}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toastMessage && (
        <div className="atd-toast">
          <Check size={14} />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );
}
