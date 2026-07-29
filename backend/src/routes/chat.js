import { Router } from 'express';

const router = Router();
const chatGeocodeCache = new Map();


// Haversine formula to calculate distance between two coordinates in kilometers
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SYSTEM_PROMPT = `You are the Wanderloop AI Travel Planner, a friendly human travel buddy and experienced guide.
Your goal is to help the user plan their custom travel itinerary in a warm, enthusiastic, and human-like way.

You communicate with the frontend using a strictly structured JSON response. Your output MUST be a valid, complete JSON object with NO trailing text after the closing brace. Do not wrap the JSON in markdown code blocks.

The JSON response MUST have exactly this structure:
{
  "message": "<short 2-4 sentence warm summary + key travel tips>",
  "trip": <TripObject or null>,
  "isComplete": <boolean>,
  "mapCenter": { "lat": <float>, "lng": <float>, "zoom": <12-15> }
}

KEY RULES:
1. "message": Keep this SHORT (2-4 sentences max). Include 1-2 key transit tips. Do NOT repeat the full stop list (the map shows it).
2. "isComplete": true IF you are providing a trip itinerary.
3. "trip": YOU MUST PROVIDE A COMPLETE TripObject IMMEDIATELY if the user specifies a destination or asks for an itinerary. DO NOT wait for more details. Never set to null if a destination is known.
4. "mapCenter": Always set when generating/updating a trip.

TRIP GENERATION RULES:
1. Default to 3-4 days UNLESS user specifies a different number.
2. Every day MUST have 3-5 stops (never fewer than 3). Spread stops across morning/midday/afternoon/evening.
3. Each stop "rationale" (2-3 sentences): describe activities at this spot and name 1-2 nearby cafes/street food.
   - For the FIRST stop of each day (order: 1): state clearly where the traveler starts from (e.g. "Start your day from your hotel/accommodation in <area>. Take <transport> to reach here in about <time>.")
   - For subsequent stops: state the specific previous stop name and how to travel from it (e.g. "From <previous stop name>, take a <transport> for <time> to get here.")
   - When the user requests a specific mode of transport (e.g. train, bus, taxi), always mention the origin station/stop and destination station/stop.
4. Use accurate real-world coordinates for the destination city.
5. Keep all stops in a single day within 15km of each other for feasibility.
6. No asterisks (* or **) anywhere in the response.
7. Each day MUST have a DIFFERENT colorHue. Cycle through: "teal" (day 1), "amber" (day 2), "violet" (day 3), "rose" (day 4), "lime" (day 5), then repeat.

TripObject structure:
{
  "id": "trip-<destination>-<days>d",
  "title": "<City> <Theme> Trip",
  "destination": "<City Name>",
  "currency": "<ISO code>",
  "currencySymbol": "<symbol>",
  "budget": <total number>,
  "budgetItems": [
    { "name": "Accommodation", "amount": <number>, "color": "#2dd4bf" },
    { "name": "Food & dining", "amount": <number>, "color": "#f59e0b" },
    { "name": "Activities & entries", "amount": <number>, "color": "#f43f5e" },
    { "name": "Local transport", "amount": <number>, "color": "#84cc16" }
  ],
  "days": [
    {
      "id": "day-1",
      "dayNumber": 1,
      "colorHue": "teal",
      "stops": [
        {
          "id": "s1-1",
          "name": "<Stop 1 Name>",
          "lat": <accurate latitude>,
          "lng": <accurate longitude>,
          "timeEstimate": "09:00 AM - 11:30 AM",
          "costEstimate": <number>,
          "rationale": "<Activities here>. Nearby food: <cafe/restaurant names>. Start your morning from your hotel in <area>. Take <transport> to reach here.",
          "order": 1
        }
      ]
    },
    {
      "id": "day-2",
      "dayNumber": 2,
      "colorHue": "amber",
      "stops": [
        {
          "id": "s2-1",
          "name": "<Stop 1 Name for Day 2>",
          "lat": <accurate latitude>,
          "lng": <accurate longitude>,
          "timeEstimate": "09:30 AM - 12:00 PM",
          "costEstimate": <number>,
          "rationale": "<Activities here>. Nearby food: <cafe/restaurant names>.",
          "order": 1
        }
      ]
    }
  ]
}

IMPORTANT: Always close all JSON brackets properly. Never cut off the response mid-object.
`;



router.post('/chat', async (req, res) => {
  try {
    const { messages, currentTrip } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const apiKey = process.env.NVIDIA_API_KEY;
    const baseUrl = process.env.NIM_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';

    if (!apiKey) {
      return res.status(500).json({ error: 'NVIDIA_API_KEY is not configured on the server.' });
    }

    // Format messages for Llama 3.1
    const nimMessages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Map roles: 'user' -> 'user', 'assistant' -> 'assistant'
    messages.forEach((msg) => {
      // Avoid passing raw HTML rendered text if possible, but standard is fine
      nimMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });

    // If there is an active trip, append a helper message to system context or user context so Llama knows the current state
    if (currentTrip && Object.keys(currentTrip).length > 0 && currentTrip.days && currentTrip.days.length > 0) {
      nimMessages.push({
        role: 'system',
        content: `The current active itinerary state is: ${JSON.stringify(currentTrip)}. If the user asks for changes, modify this state and return the updated version.`
      });
    }

    let response;
    const candidateModels = ['meta/llama-3.1-8b-instruct', 'meta/llama-3.1-70b-instruct'];
    let lastError;

    for (const modelCandidate of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s max per model

        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: modelCandidate,
            messages: nimMessages,
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: 3000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (response.ok) {
          console.log(`[server]: LLM response generated successfully using ${modelCandidate}`);
          break;
        }
      } catch (err) {
        console.warn(`[server]: Model ${modelCandidate} failed or timed out: ${err.message}. Trying next candidate...`);
        lastError = err;
      }
    }

    if (!response || !response.ok) {
      throw new Error(`All LLM models failed or timed out. ${lastError ? lastError.message : ''}`);
    }

    const data = await response.json();
    let rawText = data.choices[0].message.content.trim();

    // Parse the JSON response with multi-stage recovery for truncated responses
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(rawText);
    } catch (parseErr) {
      // Stage 1: strip markdown fences
      let cleanText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        jsonResponse = JSON.parse(cleanText);
      } catch (e2) {
        // Stage 2: attempt to repair truncated JSON by closing open structures
        console.warn('[server]: JSON parse failed, attempting repair...');
        jsonResponse = tryRepairJSON(cleanText);
        if (!jsonResponse) {
          console.error('Failed to parse or repair NIM JSON response. Raw (first 500 chars):', rawText.slice(0, 500));
          // Return a safe fallback so the frontend doesn't crash
          return res.status(200).json({
            message: 'I had trouble generating the full itinerary. Please try again or rephrase your request — I will get it right!',
            trip: null,
            isComplete: false,
            mapCenter: null
          });
        }
      }
    }

    // Normalize jsonResponse structure so trip object is always present if days/itinerary are returned
    if (jsonResponse && !jsonResponse.trip) {
      if (jsonResponse.days && Array.isArray(jsonResponse.days) && jsonResponse.days.length > 0) {
        jsonResponse.trip = {
          id: jsonResponse.id || `trip-${(jsonResponse.destination || 'dest').toLowerCase().replace(/\s+/g, '-')}-${jsonResponse.days.length}d`,
          title: jsonResponse.title || `${jsonResponse.destination || 'Custom'} Trip`,
          destination: jsonResponse.destination || '',
          currency: jsonResponse.currency || 'USD',
          currencySymbol: jsonResponse.currencySymbol || '$',
          budget: jsonResponse.budget || 2500,
          budgetItems: jsonResponse.budgetItems || [],
          days: jsonResponse.days
        };
      } else if (jsonResponse.itinerary && Array.isArray(jsonResponse.itinerary.days)) {
        jsonResponse.trip = jsonResponse.itinerary;
      } else if (jsonResponse.tripObject && Array.isArray(jsonResponse.tripObject.days)) {
        jsonResponse.trip = jsonResponse.tripObject;
      }
    }

    if (jsonResponse && !jsonResponse.message && jsonResponse.trip) {
      jsonResponse.message = `I've planned a custom ${jsonResponse.trip.title || jsonResponse.trip.destination || 'travel'} itinerary for you! Check out the stops and route on the map below.`;
    }

    // Strip all asterisks/stars from message response for security and strict formatting compliance
    if (jsonResponse && typeof jsonResponse.message === 'string') {
      jsonResponse.message = jsonResponse.message.replace(/\*/g, '');
    }

    // First, try to geocode the destination if provided, to ensure we center and bound accurately
    if (jsonResponse.trip && jsonResponse.trip.destination) {
      try {
        const destQuery = jsonResponse.trip.destination;
        const destUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destQuery)}&format=json&limit=1`;
        const destController = new AbortController();
        const destTimeoutId = setTimeout(() => destController.abort(), 2000);

        const destRes = await fetch(destUrl, {
          headers: {
            'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
          },
          signal: destController.signal
        });

        clearTimeout(destTimeoutId);

        if (destRes.ok) {
          const destData = await destRes.json();
          if (destData && destData.length > 0) {
            const destLat = parseFloat(destData[0].lat);
            const destLng = parseFloat(destData[0].lon);

            // Override mapCenter to be exactly at the correct geocoded destination
            jsonResponse.mapCenter = {
              lat: destLat,
              lng: destLng,
              zoom: jsonResponse.mapCenter ? (jsonResponse.mapCenter.zoom || 12) : 12
            };
            console.log(`[server]: Geocoded destination "${destQuery}" successfully to [${destLat}, ${destLng}]`);
          }
        }
      } catch (destErr) {
        console.error('Failed to geocode trip destination:', destErr);
      }
    }

    let fallbackCenterLat = 35.6895; // Default Tokyo
    let fallbackCenterLng = 139.6917;

    if (jsonResponse.mapCenter) {
      fallbackCenterLat = jsonResponse.mapCenter.lat;
      fallbackCenterLng = jsonResponse.mapCenter.lng;
    } else if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      let foundCenter = false;
      for (const day of jsonResponse.trip.days) {
        if (Array.isArray(day.stops)) {
          const validStop = day.stops.find(s => typeof s.lat === 'number' && !isNaN(s.lat) && typeof s.lng === 'number' && !isNaN(s.lng) && s.lat !== 0 && s.lng !== 0);
          if (validStop) {
            fallbackCenterLat = validStop.lat;
            fallbackCenterLng = validStop.lng;
            foundCenter = true;
            break;
          }
        }
      }
    }

    // Geocode stops securely within a bounding box centered on mapCenter to ensure real targets
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      const centerLat = fallbackCenterLat;
      const centerLng = fallbackCenterLng;
      const viewbox = `${centerLng - 0.5},${centerLat + 0.5},${centerLng + 0.5},${centerLat - 0.5}`;

      // Get city name for fallback search
      let cityName = jsonResponse.trip.destination || '';
      if (!cityName) {
        try {
          const revUrl = `https://nominatim.openstreetmap.org/reverse?lat=${centerLat}&lon=${centerLng}&format=json`;
          const revRes = await fetch(revUrl, {
            headers: {
              'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
            }
          });
          if (revRes.ok) {
            const revData = await revRes.json();
            cityName = revData.address.city || revData.address.town || revData.address.suburb || revData.address.village || '';
          }
        } catch (err) {
          console.error('Failed to reverse geocode mapCenter:', err);
        }
      }

      for (const day of jsonResponse.trip.days) {
        if (!Array.isArray(day.stops)) continue;
        for (const stop of day.stops) {
          try {
            const cleanQuery = cleanQueryForGeocoding(stop.name);
            
            // 1. Direct Landmark Lookup
            let landmarkCoords = lookupKnownLandmark(stop.name) || lookupKnownLandmark(cleanQuery);
            if (landmarkCoords) {
              stop.lat = landmarkCoords.lat;
              stop.lng = landmarkCoords.lng;
              console.log(`[server]: Landmark lookup hit for "${stop.name}" -> [${stop.lat}, ${stop.lng}]`);
              continue;
            }

            // 2. Check if AI already provided realistic coordinates within 35km of destination center
            if (
              typeof stop.lat === 'number' &&
              typeof stop.lng === 'number' &&
              stop.lat !== 0 &&
              stop.lng !== 0 &&
              !isNaN(stop.lat) &&
              !isNaN(stop.lng)
            ) {
              const distFromCenter = haversineKm(centerLat, centerLng, stop.lat, stop.lng);
              if (distFromCenter <= 35) {
                continue;
              }
            }

            const cacheKey = `${cleanQuery.toLowerCase().trim()}_${centerLat.toFixed(3)}_${centerLng.toFixed(3)}`;
            if (chatGeocodeCache.has(cacheKey)) {
              const coords = chatGeocodeCache.get(cacheKey);
              stop.lng = coords.lng;
              stop.lat = coords.lat;
              continue;
            }

            let coords = null;

            // Attempt 1: Search using clean query bounded by viewbox
            let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=geojson&limit=1&viewbox=${viewbox}&bounded=1`;
            coords = await fetchCoords(url, cleanQuery);

            // Attempt 2: If clean query fails, try clean query + cityName bounded by viewbox
            if (!coords && cityName) {
              const queryWithCity = `${cleanQuery}, ${cityName}`;
              url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryWithCity)}&format=geojson&limit=1&viewbox=${viewbox}&bounded=1`;
              coords = await fetchCoords(url, queryWithCity);
            }

            // Attempt 3: Unbounded search with cleanQuery + cityName
            if (!coords && cityName) {
              const queryWithCity = `${cleanQuery}, ${cityName}`;
              url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryWithCity)}&format=geojson&limit=1`;
              coords = await fetchCoords(url, queryWithCity);
            }

            // Attempt 4: Unbounded search for cleanQuery
            if (!coords) {
              url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=geojson&limit=1`;
              coords = await fetchCoords(url, cleanQuery);
            }

            if (coords) {
              stop.lng = coords.lng;
              stop.lat = coords.lat;
              chatGeocodeCache.set(cacheKey, { lng: coords.lng, lat: coords.lat });
            }

            await new Promise(resolve => setTimeout(resolve, 100)); // Fast rate limit pause
          } catch (err) {
            console.error('Failed to geocode stop:', stop.name, err);
          }

          // SANITIZATION: Ensure stop coordinates are valid numbers, fallback to map center if geocoding failed
          if (
            typeof stop.lat !== 'number' ||
            isNaN(stop.lat) ||
            typeof stop.lng !== 'number' ||
            isNaN(stop.lng) ||
            stop.lat < -90 ||
            stop.lat > 90 ||
            stop.lng < -180 ||
            stop.lng > 180
          ) {
            const fallback = lookupKnownLandmark(stop.name, centerLat, centerLng) || { lat: centerLat, lng: centerLng };
            stop.lat = fallback.lat;
            stop.lng = fallback.lng;
            console.log(`[server]: Fallback missing/invalid coordinates for "${stop.name}" -> reset to [${stop.lat}, ${stop.lng}]`);
          }
        }
      }
    }

    // POST-PROCESSING: Disambiguate identical stop coordinates within the same day
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      jsonResponse.trip.days.forEach((day) => {
        if (!Array.isArray(day.stops)) return;
        const seenCoords = new Set();
        day.stops.forEach((stop, idx) => {
          if (typeof stop.lat !== 'number' || isNaN(stop.lat)) stop.lat = fallbackCenterLat;
          if (typeof stop.lng !== 'number' || isNaN(stop.lng)) stop.lng = fallbackCenterLng;

          const key = `${stop.lat.toFixed(4)}_${stop.lng.toFixed(4)}`;
          if (seenCoords.has(key)) {
            // Apply a small ~300m spiral offset so markers don't stack on top of each other
            const angle = (idx * 1.5) % (2 * Math.PI);
            const radius = 0.003 + (idx * 0.001);
            stop.lat = parseFloat((stop.lat + Math.sin(angle) * radius).toFixed(5));
            stop.lng = parseFloat((stop.lng + Math.cos(angle) * radius).toFixed(5));
          }
          seenCoords.add(`${stop.lat.toFixed(4)}_${stop.lng.toFixed(4)}`);
        });
      });
    }

    // POST-PROCESSING: Enforce distinct day colors by cycling through the palette
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      const DAY_COLOR_PALETTE = ['teal', 'amber', 'violet', 'rose', 'lime'];
      jsonResponse.trip.days.forEach((day, idx) => {
        day.colorHue = DAY_COLOR_PALETTE[idx % DAY_COLOR_PALETTE.length];
      });
    }

    // POST-PROCESSING: Remove extreme outlier stops & reorder stops by geographic nearest-neighbor feasibility
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      const MAX_DISTANCE_KM = 300; // Allow wide regional / multi-city stops (e.g. up to 300km)

      for (const day of jsonResponse.trip.days) {
        if (!Array.isArray(day.stops) || day.stops.length < 2) continue;

        // Calculate centroid of all stops in this day
        let centroidLat = 0, centroidLng = 0;
        day.stops.forEach(s => { centroidLat += s.lat; centroidLng += s.lng; });
        centroidLat /= day.stops.length;
        centroidLng /= day.stops.length;

        // Filter out stops that are too far from centroid
        const validStops = [];
        const removedStops = [];
        for (const stop of day.stops) {
          const dist = haversineKm(centroidLat, centroidLng, stop.lat, stop.lng);
          if (dist <= MAX_DISTANCE_KM) {
            validStops.push(stop);
          } else {
            removedStops.push({ name: stop.name, distance: dist.toFixed(1) });
          }
        }

        if (removedStops.length > 0) {
          console.log(`[server]: Removed ${removedStops.length} outlier stop(s) from ${day.id}: ${removedStops.map(s => `${s.name} (${s.distance}km)`).join(', ')}`);
        }

        // Re-order remaining stops sequentially along minimum geographic route
        day.stops = optimizeDayStopsRoute(validStops);

        // GUARANTEE DEPTH: If a day has fewer than 3 stops, enrich it with local food/culture stops
        if (day.stops.length < 3 && day.stops.length > 0) {
          const baseStop = day.stops[0];
          const destName = jsonResponse.trip.destination || 'local area';

          if (day.stops.length === 1) {
            day.stops.push({
              id: `${day.id}-s2`,
              name: `Local Street Food & Artisan Market near ${baseStop.name}`,
              lat: baseStop.lat + (Math.random() - 0.5) * 0.006,
              lng: baseStop.lng + (Math.random() - 0.5) * 0.006,
              timeEstimate: '01:00 PM - 03:00 PM',
              costEstimate: 350,
              rationale: `Taste local specialties and street food in ${destName}. Recommended nearby spots: Artisan Cafe & Local Bakery. Transit: 5 min walk from ${baseStop.name}.`,
              order: 2
            });
          }

          if (day.stops.length === 2) {
            day.stops.push({
              id: `${day.id}-s3`,
              name: `Panoramic Viewpoint & Evening Sunset Promenade`,
              lat: baseStop.lat + (Math.random() - 0.5) * 0.008,
              lng: baseStop.lng + (Math.random() - 0.5) * 0.008,
              timeEstimate: '05:00 PM - 07:30 PM',
              costEstimate: 0,
              rationale: `Relax and enjoy scenic evening views of ${destName}. Nearby dinner tip: Heritage Dining Room & Riverfront Cafe. Transit: 10 min cab/walk from market.`,
              order: 3
            });
          }

          day.stops = optimizeDayStopsRoute(day.stops);
        }
      }
    }

    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error('NIM chat routing error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Helper to fetch coordinates from Nominatim or Photon safely with a timeout
async function fetchCoords(url, fallbackQuery = null) {
  try {
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
        const coords = data.features[0].geometry.coordinates; // [lng, lat]
        return { lng: coords[0], lat: coords[1] };
      }
    }
  } catch (err) {
    console.warn('[server]: Nominatim fetchCoords failed:', err.message);
  }

  // Fallback to Photon API if Nominatim query fails
  if (fallbackQuery) {
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(fallbackQuery)}&limit=1`;
      const pRes = await fetch(photonUrl);
      if (pRes.ok) {
        const pData = await pRes.json();
        if (pData.features && pData.features.length > 0) {
          const coords = pData.features[0].geometry.coordinates;
          return { lng: coords[0], lat: coords[1] };
        }
      }
    } catch (pErr) {
      console.warn('[server]: Photon fetchCoords fallback failed:', pErr.message);
    }
  }

  return null;
}

// Known landmark dictionary for rapid, reliable coordinate matching
function lookupKnownLandmark(queryStr, centerLat = null, centerLng = null) {
  if (!queryStr) return null;
  const q = queryStr.toLowerCase();
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
  if (q.includes('shibuya crossing') || q.includes('hachiko') || q.includes('shibuya sky') || q.includes('shibuya')) return { lat: 35.6596, lng: 139.7006 };
  if (q.includes('harajuku') || q.includes('takeshita') || q.includes('omotesando')) return { lat: 35.6715, lng: 139.7030 };
  if (q.includes('meiji shrine') || q.includes('meiji jingu') || q.includes('yoyogi')) return { lat: 35.6764, lng: 139.6997 };

  // ─── Asakusa & Eastern Tokyo Landmarks ───
  if (q.includes('senso-ji') || q.includes('sensoji') || q.includes('nakamise') || q.includes('asakusa')) return { lat: 35.7148, lng: 139.7967 };
  if (q.includes('skytree') || q.includes('solamachi')) return { lat: 35.7101, lng: 139.8107 };
  if (q.includes('ueno park') || q.includes('ueno zoo') || q.includes('ueno')) return { lat: 35.7141, lng: 139.7741 };
  if (q.includes('akihabara') || q.includes('electric town')) return { lat: 35.6997, lng: 139.7714 };

  // ─── Ginza & Central Tokyo Landmarks ───
  if (q.includes('tsukiji') || q.includes('outer market')) return { lat: 35.6655, lng: 139.7712 };
  if (q.includes('teamlab') || q.includes('toyosu')) return { lat: 35.6489, lng: 139.7912 };
  if (q.includes('ginza') || q.includes('kabukiza')) return { lat: 35.6718, lng: 139.7650 };
  if (q.includes('imperial palace') || q.includes('chiyoda')) return { lat: 35.6852, lng: 139.7528 };
  if (q.includes('tokyo tower') || q.includes('zojo-ji') || q.includes('roppongi')) return { lat: 35.6586, lng: 139.7454 };
  if (q.includes('odaiba') || q.includes('rainbow bridge')) return { lat: 35.6293, lng: 139.7766 };

  // ─── Kyoto Landmarks ───
  if (q.includes('kinkaku') || q.includes('golden pavilion')) return { lat: 35.0394, lng: 135.7292 };
  if (q.includes('ginkaku') || q.includes('silver pavilion')) return { lat: 35.0272, lng: 135.7982 };
  if (q.includes('fushimi inari') || q.includes('torii')) return { lat: 34.9671, lng: 135.7727 };
  if (q.includes('kiyomizu') || q.includes('kiyomizudera')) return { lat: 34.9949, lng: 135.7850 };
  if (q.includes('arashiyama') || q.includes('bamboo')) return { lat: 35.0156, lng: 135.6715 };
  if (q.includes('gion') || q.includes('yasaka') || q.includes('hanamikoji')) return { lat: 35.0037, lng: 135.7785 };
  if (q.includes('nijo castle') || q.includes('nijojo')) return { lat: 35.0142, lng: 135.7482 };
  if (q.includes('nishiki') || q.includes('nishiki market')) return { lat: 35.0050, lng: 135.7649 };
  if (q.includes('kyoto station') || q.includes('kyoto tower')) return { lat: 34.9858, lng: 135.7588 };
  if (q.includes('ryoan-ji') || q.includes('ryoanji')) return { lat: 35.0344, lng: 135.7182 };

  // ─── Osaka & Hakone Landmarks ───
  if (q.includes('dotonbori') || q.includes('namba') || q.includes('glico')) return { lat: 34.6687, lng: 135.5013 };
  if (q.includes('osaka castle') || q.includes('osakajo')) return { lat: 34.6873, lng: 135.5262 };
  if (q.includes('shinsekai') || q.includes('tsutenkaku')) return { lat: 34.6525, lng: 135.5063 };
  if (q.includes('fuji') || q.includes('kawaguchiko')) return { lat: 35.4983, lng: 138.7686 };
  if (match && typeof centerLat === 'number' && typeof centerLng === 'number') {
    const dist = haversineKm(centerLat, centerLng, match.lat, match.lng);
    if (dist > 250) {
      console.log(`[server]: Rejecting landmark match for "${queryStr}" (${dist.toFixed(1)}km from trip center)`);
      return null;
    }
  }

  return match;
}

// Clean query strings to improve OSM geocoding hits
function cleanQueryForGeocoding(name) {
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

// Nearest-neighbor route optimization for stops within a day
function optimizeDayStopsRoute(stops) {
  if (!Array.isArray(stops) || stops.length < 2) return stops;

  const unvisited = [...stops];
  const ordered = [unvisited.shift()];

  while (unvisited.length > 0) {
    const last = ordered[ordered.length - 1];
    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = haversineKm(last.lat, last.lng, unvisited[i].lat, unvisited[i].lng);
      if (dist < minDist) {
        minDist = dist;
        nearestIdx = i;
      }
    }

    ordered.push(unvisited.splice(nearestIdx, 1)[0]);
  }

  const TIME_SLOTS = [
    '09:00 AM - 11:30 AM',
    '12:00 PM - 02:30 PM',
    '03:00 PM - 05:30 PM',
    '06:00 PM - 08:30 PM',
    '09:00 PM - 10:30 PM'
  ];

  return ordered.map((s, idx) => ({
    ...s,
    order: idx + 1,
    timeEstimate: s.timeEstimate || TIME_SLOTS[Math.min(idx, TIME_SLOTS.length - 1)]
  }));
}

// Attempt to repair truncated JSON by closing any unclosed brackets/braces/strings
function tryRepairJSON(text) {
  if (!text) return null;
  let repaired = text.trim();

  // Remove trailing comma before attempting repair
  repaired = repaired.replace(/,\s*$/, '');

  // Count open vs closed brackets and braces to determine what to append
  let inString = false;
  let escape = false;
  const stack = [];

  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // If we were mid-string, close it first
  if (inString) repaired += '"';

  // Close all unclosed brackets/braces in reverse order
  while (stack.length > 0) {
    repaired += stack.pop();
  }

  try {
    return JSON.parse(repaired);
  } catch (e) {
    // If still broken, try removing the last incomplete key-value pair and close again
    try {
      const lastComma = repaired.lastIndexOf(',');
      if (lastComma > 0) {
        let truncated = repaired.slice(0, lastComma);
        // Re-close after removing bad trailing fragment
        const stack2 = [];
        let inStr2 = false, esc2 = false;
        for (let i = 0; i < truncated.length; i++) {
          const ch = truncated[i];
          if (esc2) { esc2 = false; continue; }
          if (ch === '\\' && inStr2) { esc2 = true; continue; }
          if (ch === '"') { inStr2 = !inStr2; continue; }
          if (inStr2) continue;
          if (ch === '{') stack2.push('}');
          else if (ch === '[') stack2.push(']');
          else if (ch === '}' || ch === ']') stack2.pop();
        }
        while (stack2.length > 0) truncated += stack2.pop();
        return JSON.parse(truncated);
      }
    } catch (e2) { /* fall through */ }
    return null;
  }
}

export default router;

