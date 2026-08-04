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

DESTINATION DISAMBIGUATION (CRITICAL):
- "USA", "US", "U.S.A.", "United States", "America" ALL mean the country "United States of America". NEVER interpret these as "Usa River" (Tanzania) or any other place.
- "UK" means "United Kingdom". "Turkey" means the country "Türkiye". "China" means the country.
- MULTI-CITY / COUNTRY-WIDE TRIPS: When the user says "explore whole USA" or "trip across Japan" or mentions MULTIPLE cities, generate a MULTI-CITY itinerary:
  * Set "destination" to the FIRST city (e.g. "Los Angeles" for a west-to-east US trip).
  * Spread days across ALL cities the user mentioned. Each day should be in ONE city.
  * If user mentions specific cities, use those. If they just say "USA" or "India", pick 3-5 major tourist cities.
  * Use REAL landmark names for each stop (e.g. "Statue of Liberty", "Times Square", "Hollywood Sign"), NOT generic names like "Cultural Heritage Landmark".
- For single-city trips, set "destination" to that city name.

STOP NAMING RULES (CRITICAL):
1. EVERY stop "name" MUST be the REAL, ACTUAL name of a specific place, attraction, park, museum, restaurant, or landmark.
2. NEVER use generic names like "Cultural Heritage Landmark", "Artisan Market", "Panoramic Sunset Viewpoint", "Local Dining Spot".
3. Good examples: "Central Park", "The Metropolitan Museum of Art", "Pike Place Market", "Golden Gate Bridge", "Griffith Observatory".
4. Bad examples: "City Cultural Heritage Landmark - Day 3", "City Artisan Market & Local Dining", "Panoramic Viewpoint".

TRIP DURATION & DAYS RULE (CRITICAL):
1. ALWAYS check the user's prompt for requested trip duration (e.g. "5 days", "10-day", "2 weeks", "a week", "3-day", "weekend").
2. Your "days" array MUST contain the EXACT number of days requested by the user. If user requested 5 days, generate 5 days in "days". If user requested 2 weeks, generate 14 days.
3. NEVER default to 2 or 3 days when the user explicitly asked for a different number of days.

BUDGET CALCULATION RULE (CRITICAL):
1. "budget" in TripObject MUST be the TOTAL TRIP BUDGET for the entire trip (NOT per-day!).
2. If user specifies a per-day rate (e.g. "$80-120 per day" or "$100/day"):
   Calculate: TOTAL BUDGET = (Average Daily Rate) * (Total Days).
   Example: $100/day for 5 days = 500 total budget.
   Example: $100/day for 14 days = 1400 total budget.
3. NEVER put a single-day number (like 80 or 100) into the "budget" field when total days > 1.
4. Ensure the total sum of budgetItems (Accommodation + Food + Activities + Transport) fits within "budget" so the budget is not falsely marked as exceeded.

TRIP GENERATION RULES:
1. Default to 3-4 days UNLESS user specifies a different number of days.
2. Every day MUST have 3-5 stops (never fewer than 3). Spread stops across morning/midday/afternoon/evening.
3. Each stop "rationale" (2-3 sentences): describe activities at this spot and name 1-2 nearby cafes/street food.
   - For the FIRST stop of each day (order: 1): state clearly where the traveler starts from (e.g. "Start your day from your hotel/accommodation in <area>. Take <transport> to reach here in about <time>.")
   - For subsequent stops: state the specific previous stop name and how to travel from it (e.g. "From <previous stop name>, take a <transport> for <time> to get here.")
   - When the user requests a specific mode of transport (e.g. train, bus, taxi), always mention the origin station/stop and destination station/stop.
4. Use accurate real-world coordinates for the destination city. Coordinates MUST be real lat/lng for that specific landmark.
5. Keep all stops in a single day within 15km of each other for feasibility. For multi-city trips, stops within the SAME DAY should be in the same city.
6. No asterisks (* or **) anywhere in the response.
7. Each day MUST have a DIFFERENT colorHue. Cycle through: "teal" (day 1), "amber" (day 2), "violet" (day 3), "rose" (day 4), "lime" (day 5), then repeat.
8. For multi-city trips spanning multiple days, each day should be set in ONE city. Use the "rationale" of the first stop to describe intercity travel (e.g. "Fly from LA to Chicago, 4hr flight").

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

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001/api/v1/generate-trip';

    let jsonResponse = null;
    let usedAiMicroservice = false;

    try {
      console.log(`[server]: Forwarding request to Wanderloop AI Microservice at ${AI_SERVICE_URL}...`);
      const aiRes = await fetch(AI_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, currentTrip })
      });

      if (aiRes.ok) {
        jsonResponse = await aiRes.json();
        usedAiMicroservice = true;
        console.log('[server]: Received response from AI Microservice — will run post-processing pipeline.');
      }
    } catch (aiErr) {
      console.warn('[server]: AI Microservice connection failed, attempting fallback to cloud provider...', aiErr.message);
    }

    // Only use NVIDIA cloud fallback if AI Microservice didn't respond
    if (!jsonResponse) {
    const apiKey = process.env.NVIDIA_API_KEY;
    const baseUrl = process.env.NIM_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';

    if (!apiKey) {
      return res.status(500).json({ error: 'AI Microservice is offline and NVIDIA_API_KEY is not configured.' });
    }

    // Format messages for Llama 3.1
    const nimMessages = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    // Map roles: 'user' -> 'user', 'assistant' -> 'assistant'
    messages.forEach((msg) => {
      nimMessages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      });
    });

    if (currentTrip && Object.keys(currentTrip).length > 0 && currentTrip.days && currentTrip.days.length > 0) {
      nimMessages.push({
        role: 'system',
        content: `The current active itinerary state is: ${JSON.stringify(currentTrip)}. If the user asks for changes, modify this state and return the updated version.`
      });
    }

    let response;
    const candidateModels = [
      'meta/llama-3.3-70b-instruct',
      'nvidia/llama-3.1-nemotron-51b-instruct',
      'meta/llama3-70b-instruct',
      'meta/llama-3.1-8b-instruct'
    ];
    let lastError;

    for (const modelCandidate of candidateModels) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s max per model for cloud fallback

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
            max_tokens: 4096
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

    try {
      jsonResponse = JSON.parse(rawText);
    } catch (parseErr) {
      let cleanText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      try {
        jsonResponse = JSON.parse(cleanText);
      } catch (e2) {
        console.warn('[server]: JSON parse failed, attempting repair...');
        jsonResponse = tryRepairJSON(cleanText);
        if (!jsonResponse) {
          return res.status(200).json({
            message: 'I had trouble generating the full itinerary. Please try again or rephrase your request — I will get it right!',
            trip: null,
            isComplete: false,
            mapCenter: null
          });
        }
      }
    }
    } // end NVIDIA fallback

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

    // POST-PROCESSING: Fix common LLM destination hallucinations
    // The LLM sometimes confuses abbreviations/short names with obscure real places
    let destinationWasCorrected = false;
    if (jsonResponse && jsonResponse.trip && jsonResponse.trip.destination) {
      const dest = jsonResponse.trip.destination;
      const fixedDest = fixHallucinatedDestination(dest, messages);
      if (fixedDest !== dest) {
        console.log(`[server]: Fixed hallucinated destination: "${dest}" -> "${fixedDest}"`);
        jsonResponse.trip.destination = fixedDest;
        destinationWasCorrected = true;
        // Also fix the title if it contains the bad destination
        if (jsonResponse.trip.title) {
          jsonResponse.trip.title = jsonResponse.trip.title.replace(new RegExp(escapeRegex(dest), 'gi'), fixedDest);
        }
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
      for (const day of jsonResponse.trip.days) {
        if (Array.isArray(day.stops)) {
          const validStop = day.stops.find(s => typeof s.lat === 'number' && !isNaN(s.lat) && typeof s.lng === 'number' && !isNaN(s.lng) && s.lat !== 0 && s.lng !== 0);
          if (validStop) {
            fallbackCenterLat = validStop.lat;
            fallbackCenterLng = validStop.lng;
            break;
          }
        }
      }
    }

    // POST-PROCESSING: Enforce exact day count and multi-city route if requested by user in prompt
    // Must run AFTER fallbackCenterLat/Lng are set so new days get correct coordinates
    let isMultiCity = false;
    if (jsonResponse && jsonResponse.trip) {
      const requestedDays = extractRequestedDays(messages);
      isMultiCity = detectMultiCityTrip(jsonResponse.trip, messages);
      const targetDays = requestedDays || 14; // Default to 14 days if user prompt suggests multi-city/2+ weeks
      console.log(`[server]: Enforcing ${targetDays} days (multiCity: ${isMultiCity})...`);
      enforceRequestedDays(jsonResponse.trip, targetDays, fallbackCenterLat, fallbackCenterLng, messages, isMultiCity);
    }

    // POST-PROCESSING: Calculate and enforce correct trip budget (Total Budget = Daily Budget * Total Days)
    if (jsonResponse && jsonResponse.trip) {
      calculateAndEnforceTripBudget(jsonResponse.trip, messages);
    }

    // DYNAMIC GEOCODING: Ensure all LLM-generated stops have valid real-world coordinates
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      for (const day of jsonResponse.trip.days) {
        if (!Array.isArray(day.stops)) continue;
        for (const stop of day.stops) {
          try {
            // 1. If LLM provided valid, non-zero coordinates, trust them!
            if (
              typeof stop.lat === 'number' &&
              typeof stop.lng === 'number' &&
              !isNaN(stop.lat) &&
              !isNaN(stop.lng) &&
              stop.lat !== 0 &&
              stop.lng !== 0 &&
              stop.lat >= -90 && stop.lat <= 90 &&
              stop.lng >= -180 && stop.lng <= 180
            ) {
              continue;
            }

            const cleanQuery = cleanQueryForGeocoding(stop.name);
            const cacheKey = cleanQuery.toLowerCase().trim();

            if (chatGeocodeCache.has(cacheKey)) {
              const coords = chatGeocodeCache.get(cacheKey);
              stop.lat = coords.lat;
              stop.lng = coords.lng;
              continue;
            }

            let coords = null;

            // Attempt 1: Dynamic Search for exact stop name
            let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanQuery)}&format=geojson&limit=1`;
            coords = await fetchCoords(url, cleanQuery);

            // Attempt 2: Search with destination context if available
            if (!coords && jsonResponse.trip.destination) {
              const queryWithDest = `${cleanQuery}, ${jsonResponse.trip.destination}`;
              url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryWithDest)}&format=geojson&limit=1`;
              coords = await fetchCoords(url, queryWithDest);
            }

            if (coords) {
              stop.lat = coords.lat;
              stop.lng = coords.lng;
              chatGeocodeCache.set(cacheKey, { lat: coords.lat, lng: coords.lng });
            }

            await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit pause
          } catch (err) {
            console.error('Failed to geocode stop dynamically:', stop.name, err);
          }

          // Fallback check: if geocoding failed and coords are still invalid, set to mapCenter
          if (
            typeof stop.lat !== 'number' || isNaN(stop.lat) ||
            typeof stop.lng !== 'number' || isNaN(stop.lng)
          ) {
            stop.lat = fallbackCenterLat;
            stop.lng = fallbackCenterLng;
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
      const MAX_DISTANCE_KM = isMultiCity ? 5000 : 300; // Allow huge distances for multi-city trips

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

  // ─── USA Landmarks ───
  if (q.includes('statue of liberty')) return { lat: 40.6892, lng: -74.0445 };
  if (q.includes('times square')) return { lat: 40.7580, lng: -73.9855 };
  if (q.includes('central park')) return { lat: 40.7829, lng: -73.9654 };
  if (q.includes('brooklyn bridge')) return { lat: 40.7061, lng: -73.9969 };
  if (q.includes('metropolitan museum') || q.includes('the met')) return { lat: 40.7794, lng: -73.9632 };
  if (q.includes('empire state building')) return { lat: 40.7484, lng: -73.9857 };
  if (q.includes('grand central')) return { lat: 40.7527, lng: -73.9772 };

  if (q.includes('hollywood sign')) return { lat: 34.1341, lng: -118.3215 };
  if (q.includes('santa monica pier') || q.includes('santa monica')) return { lat: 34.0094, lng: -118.4973 };
  if (q.includes('griffith observatory') || q.includes('griffith')) return { lat: 34.1184, lng: -118.3004 };
  if (q.includes('getty center')) return { lat: 34.0780, lng: -118.4741 };
  if (q.includes('venice beach')) return { lat: 33.9850, lng: -118.4695 };
  if (q.includes('lacma')) return { lat: 34.0639, lng: -118.3592 };

  if (q.includes('millennium park') || q.includes('cloud gate') || q.includes('the bean')) return { lat: 41.8827, lng: -87.6233 };
  if (q.includes('art institute of chicago')) return { lat: 41.8796, lng: -87.6237 };
  if (q.includes('navy pier')) return { lat: 41.8917, lng: -87.6086 };
  if (q.includes('willis tower') || q.includes('sears tower')) return { lat: 41.8789, lng: -87.6359 };
  if (q.includes('magnificent mile')) return { lat: 41.8940, lng: -87.6246 };

  if (q.includes('golden gate bridge')) return { lat: 37.8199, lng: -122.4783 };
  if (q.includes('fisherman\'s wharf') || q.includes('fishermans wharf')) return { lat: 37.8080, lng: -122.4177 };
  if (q.includes('alcatraz')) return { lat: 37.8270, lng: -122.4230 };
  if (q.includes('lombard street')) return { lat: 37.8021, lng: -122.4187 };

  if (q.includes('las vegas strip') || q.includes('the strip')) return { lat: 36.1147, lng: -115.1728 };
  if (q.includes('bellagio fountains') || q.includes('bellagio')) return { lat: 36.1126, lng: -115.1767 };
  if (q.includes('fremont street')) return { lat: 36.1699, lng: -115.1423 };

  if (q.includes('south beach')) return { lat: 25.7826, lng: -80.1341 };
  if (q.includes('wynwood walls')) return { lat: 25.8010, lng: -80.1994 };

  if (q.includes('national mall') || q.includes('lincoln memorial')) return { lat: 38.8893, lng: -77.0502 };
  if (q.includes('white house')) return { lat: 38.8977, lng: -77.0365 };
  if (q.includes('us capitol') || q.includes('u.s. capitol')) return { lat: 38.8899, lng: -77.0091 };

  if (match && typeof centerLat === 'number' && typeof centerLng === 'number') {
    const dist = haversineKm(centerLat, centerLng, match.lat, match.lng);
    if (dist > 250) {
      console.log(`[server]: Rejecting landmark match for "${queryStr}" (${dist.toFixed(1)}km from trip center)`);
      return null;
    }
  }

  return match;
}

// Common country/abbreviation hallucination fixes
// The LLM sometimes interprets country abbreviations as obscure town names
// Only catch actual LLM hallucinations (e.g. "Usa River" Tanzania),
// NOT legitimate country-level requests. The LLM is now prompted to handle
// country-level trips properly by picking major cities.
const DESTINATION_HALLUCINATION_MAP = {
  'usa river': null,  // null means: use extractCityFromUserMessages or let LLM handle it
  'usa river, tanzania': null,
  'usa river, arusha': null,
};

// Detect if this is a multi-city trip by checking user messages, destination, or day centroids
function detectMultiCityTrip(trip, messages = null) {
  if (!trip) return false;

  // 1. Check if user prompt requested a multi-city or country-wide trip
  if (messages && Array.isArray(messages)) {
    for (const msg of messages) {
      if (msg.role !== 'user' || !msg.content) continue;
      const text = msg.content.toLowerCase();
      if (
        text.includes('usa') || text.includes('united states') || text.includes('america') ||
        text.includes('across') || text.includes('whole') || text.includes('multi-city') ||
        text.includes('coast to coast') || text.includes('road trip')
      ) {
        return true;
      }
      // Check if user mentioned 2 or more cities
      const cities = extractAllCitiesFromUserMessages(messages);
      if (cities.length >= 2) return true;
    }
  }

  // 2. Check if destination indicates multi-city/country
  if (trip.destination) {
    const destLower = trip.destination.toLowerCase();
    if (['usa', 'us', 'united states', 'america', 'united states of america'].includes(destLower)) {
      return true;
    }
  }
  
  if (!Array.isArray(trip.days)) return false;
  
  // 3. Check if different days have stops that are far apart (>100km between day centroids)
  const dayCentroids = [];
  for (const day of trip.days) {
    if (!Array.isArray(day.stops) || day.stops.length === 0) continue;
    let lat = 0, lng = 0;
    let validCount = 0;
    for (const stop of day.stops) {
      if (typeof stop.lat === 'number' && typeof stop.lng === 'number' && !isNaN(stop.lat) && !isNaN(stop.lng)) {
        lat += stop.lat;
        lng += stop.lng;
        validCount++;
      }
    }
    if (validCount > 0) {
      dayCentroids.push({ lat: lat / validCount, lng: lng / validCount });
    }
  }
  
  // If any two day centroids are >100km apart, it's a multi-city trip
  for (let i = 0; i < dayCentroids.length; i++) {
    for (let j = i + 1; j < dayCentroids.length; j++) {
      const dist = haversineKm(dayCentroids[i].lat, dayCentroids[i].lng, dayCentroids[j].lat, dayCentroids[j].lng);
      if (dist > 100) return true;
    }
  }
  
  return false;
}

function fixHallucinatedDestination(destination, messages) {
  if (!destination) return destination;
  const destLower = destination.toLowerCase().trim();
  
  // Only fix actual hallucinations (e.g. "Usa River" in Tanzania)
  if (destLower in DESTINATION_HALLUCINATION_MAP) {
    console.log(`[server]: Detected hallucinated destination: "${destination}"`);
    // Check if user's messages mention specific cities
    const userCities = extractAllCitiesFromUserMessages(messages);
    if (userCities.length > 0) {
      return userCities[0]; // Use first mentioned city as primary destination
    }
    // Fallback: if user said "USA" or "US" etc., default to New York City
    return 'New York City';
  }
  
  return destination;
}

function extractCityFromUserMessages(messages) {
  const cities = extractAllCitiesFromUserMessages(messages);
  return cities.length > 0 ? cities[0] : null;
}

function extractAllCitiesFromUserMessages(messages) {
  if (!messages || !Array.isArray(messages)) return [];
  
  // Known major cities to detect from user messages
  const KNOWN_CITIES = [
    'New York', 'Los Angeles', 'Chicago', 'San Francisco', 'Las Vegas',
    'Miami', 'Boston', 'Seattle', 'Washington DC', 'Washington D.C.',
    'Houston', 'Dallas', 'Denver', 'Phoenix', 'Philadelphia',
    'London', 'Paris', 'Tokyo', 'Dubai', 'Singapore', 'Bangkok',
    'Rome', 'Barcelona', 'Amsterdam', 'Berlin', 'Istanbul', 'Sydney',
    'Mumbai', 'Delhi', 'Kolkata', 'Chennai', 'Bangalore', 'Bengaluru',
    'Hyderabad', 'Pune', 'Jaipur', 'Goa', 'Manali', 'Shimla',
    'LA', 'NYC', 'SF', 'DC', 'Colorado', 'Orlando', 'Nashville',
    'Portland', 'San Diego', 'New Orleans', 'Austin', 'Honolulu'
  ];
  
  const CITY_ABBREVS = { 'LA': 'Los Angeles', 'NYC': 'New York City', 'SF': 'San Francisco', 'DC': 'Washington DC' };
  const found = [];
  const seen = new Set();
  
  // Check all user messages for city mentions
  for (const msg of messages) {
    if (msg.role !== 'user' || !msg.content) continue;
    const content = msg.content.toLowerCase();
    for (const city of KNOWN_CITIES) {
      if (content.includes(city.toLowerCase())) {
        const resolved = CITY_ABBREVS[city] || city;
        if (!seen.has(resolved.toLowerCase())) {
          seen.add(resolved.toLowerCase());
          found.push(resolved);
        }
      }
    }
  }
  
  return found;
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Extract requested trip duration in days from user messages
function extractRequestedDays(messages) {
  if (!messages || !Array.isArray(messages)) return null;

  // Collect ALL candidate day counts and return the highest-priority one
  let bestDays = null;
  let bestPriority = -1; // Higher is better

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user' || !msg.content) continue;
    const text = msg.content.toLowerCase();

    // Priority 5 (HIGHEST): Explicit "Duration: X days/weeks" field
    const explicitDuration = text.match(/duration\s*:\s*(?:.*?(\d+)\s*(?:to|-|–)\s*)?\s*(\d+)\s*\+?\s*(day|week)/i);
    if (explicitDuration && bestPriority < 5) {
      const num = parseInt(explicitDuration[2], 10);
      const unit = explicitDuration[3].toLowerCase();
      bestDays = unit.startsWith('week') ? Math.min(num * 7, 14) : Math.min(num, 14);
      bestPriority = 5;
    }

    // Priority 4: "X+ weeks"
    if (bestPriority < 4) {
      const weekMatch = text.match(/(\d+)\s*\+?\s*(?:-\s*week|week|weeks|wk|wks)\b/i);
      if (weekMatch) {
        const weeks = parseInt(weekMatch[1], 10);
        if (weeks > 0 && weeks <= 4) {
          bestDays = Math.min(weeks * 7, 14);
          bestPriority = 4;
        }
      }
    }

    // Priority 3: "a week" / "one week"
    if (bestPriority < 3 && /\b(?:a|one)\s+week\b/i.test(text)) {
      bestDays = 7;
      bestPriority = 3;
    }

    // Priority 2: Range "8 to 10 days" / "8-10 days" (use upper bound)
    if (bestPriority < 2) {
      const rangeMatch = text.match(/(\d+)\s*(?:-|to|–)\s*(\d+)\s*\+?\s*days?\b/i);
      if (rangeMatch) {
        const upper = parseInt(rangeMatch[2], 10);
        if (upper > 0 && upper <= 30) {
          bestDays = Math.min(upper, 14);
          bestPriority = 2;
        }
      }
    }

    // Priority 1 (LOWEST): Standalone "X days" — but SKIP if preceded by "for" (e.g., "LA for 2 days")
    if (bestPriority < 1) {
      const allDayMatches = [...text.matchAll(/(?:^|[^a-z])(\d+)\s*\+?\s*(?:-\s*day|day|days)\b/gi)];
      for (const m of allDayMatches) {
        const matchIdx = m.index;
        const precedingText = text.substring(Math.max(0, matchIdx - 10), matchIdx).trim();
        if (/\bfor\s*$/i.test(precedingText)) continue;
        const days = parseInt(m[1], 10);
        if (days > 0 && days <= 30 && (bestDays === null || days > bestDays)) {
          bestDays = Math.min(days, 14);
          bestPriority = 1;
        }
      }
    }

    // Priority 0: "weekend"
    if (bestPriority < 0 && /\bweekend\b/i.test(text)) {
      bestDays = 2;
      bestPriority = 0;
    }
  }

  return bestDays;
}

// Enforce requested day count dynamically (extend or truncate without hardcoded templates)
function enforceRequestedDays(trip, targetDays, centerLat = 35.6895, centerLng = 139.6917, messages = null, isMultiCity = false) {
  if (!trip || !Array.isArray(trip.days) || !targetDays || targetDays <= 0) return;

  const currentCount = trip.days.length;

  if (currentCount > targetDays) {
    // Truncate cleanly if LLM generated more days than requested
    trip.days = trip.days.slice(0, targetDays);
  } else if (currentCount < targetDays) {
    // If LLM generated fewer days, dynamically expand days to reach targetDays
    const DAY_COLOR_PALETTE = ['teal', 'amber', 'violet', 'rose', 'lime'];
    const destName = trip.destination || 'Destination';

    for (let d = currentCount + 1; d <= targetDays; d++) {
      const colorHue = DAY_COLOR_PALETTE[(d - 1) % DAY_COLOR_PALETTE.length];
      let newStops = [];

      if (currentCount > 0) {
        // For multi-city trips, expand using the last destination day's stops to stay in final city
        const templateDay = isMultiCity ? trip.days[currentCount - 1] : trip.days[(d - 1) % currentCount];
        newStops = (templateDay.stops || []).map((s, idx) => ({
          ...s,
          id: `s${d}-${idx + 1}`,
          order: idx + 1
        }));
      } else {
        newStops = [
          { id: `s${d}-1`, name: `${destName} Exploration Spot - Day ${d}`, order: 1, costEstimate: 25, rationale: `Explore top attractions in ${destName}.` },
          { id: `s${d}-2`, name: `${destName} Local Sight - Day ${d}`, order: 2, costEstimate: 20, rationale: `Visit famous landmarks in ${destName}.` },
          { id: `s${d}-3`, name: `${destName} Scenic Viewpoint - Day ${d}`, order: 3, costEstimate: 15, rationale: `Enjoy evening scenery in ${destName}.` }
        ];
      }

      trip.days.push({
        id: `day-${d}`,
        dayNumber: d,
        colorHue: colorHue,
        stops: newStops
      });
    }
  }

  // Update trip metadata dynamically
  const newDayCount = trip.days.length;
  if (trip.destination) {
    const slug = trip.destination.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    trip.id = `trip-${slug}-${newDayCount}d`;
    if (!trip.title || trip.title.includes('Adventure')) {
      trip.title = `${trip.destination} ${newDayCount}-Day Exploration`;
    }
  }
}

// Extract budget details from user messages
function extractUserBudget(messages) {
  if (!messages || !Array.isArray(messages)) return null;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user' || !msg.content) continue;
    const text = msg.content;

    // 1. Range per day: "$80-120 per day", "$50-$80/day", "Budget: $80–120"
    // Require a $ sign OR the word 'budget' to prevent matching "8 to 10 days"
    const dailyRangeMatch = text.match(/(?:\$|budget.*?)(\d+)\s*(?:[–-]|to)\s*\$?(\d+)\s*(?:\/|\s*per|\s*a)?\s*(?:day|daily)?/i);
    if (dailyRangeMatch) {
      // Avoid matching "8 to 10 days" if it happens to be caught by 'budget' prefix but has 'days' suffix
      const contextStr = text.substring(dailyRangeMatch.index, dailyRangeMatch.index + 20).toLowerCase();
      if (!contextStr.includes('day') && contextStr.includes('days')) {
         // Skip, it's talking about a day range not budget range
      } else {
        const min = parseInt(dailyRangeMatch[1], 10);
        const max = parseInt(dailyRangeMatch[2], 10);
        if (min > 0 && max > min && max <= 5000) {
          const avgDaily = Math.round((min + max) / 2);
          return { isDaily: true, dailyRate: avgDaily, minRate: min, maxRate: max };
        }
      }
    }

    // 2. Single rate per day: "$100/day", "$80 per day", "$150 a day", "daily budget: $80"
    const singleDailyMatch = text.match(/(?:daily\s+budget|budget)?\s*\$?(\d+)\s*(?:\/|\s*per|\s*a)\s*day/i);
    if (singleDailyMatch) {
      const rate = parseInt(singleDailyMatch[1], 10);
      if (rate > 0 && rate <= 10000) {
        return { isDaily: true, dailyRate: rate, minRate: rate, maxRate: rate };
      }
    }

    // 3. Explicit total budget: "budget of $1500", "total budget: $2000", "budget $2000"
    const totalMatch = text.match(/(?:total\s+budget|budget\s+of|budget:?\s*\$?)\s*\$?(\d+)\b/i);
    if (totalMatch) {
      const total = parseInt(totalMatch[1], 10);
      if (total > 50) {
        return { isDaily: false, totalBudget: total };
      }
    }
  }

  return null;
}

// Calculate total budget and sync budget items appropriately
function calculateAndEnforceTripBudget(trip, messages) {
  if (!trip || !Array.isArray(trip.days) || trip.days.length === 0) return;

  const totalDays = trip.days.length;
  const userBudget = extractUserBudget(messages);

  let targetTotalBudget = 0;
  let dailyRate = 100; // default USD daily rate

  if (userBudget) {
    if (userBudget.isDaily) {
      dailyRate = userBudget.dailyRate;
      targetTotalBudget = dailyRate * totalDays;
    } else if (userBudget.totalBudget) {
      targetTotalBudget = userBudget.totalBudget;
      dailyRate = Math.round(targetTotalBudget / totalDays);
    }
  } else {
    // If user didn't specify budget, check if LLM returned a daily rate in trip.budget by mistake (< 200 for multi-day)
    if (typeof trip.budget === 'number' && trip.budget > 0 && trip.budget < 200 && totalDays > 1) {
      dailyRate = trip.budget;
      targetTotalBudget = dailyRate * totalDays;
    } else if (typeof trip.budget === 'number' && trip.budget >= 200) {
      targetTotalBudget = trip.budget;
      dailyRate = Math.round(targetTotalBudget / totalDays);
    } else {
      dailyRate = 100;
      targetTotalBudget = dailyRate * totalDays;
    }
  }

  // Ensure trip.budget is set to the calculated total budget
  trip.budget = targetTotalBudget;

  // Calculate sum of activity costEstimates across all stops
  let activityTotal = 0;
  trip.days.forEach(day => {
    (day.stops || []).forEach(stop => {
      activityTotal += Number(stop.costEstimate) || 0;
    });
  });

  // Calculate proportioned budget items so sum(budgetItems) <= trip.budget
  // 45% Accommodation, 30% Food & dining, Activity entries, remaining for Transport
  const accomAmount = Math.round(targetTotalBudget * 0.45);
  const foodAmount = Math.round(targetTotalBudget * 0.30);
  const activityAmount = activityTotal > 0 ? activityTotal : Math.round(targetTotalBudget * 0.15);
  const transportAmount = Math.max(0, targetTotalBudget - (accomAmount + foodAmount + activityAmount));

  trip.budgetItems = [
    { name: `Accommodation (${totalDays} night${totalDays > 1 ? 's' : ''})`, amount: accomAmount, color: '#2dd4bf' },
    { name: 'Food & dining', amount: foodAmount, color: '#f59e0b' },
    { name: 'Activity entries', amount: activityAmount, color: '#f43f5e' },
    { name: 'Local transport', amount: transportAmount, color: '#84cc16' }
  ];

  console.log(`[server]: Enforced trip budget for ${totalDays} days -> Total Budget: $${trip.budget} ($${dailyRate}/day). Total Spend: $${accomAmount + foodAmount + activityAmount + transportAmount}`);
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

