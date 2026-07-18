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

You communicate with the frontend using a strictly structured JSON response. Your output MUST be a valid JSON object. Do not include any markdown framing outside of the JSON itself (do not wrap the JSON response in \`\`\`json ... \`\`\` code blocks). 

The JSON response MUST have exactly this structure:
{
  "message": "Your text response to the user.",
  "trip": <TripObject or null>,
  "isComplete": <boolean>,
  "mapCenter": <MapCenterObject or null>
}

Guidelines for the keys:
1. "message": Use this to chat with the user, ask questions, or briefly explain what changes you made. Do NOT use this field to print the detailed day-by-day itinerary or the full list of stops. The user has a visual itinerary list and map on the right side of their screen that automatically loads the trip details from the 'trip' field. Keep this text conversational, warm, and brief.
2. "isComplete": Set to false while interviewing the user or gathering details. Set to true once the itinerary has been generated or updated.
3. "trip": Set to null if the itinerary is not yet generated. Once the itinerary is ready, provide a TripObject. If the user edits the trip, provide the updated TripObject.
4. "mapCenter": Set this whenever the user wants to look at a city, place, or landmark, or when starting/updating a trip in a new city. This controls and loads the map of that place for the user.

A <MapCenterObject> MUST follow this structure:
{
  "lat": 48.8566, // Latitude coordinate as a float
  "lng": 2.3522, // Longitude coordinate as a float
  "zoom": 12 // Zoom level as a number (e.g., 12 for a city view, 14-15 for neighborhood/stops view, 9-10 for large regions)
}

A <TripObject> MUST strictly follow this structure:
{
  "id": "A unique trip ID string (e.g., 'trip-kyoto-3d')",
  "title": "A short, catchy title (e.g., 'Kyoto Sightseeing & Culture Tour')",
  "destination": "The name of the destination city/town/region (e.g., 'Manali', 'Paris', 'Tokyo')",
  "budget": 30000, // Total budget in JPY or local currency as an integer
  "days": [
    {
    "id": "day-1", // Unique day ID
      "dayNumber": 1, // 1-indexed day number
      "colorHue": "teal", // MUST be one of: 'teal', 'amber', 'violet', 'rose', 'lime'. Each day in a trip must have a UNIQUE colorHue.
      "stops": [
        {
          "id": "s1-1", // Unique stop ID
          "name": "Senso-ji Temple", // Full name of the place
          "lat": 35.7147, // Accurate latitude coordinate (float)
          "lng": 139.7967, // Accurate longitude coordinate (float)
          "timeEstimate": "09:00 AM - 11:00 AM", // Estimated time window
          "costEstimate": 0, // Integer cost, 0 if free
          "rationale": "One sentence explaining why this spot is perfect for their preferences.",
          "order": 1 // 1-indexed order of the stop in the day
        }
      ]
    }
  ]
}

Behavior Guidelines:
- Human Tone: You must sound like a real, enthusiastic human travel buddy or local guide. Speak warmly and naturally. Avoid generic robotic AI preambles or transition phrases (never say 'As an AI...', 'Certainly! I can help you with...', 'Based on the options...', or 'Here is your updated itinerary:'). Keep it real, engaging, and friendly (e.g., 'Oh, nice choice!', 'Paris is magical. Let\\'s make this trip perfect.', 'Got that adjusted for you!').
- One Question at a Time: When interviewing the user to gather travel details (duration, budget, pace, interests, companions, etc.), you MUST ask exactly ONE clarifying question at a time. Never ask multiple questions in a single response or ask them all at once. Keep the pace conversational.
- No Whole Itinerary in Message: Do not list or print the detailed day-by-day itinerary or individual stops in the 'message' field. Instead, briefly summarize the highlights, tell them you\\'ve generated/updated the itinerary, and guide them to check the interactive map and plan panels on the right (e.g., 'I\\'ve mapped out a wonderful plan for you! Take a look at the interactive map and plan on the right. Let me know what you\\'d like to tweak!').
- CRITICAL: No Star Signs (* or **): You must NEVER use the asterisk character '*' or '**' anywhere in your response (including the 'message' field). Do not use them for bolding, bullet points, italics, or formatting. If you want to write a list, use plain numbers (1., 2.) or simple dashes (-), but never use star symbols or asterisks.
- CRITICAL COORDINATES: You MUST provide realistic and accurate real-world latitude and longitude coordinates for all stops matching the EXACT city requested by the user. 
  - DO NOT blindly copy the examples below for other cities. If the user asks for Manali, use coordinates in Manali. If the user asks for Mumbai, use coordinates in Mumbai. 
  - Hallucinating or reusing coordinates from other cities (like placing a Manali temple in Tokyo) will completely break the map visualization.
  - Examples of city centers (do NOT use these unless the user is visiting this specific city):
    - Paris: lat 48.8566, lng 2.3522
    - London: lat 51.5074, lng -0.1278
    - Tokyo: lat 35.6762, lng 139.6503
    - Kyoto: lat 35.0116, lng 135.7681
    - New York: lat 40.7128, lng -74.0060
    - Kolkata: lat 22.5726, lng 88.3639
    - Manali: lat 32.2396, lng 77.1887
- Iterative Edits: If the user provides modifications (e.g. "remove Takeshita Street", "make Day 2 more relaxed", "add a sushi lunch on Day 1"), modify the TripObject accordingly, return the complete updated TripObject in the 'trip' field, explain the changes in the 'message', keep 'isComplete' as true, and optionally provide a new 'mapCenter' if the map needs to focus on a different area.
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
    let retries = 3;
    while (retries > 0) {
      try {
        response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'nvidia/llama-3.3-nemotron-super-49b-v1',
            messages: nimMessages,
            response_format: { type: 'json_object' },
            temperature: 0.5,
            max_tokens: 3000
          })
        });
        if (response.ok) break;
        if (response.status === 504 || response.status === 502 || response.status === 500) {
          retries--;
          if (retries === 0) throw new Error(`NVIDIA NIM returned error: ${response.status}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          const errText = await response.text();
          throw new Error(`NVIDIA NIM returned error: ${response.status} - ${errText}`);
        }
      } catch (err) {
        if (retries === 1) throw err;
        retries--;
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    const data = await response.json();
    let rawText = data.choices[0].message.content.trim();

    // Parse the JSON response
    let jsonResponse;
    try {
      jsonResponse = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Failed to parse NIM JSON response:', rawText);
      // Clean up markdown code fence wrapping if model ignored instructions
      const cleanText = rawText.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      jsonResponse = JSON.parse(cleanText);
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

    // Geocode stops securely within a bounding box centered on mapCenter to ensure real targets
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days) && jsonResponse.mapCenter) {
      const centerLat = jsonResponse.mapCenter.lat;
      const centerLng = jsonResponse.mapCenter.lng;
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
            coords = await fetchCoords(url);

            // Attempt 2: If clean query fails, try clean query + cityName bounded by viewbox
            if (!coords && cityName) {
              const queryWithCity = `${cleanQuery}, ${cityName}`;
              url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryWithCity)}&format=geojson&limit=1&viewbox=${viewbox}&bounded=1`;
              coords = await fetchCoords(url);
            }

            // Attempt 3: If still fails, try clean query + cityName without bounding box restrictions
            if (!coords && cityName) {
              const queryWithCity = `${cleanQuery}, ${cityName}`;
              url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryWithCity)}&format=geojson&limit=1`;
              coords = await fetchCoords(url);
            }

            // Attempt 4: Last fallback, query original name in viewbox
            if (!coords) {
              url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(stop.name)}&format=geojson&limit=1&viewbox=${viewbox}&bounded=1`;
              coords = await fetchCoords(url);
            }

            if (coords) {
              stop.lng = coords.lng;
              stop.lat = coords.lat;
              chatGeocodeCache.set(cacheKey, { lng: coords.lng, lat: coords.lat });
            }

            await new Promise(resolve => setTimeout(resolve, 1000)); // Respect limits
          } catch (err) {
            console.error('Failed to geocode stop:', stop.name, err);
          }
        }
      }
    }

    // POST-PROCESSING: Remove outlier stops that are too far from the day's centroid
    // This catches cases where the AI places a stop 100-170km away from other stops in the same day
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      const MAX_DISTANCE_KM = 30; // Max allowed distance from day centroid

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
          day.stops = validStops;
          // Re-index order
          day.stops.forEach((s, i) => { s.order = i + 1; });
        }
      }
    }

    return res.status(200).json(jsonResponse);

  } catch (error) {
    console.error('NIM chat routing error:', error);
    return res.status(500).json({ error: error.message });
  }
});

// Helper to fetch coordinates from Nominatim safely with a timeout
async function fetchCoords(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
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
    console.error('fetchCoords failed for URL:', url, err.message);
  }
  return null;
}

// Clean query strings to improve OSM geocoding hits
function cleanQueryForGeocoding(name) {
  if (!name) return '';
  // Split by common delimiters and take the first part
  let query = name.split(/&| and | with | at |-|–|,/i)[0].trim();
  // Remove common fluff words at the end
  query = query.replace(/\b(sightseeing|tour|visit|explore|view|sunset view|sunrise view|shopping|lunch|dinner|breakfast|cafe|restaurant|hotel|stay|resort|hills|mountains|market|local market)\b/gi, '').trim();
  // If the query becomes too empty, fall back to the original name
  return query.length > 2 ? query : name;
}

export default router;
