import { geocodeLocation, lookupKnownLandmark, haversineKm } from './geocoder.js';

function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+(in|at|near|of)\s+.*$/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function guessCategory(name, type = '') {
  const n = (name + ' ' + type).toLowerCase();
  if (/museum|gallery|exhibit|louvre|rijksmuseum|prado|uffizi/i.test(n)) return 'museum';
  if (/park|garden|botanical|jardin|parc|bosco/i.test(n)) return 'park';
  if (/temple|shrine|church|cathedral|basilica|duomo|notre.dame|mosque|abbey/i.test(n)) return 'place_of_worship';
  if (/castle|palace|fort|château|schloss|palazzo/i.test(n)) return 'castle';
  if (/market|bazaar|souk|marché|mercato/i.test(n)) return 'marketplace';
  if (/restaurant|cafe|bistro|bakery|food|eatery/i.test(n)) return 'restaurant';
  if (/tower|viewpoint|observation|eye|bridge|monument|memorial|statue|square|piazza|plaza/i.test(n)) return 'viewpoint';
  return 'attraction';
}

/**
 * Geocode a user-specified place in the context of the destination city.
 */
export async function geocodeRealStop(placeName, destination, centerLat = null, centerLng = null) {
  if (!placeName || typeof placeName !== 'string') return null;

  const geocoded = await geocodeLocation(placeName, destination, centerLat, centerLng);
  if (geocoded && typeof geocoded.lat === 'number' && typeof geocoded.lng === 'number') {
    const cleanName = placeName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    const category = guessCategory(placeName, geocoded.label || '');

    return {
      name: cleanName,
      lat: geocoded.lat,
      lng: geocoded.lng,
      category,
      costEstimate: category === 'museum' ? 15 : (category === 'restaurant' ? 30 : 0),
      rationale: `Explore ${cleanName}, a verified point of interest in ${destination || 'your destination'}.`
    };
  }

  // Fallback if geocoding returns no coords
  return {
    name: placeName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '),
    lat: centerLat || 0,
    lng: centerLng || 0,
    category: guessCategory(placeName),
    costEstimate: 10,
    rationale: `Explore ${placeName} in ${destination || 'your destination'}.`
  };
}

/**
 * Fetch real, verified POIs/attractions for a city from Nominatim & Wikipedia.
 * Ensures zero duplicates against existingStops.
 */
export async function fetchRealAttractionsForCity(cityName, existingStops = [], count = 4, centerLat = null, centerLng = null) {
  const existingNames = new Set(
    existingStops.map(s => normalizeName(s.name || s))
  );

  const discoveredPlaces = [];
  const seenDiscovered = new Set();

  const queries = [
    `attraction in ${cityName}`,
    `museum in ${cityName}`,
    `landmark in ${cityName}`,
    `park in ${cityName}`
  ];

  for (const q of queries) {
    if (discoveredPlaces.length >= count * 2) break;

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=12`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
        },
        signal: AbortSignal.timeout(4000)
      });

      if (res.ok) {
        const items = await res.json();
        for (const item of items) {
          const rawName = item.display_name.split(',')[0].trim();
          const norm = normalizeName(rawName);

          if (!rawName || rawName.length < 3 || /administrative|district|region|province|county|city/i.test(item.type || '')) {
            continue;
          }

          if (existingNames.has(norm) || seenDiscovered.has(norm)) {
            continue;
          }

          seenDiscovered.add(norm);
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);

          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;

          discoveredPlaces.push({
            name: rawName,
            lat,
            lng,
            category: guessCategory(rawName, item.type || ''),
            costEstimate: item.type === 'museum' ? 15 : 0,
            rationale: `Visit ${rawName}, one of the top-rated attractions in ${cityName}.`
          });
        }
      }
    } catch (err) {
      console.warn(`[RealPlacesScout] Nominatim search failed for "${q}":`, err.message);
    }
  }

  // If we still need more places, query Wikipedia
  if (discoveredPlaces.length < count) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(cityName + ' tourist attractions landmarks')}&format=json&srlimit=10`;
      const wRes = await fetch(wikiUrl, {
        headers: { 'User-Agent': 'WanderloopTravelPlanner/1.0' },
        signal: AbortSignal.timeout(3000)
      });

      if (wRes.ok) {
        const wData = await wRes.json();
        const searchResults = wData.query?.search || [];

        for (const sr of searchResults) {
          if (discoveredPlaces.length >= count) break;
          const cleanTitle = sr.title.replace(/\s*\(.*?\)/g, '').trim();
          const norm = normalizeName(cleanTitle);

          if (!cleanTitle || cleanTitle.length < 3 || /history of|geography of|demographics of|culture of/i.test(cleanTitle)) {
            continue;
          }

          if (existingNames.has(norm) || seenDiscovered.has(norm)) {
            continue;
          }

          // Geocode this landmark
          const geo = await geocodeLocation(cleanTitle, cityName, centerLat, centerLng);
          if (geo && geo.lat && geo.lng) {
            seenDiscovered.add(norm);
            discoveredPlaces.push({
              name: cleanTitle,
              lat: geo.lat,
              lng: geo.lng,
              category: guessCategory(cleanTitle),
              costEstimate: 10,
              rationale: `Explore ${cleanTitle}, a celebrated landmark in ${cityName}.`
            });
          }
        }
      }
    } catch (wErr) {
      console.warn(`[RealPlacesScout] Wikipedia search failed for "${cityName}":`, wErr.message);
    }
  }

  return discoveredPlaces.slice(0, count);
}
