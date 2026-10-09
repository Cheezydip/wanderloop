import { geocodeCache } from './cache.js';

export function haversineKm(lat1, lon1, lat2, lon2) {
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' || typeof lat2 !== 'number' || typeof lon2 !== 'number') return Infinity;
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function cleanQueryForGeocoding(name) {
  if (!name) return '';
  let query = name;
  
  // Strip transit and activity action prefixes
  query = query.replace(/^(shinkansen to|bullet train to|train to|bus to|flight to|transfer to|overnight in|stay in|stay at|visit|explore|tour)\s+/i, '');
  
  // Split by common delimiters and take the first part
  query = query.split(/&| and | with | at |-|–|,/i)[0].trim();
  // Remove common fluff words at the end
  query = query.replace(/\b(sightseeing|tour|visit|explore|view|sunset view|sunrise view|shopping|lunch|dinner|breakfast|cafe|restaurant|hotel|stay|resort|hills|mountains|market|local market)\b/gi, '').trim();
  // If the query becomes too empty, fall back to the original name
  return query.length >= 2 ? query : name;
}

export function lookupKnownLandmark(queryStr, centerLat = null, centerLng = null) {
  if (!queryStr) return null;
  const q = queryStr.toLowerCase().trim();
  let match = null;

  // ─── Shinjuku Landmarks ───
  if (q.includes('shinjuku gyoen') || q.includes('gyoen')) match = { lat: 35.6852, lng: 139.7101 };
  else if (q.includes('golden gai')) match = { lat: 35.6942, lng: 139.7046 };
  else if (q.includes('omoide yokocho') || q.includes('memory lane')) match = { lat: 35.6928, lng: 139.6994 };
  else if (q.includes('kabukicho') || q.includes('kabuki-cho')) match = { lat: 35.6938, lng: 139.7034 };
  else if (q.includes('tocho') || q.includes('tokyo metropolitan government')) match = { lat: 35.6896, lng: 139.6917 };
  else if (q.includes('godzilla head') || q.includes('hotel gracery shinjuku')) match = { lat: 35.6953, lng: 139.7020 };
  else if (q.includes('hanazono-jinja')) match = { lat: 35.6931, lng: 139.7061 };
  else if (q.includes('shinjuku central park')) match = { lat: 35.6898, lng: 139.6878 };
  else if (q.includes('samurai museum')) match = { lat: 35.6955, lng: 139.7029 };
  else if (q.includes('shin-okubo korea town')) match = { lat: 35.7013, lng: 139.7000 };
  else if (q.includes('shinjuku takashimaya times square')) match = { lat: 35.6872, lng: 139.7018 };
  else if (q.includes('shinjuku station')) match = { lat: 35.6895, lng: 139.6917 };

  // ─── Shibuya & Harajuku Landmarks ───
  else if (q.includes('shibuya crossing') || q.includes('hachiko') || q.includes('shibuya sky') || q.includes('shibuya')) match = { lat: 35.6596, lng: 139.7006 };
  else if (q.includes('harajuku') || q.includes('takeshita') || q.includes('omotesando')) match = { lat: 35.6715, lng: 139.7030 };
  else if (q.includes('meiji shrine') || q.includes('meiji jingu') || q.includes('yoyogi')) match = { lat: 35.6764, lng: 139.6997 };

  // ─── Asakusa & Eastern Tokyo Landmarks ───
  else if (q.includes('senso-ji') || q.includes('sensoji') || q.includes('nakamise') || q.includes('asakusa')) match = { lat: 35.7148, lng: 139.7967 };
  else if (q.includes('skytree') || q.includes('solamachi')) match = { lat: 35.7101, lng: 139.8107 };
  else if (q.includes('ueno park') || q.includes('ueno zoo') || q.includes('ueno')) match = { lat: 35.7141, lng: 139.7741 };
  else if (q.includes('akihabara') || q.includes('electric town')) match = { lat: 35.6997, lng: 139.7714 };

  // ─── Ginza & Central Tokyo Landmarks ───
  else if (q.includes('tsukiji') || q.includes('outer market')) match = { lat: 35.6655, lng: 139.7712 };
  else if (q.includes('teamlab') || q.includes('toyosu')) match = { lat: 35.6489, lng: 139.7912 };
  else if (q.includes('ginza') || q.includes('kabukiza')) match = { lat: 35.6718, lng: 139.7650 };
  else if (q.includes('imperial palace') || q.includes('chiyoda')) match = { lat: 35.6852, lng: 139.7528 };
  else if (q.includes('tokyo tower') || q.includes('zojo-ji') || q.includes('roppongi')) match = { lat: 35.6586, lng: 139.7454 };
  else if (q.includes('odaiba') || q.includes('rainbow bridge')) match = { lat: 35.6293, lng: 139.7766 };

  // ─── Kyoto Landmarks ───
  else if (q.includes('kinkaku') || q.includes('golden pavilion')) match = { lat: 35.0394, lng: 135.7292 };
  else if (q.includes('ginkaku') || q.includes('silver pavilion')) match = { lat: 35.0272, lng: 135.7982 };
  else if (q.includes('fushimi inari') || q.includes('torii')) match = { lat: 34.9671, lng: 135.7727 };
  else if (q.includes('kiyomizu') || q.includes('kiyomizudera')) match = { lat: 34.9949, lng: 135.7850 };
  else if (q.includes('arashiyama') || q.includes('bamboo')) match = { lat: 35.0156, lng: 135.6715 };
  else if (q.includes('gion') || q.includes('yasaka') || q.includes('hanamikoji')) match = { lat: 35.0037, lng: 135.7785 };
  else if (q.includes('nijo castle') || q.includes('nijojo')) match = { lat: 35.0142, lng: 135.7482 };
  else if (q.includes('nishiki') || q.includes('nishiki market')) match = { lat: 35.0050, lng: 135.7649 };
  else if (q.includes('kyoto station') || q.includes('kyoto tower')) match = { lat: 34.9858, lng: 135.7588 };
  else if (q.includes('ryoan-ji') || q.includes('ryoanji')) match = { lat: 35.0344, lng: 135.7182 };

  // ─── Scotland & UK Landmarks ───
  else if (q.includes('national museum') || q.includes('museum of scotland')) match = { lat: 55.9469, lng: -3.1906 };
  else if (q.includes('fish road') || q.includes('fish market') || q.includes('fishmarket') || q.includes('heritage cafe')) match = { lat: 55.9496, lng: -3.1891 };
  else if (q.includes('edinburgh castle')) match = { lat: 55.9486, lng: -3.1999 };
  else if (q.includes('royal mile')) match = { lat: 55.9505, lng: -3.1855 };
  else if (q.includes('holyrood') || q.includes('palace of holyroodhouse')) match = { lat: 55.9527, lng: -3.1723 };
  else if (q.includes("arthur's seat") || q.includes('arthurs seat')) match = { lat: 55.9442, lng: -3.1619 };
  else if (q.includes('calton hill')) match = { lat: 55.9548, lng: -3.1825 };
  else if (q.includes('scott monument')) match = { lat: 55.9524, lng: -3.1933 };

  // ─── European & Global Landmarks ───
  else if (q.includes('eiffel tower') || q.includes('tour eiffel')) match = { lat: 48.8584, lng: 2.2945 };
  else if (q.includes('louvre') || q.includes('musee du louvre')) match = { lat: 48.8606, lng: 2.3376 };
  else if (q.includes('big ben') || q.includes('palace of westminster')) match = { lat: 51.5007, lng: -0.1246 };
  else if (q.includes('london eye')) match = { lat: 51.5033, lng: -0.1195 };
  else if (q.includes('broadway theater') || q.includes('broadway theatre') || q.includes('broadway')) match = { lat: 40.7590, lng: -73.9845 };
  else if (q.includes('empire state building')) match = { lat: 40.7484, lng: -73.9857 };
  else if (q.includes('metropolitan museum') || q.includes('the met')) match = { lat: 40.7794, lng: -73.9632 };
  else if (q.includes('rockefeller center') || q.includes('top of the rock')) match = { lat: 40.7587, lng: -73.9787 };
  else if (q.includes('high line')) match = { lat: 40.7480, lng: -74.0048 };
  else if (q.includes('grand central')) match = { lat: 40.7527, lng: -73.9772 };
  else if (q.includes('one world observatory')) match = { lat: 40.7130, lng: -74.0132 };
  else if (q.includes('statue of liberty')) match = { lat: 40.6892, lng: -74.0445 };
  else if (q.includes('times square')) match = { lat: 40.7580, lng: -73.9855 };
  else if (q.includes('central park')) match = { lat: 40.7829, lng: -73.9654 };
  else if (q.includes('brooklyn bridge')) match = { lat: 40.7061, lng: -73.9969 };
  else if (q.includes('golden gate bridge')) match = { lat: 37.8199, lng: -122.4783 };
  else if (q.includes('colosseum')) match = { lat: 41.8902, lng: 12.4922 };

  return match;
}

export function isTextMatchRelevant(query, label) {
  if (!query || !label) return false;
  const qClean = query.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const lClean = label.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  
  const qTokens = qClean.split(/\s+/).filter(t => t.length >= 3);
  if (qTokens.length === 0) return true; // Short or numeric query, skip token filter

  // Check if at least one significant token from query is in label (or vice versa)
  return qTokens.some(token => lClean.includes(token));
}

export async function geocodeLocation(query, destination = null, centerLat = null, centerLng = null) {
  if (!query || typeof query !== 'string' || !query.trim()) return null;

  const cleanQuery = cleanQueryForGeocoding(query);
  const cacheKey = `${cleanQuery}_${destination || ''}_${centerLat || ''}_${centerLng || ''}`.toLowerCase().trim();

  const cached = geocodeCache.get(cacheKey);
  if (cached) return cached;

  // Step 1: Landmark lookup (100% confidence exact coordinates for known landmarks)
  const landmark = lookupKnownLandmark(query, centerLat, centerLng) || lookupKnownLandmark(cleanQuery, centerLat, centerLng);
  if (landmark) {
    const result = {
      lat: landmark.lat,
      lng: landmark.lng,
      label: `${query}${destination ? ', ' + destination : ''}`,
      confidence: 1.0,
      source: 'landmark'
    };
    geocodeCache.set(cacheKey, result);
    return result;
  }

  const PREFERRED_MAX_DIST_KM = 60; // Preferred radius for local city matches

  // Step 2: OpenStreetMap Nominatim with destination context
  let queriesToTry = [];
  if (destination && destination.trim() && !cleanQuery.toLowerCase().includes(destination.toLowerCase())) {
    queriesToTry.push(`${cleanQuery}, ${destination}`);
  }
  queriesToTry.push(cleanQuery);

  for (const qStr of queriesToTry) {
    try {
      let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(qStr)}&format=geojson&limit=5`;
      if (typeof centerLat === 'number' && typeof centerLng === 'number' && !isNaN(centerLat) && !isNaN(centerLng)) {
        const viewbox = `${centerLng - 0.45},${centerLat + 0.45},${centerLng + 0.45},${centerLat - 0.45}`;
        url += `&viewbox=${viewbox}&bounded=1`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.features && data.features.length > 0) {
          let bestFeature = null;
          let minDist = Infinity;
          let firstRelevantFeature = null;

          for (const feat of data.features) {
            const [fLng, fLat] = feat.geometry.coordinates;
            const featLabel = feat.properties?.display_name || feat.properties?.name || '';
            
            // Require text relevance to prevent arbitrary nearby venue substitutions
            if (!isTextMatchRelevant(cleanQuery, featLabel)) continue;

            if (typeof centerLat === 'number' && typeof centerLng === 'number') {
              const dist = haversineKm(centerLat, centerLng, fLat, fLng);
              if (dist <= PREFERRED_MAX_DIST_KM && dist < minDist) {
                minDist = dist;
                bestFeature = feat;
              }
            } else {
              bestFeature = feat;
              break;
            }
          }

          if (bestFeature) {
            const [lng, lat] = bestFeature.geometry.coordinates;
            const result = {
              lat,
              lng,
              label: bestFeature.properties?.display_name || bestFeature.properties?.name || query,
              confidence: 0.9,
              source: 'nominatim'
            };
            geocodeCache.set(cacheKey, result);
            return result;
          }
        }
      }
    } catch (err) {
      console.warn('[geocoder]: Nominatim query failed:', qStr, err.message);
    }
  }

  // Step 3: Komoot Photon API fallback
  for (const qStr of queriesToTry) {
    try {
      let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(qStr)}&limit=5`;
      if (typeof centerLat === 'number' && typeof centerLng === 'number' && !isNaN(centerLat) && !isNaN(centerLng)) {
        photonUrl += `&lat=${centerLat}&lon=${centerLng}`;
      }
      const pRes = await fetch(photonUrl);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.features && pData.features.length > 0) {
          let bestFeature = null;
          let minDist = Infinity;

          for (const feat of pData.features) {
            const [fLng, fLat] = feat.geometry.coordinates;
            const featLabel = feat.properties?.name || feat.properties?.city || feat.properties?.country || '';

            // Require text relevance to prevent arbitrary nearby venue substitutions
            if (!isTextMatchRelevant(cleanQuery, featLabel)) continue;

            if (typeof centerLat === 'number' && typeof centerLng === 'number') {
              const dist = haversineKm(centerLat, centerLng, fLat, fLng);
              if (dist <= PREFERRED_MAX_DIST_KM && dist < minDist) {
                minDist = dist;
                bestFeature = feat;
              }
            } else {
              bestFeature = feat;
              break;
            }
          }

          if (bestFeature) {
            const [lng, lat] = bestFeature.geometry.coordinates;
            const result = {
              lat,
              lng,
              label: bestFeature.properties?.name || query,
              confidence: 0.85,
              source: 'photon'
            };
            geocodeCache.set(cacheKey, result);
            return result;
          }
        }
      }
    } catch (pErr) {
      console.warn('[geocoder]: Photon fallback failed:', qStr, pErr.message);
    }
  }

  return null;
}
