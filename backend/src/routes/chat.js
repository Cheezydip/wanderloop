import { Router } from 'express';
import { geocodeLocation, lookupKnownLandmark } from '../utils/geocoder.js';
import { geocodeRealStop, fetchRealAttractionsForCity } from '../utils/realPlacesScout.js';

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



const WORD_TO_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, an: 1, another: 1 };

function normalizeStopName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/^(the|a|an)\s+/i, '')
    .replace(/\s+(in|at|near|of)\s+.*$/i, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDuplicateStop(stopA, stopB) {
  if (!stopA || !stopB) return false;
  const nameA = (stopA.name || '').toLowerCase().trim();
  const nameB = (stopB.name || '').toLowerCase().trim();
  if (!nameA || !nameB) return false;

  if (nameA === nameB) return true;

  const normA = normalizeStopName(nameA);
  const normB = normalizeStopName(nameB);
  if (normA && normB && normA === normB) return true;

  if (normA.length >= 5 && normB.length >= 5) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }

  if (typeof stopA.lat === 'number' && typeof stopA.lng === 'number' &&
      typeof stopB.lat === 'number' && typeof stopB.lng === 'number' &&
      stopA.lat !== 0 && stopA.lng !== 0 && stopB.lat !== 0 && stopB.lng !== 0) {
    const dist = haversineKm(stopA.lat, stopA.lng, stopB.lat, stopB.lng);
    if (dist < 0.1) {
      const firstA = normA.split(' ')[0];
      const firstB = normB.split(' ')[0];
      if (firstA === firstB || stopA.category === stopB.category) {
        return true;
      }
    }
  }
  return false;
}

function deduplicateTripStops(trip) {
  if (!trip || !Array.isArray(trip.days)) return trip;
  const seenStops = [];

  for (const day of trip.days) {
    if (!Array.isArray(day.stops)) continue;
    const uniqueStops = [];

    for (const stop of day.stops) {
      const isDup = seenStops.some(existing => isDuplicateStop(stop, existing));
      if (!isDup) {
        seenStops.push(stop);
        uniqueStops.push(stop);
      } else {
        console.log(`[server]: Deduplication: Removed duplicate stop "${stop.name}" from Day ${day.dayNumber || day.id}`);
      }
    }

    // Zero-Empty-Day Guard: Never allow deduplication to wipe out a day's stops!
    if (uniqueStops.length >= 2) {
      day.stops = uniqueStops;
    } else if (uniqueStops.length === 1 && day.stops.length > 1) {
      const secondStop = day.stops.find(s => s.name !== uniqueStops[0].name) || day.stops[1];
      day.stops = [uniqueStops[0], secondStop].filter(Boolean);
    } else if (uniqueStops.length === 0 && day.stops.length > 0) {
      console.warn(`[server]: Deduplication would leave Day ${day.dayNumber || day.id} with 0 stops. Retaining original stops.`);
    }
  }

  reindexTripDaysAndStops(trip);
  return trip;
}

const DAY_COLOR_PALETTE = ['teal', 'amber', 'violet', 'rose', 'lime', 'cyan', 'orange', 'purple', 'pink', 'emerald'];
const TIME_SLOTS = [
  '09:00 AM - 11:00 AM',
  '11:30 AM - 01:30 PM',
  '02:30 PM - 04:30 PM',
  '05:00 PM - 07:00 PM',
  '07:30 PM - 09:30 PM',
  '10:00 PM - 11:30 PM'
];

function reindexTripDaysAndStops(trip) {
  if (!trip || !Array.isArray(trip.days)) return;

  trip.days.forEach((day, dIdx) => {
    const dayNum = dIdx + 1;
    day.dayNumber = dayNum;
    day.id = `day-${dayNum}`;
    day.colorHue = DAY_COLOR_PALETTE[dIdx % DAY_COLOR_PALETTE.length];
    if (Array.isArray(day.stops)) {
      day.stops.forEach((stop, sIdx) => {
        stop.order = sIdx + 1;
        stop.id = `s${dayNum}-${sIdx + 1}`;
        if (!stop.timeEstimate || stop.timeEstimate.includes('undefined')) {
          stop.timeEstimate = TIME_SLOTS[Math.min(sIdx, TIME_SLOTS.length - 1)];
        }
      });
    }
  });
}

function clusterAttractionsForDays(attractions, numDays, stopsPerDay = 4) {
  const clusteredDays = [];
  let remaining = [...attractions];
  
  for (let d = 0; d < numDays; d++) {
    if (remaining.length === 0) break;
    const seed = remaining.shift();
    const currentCluster = [seed];
    
    while (currentCluster.length < stopsPerDay && remaining.length > 0) {
      remaining.sort((a, b) => haversineKm(seed.lat, seed.lng, a.lat, a.lng) - haversineKm(seed.lat, seed.lng, b.lat, b.lng));
      currentCluster.push(remaining.shift());
    }
    clusteredDays.push(currentCluster);
  }
  
  while (clusteredDays.length < numDays) {
    clusteredDays.push([]);
  }
  
  return clusteredDays;
}

function assignStopsToNearestDays(orphanStops, remainingDays) {
  if (!Array.isArray(orphanStops) || orphanStops.length === 0 || !Array.isArray(remainingDays) || remainingDays.length === 0) {
    return;
  }

  for (const orphan of orphanStops) {
    // 1. Deduplication check: check if already exists in any remaining day
    const alreadyExists = remainingDays.some(d =>
      (d.stops || []).some(s => isDuplicateStop(orphan, s))
    );
    if (alreadyExists) {
      console.log(`[server]: Proximity assignment: Skipping duplicate orphan "${orphan.name}"`);
      continue;
    }

    // 2. Proximity calculation
    let bestDay = null;
    let minScore = Infinity;

    const hasValidCoords = typeof orphan.lat === 'number' && typeof orphan.lng === 'number' && orphan.lat !== 0 && orphan.lng !== 0;

    if (hasValidCoords) {
      for (const day of remainingDays) {
        const validStops = (day.stops || []).filter(s => typeof s.lat === 'number' && typeof s.lng === 'number' && s.lat !== 0 && s.lng !== 0);
        if (validStops.length === 0) {
          const score = 50 + (day.stops?.length || 0) * 10;
          if (score < minScore) {
            minScore = score;
            bestDay = day;
          }
          continue;
        }

        const distances = validStops.map(s => haversineKm(orphan.lat, orphan.lng, s.lat, s.lng));
        const minDist = Math.min(...distances);
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        const capacityPenalty = Math.max(0, ((day.stops?.length || 0) - 3) * 0.8);
        const score = (minDist * 0.7) + (avgDist * 0.3) + capacityPenalty;

        if (score < minScore) {
          minScore = score;
          bestDay = day;
        }
      }
    } else {
      let minStops = Infinity;
      for (const day of remainingDays) {
        const count = day.stops?.length || 0;
        if (count < minStops) {
          minStops = count;
          bestDay = day;
        }
      }
    }

    if (!bestDay) {
      bestDay = remainingDays[0];
    }

    if (!Array.isArray(bestDay.stops)) bestDay.stops = [];
    bestDay.stops.push(orphan);

    const coordsCount = bestDay.stops.filter(s => typeof s.lat === 'number' && typeof s.lng === 'number' && s.lat !== 0 && s.lng !== 0).length;
    if (coordsCount >= 2) {
      bestDay.stops = optimizeDayStopsRoute(bestDay.stops);
    }
  }

  reindexTripDaysAndStops({ days: remainingDays });
}

function parseTripModificationIntent(userPrompt) {
  const p = userPrompt.toLowerCase().trim();

  // 1. EXTEND_TO_CITY: "add 2 days to Amsterdam", "extend to Rome for 3 days", "also visit London"
  const extendCityMatch = p.match(/(?:add|include|extend|also\s+visit|then\s+go\s+to|also\s+go\s+to|continue\s+to)\s+(?:(\d+|one|two|three|four|five)\s+(?:more\s+)?days?\s+(?:to|in|for|at)\s+)([a-zA-Z][a-zA-Z\s]{1,40})/i)
    || p.match(/(?:add|include|extend|also\s+visit|then\s+go\s+to|also\s+go\s+to|continue\s+to)\s+(?:(?:a|some|few)\s+)?(?:days?\s+(?:to|in|for|at)\s+)([a-zA-Z][a-zA-Z\s]{1,40})/i)
    || p.match(/(?:extend|continue)\s+(?:the\s+)?(?:trip\s+)?(?:to|with|into)\s+([a-zA-Z][a-zA-Z\s]{1,40})(?:\s+for\s+(\d+|one|two|three|four|five)\s+days?)?/i)
    || p.match(/(?:add|include)\s+([a-zA-Z][a-zA-Z\s]{1,40})\s+(?:for|with)\s+(\d+|one|two|three|four|five)\s+days?/i)
    || p.match(/(?:also|then)\s+(?:visit|go\s+to|explore|head\s+to)\s+([a-zA-Z][a-zA-Z\s]{1,40})(?:\s+for\s+(\d+|one|two|three|four|five)\s+days?)?/i);

  if (extendCityMatch) {
    let cityName = null;
    let dayCount = 2;
    const WORD_MAP = { one: 1, two: 2, three: 3, four: 4, five: 5 };
    const groups = Array.from(extendCityMatch).slice(1).filter(Boolean);
    for (const g of groups) {
      const cleaned = g.trim();
      if (/^\d+$/.test(cleaned)) dayCount = parseInt(cleaned);
      else if (WORD_MAP[cleaned.toLowerCase()]) dayCount = WORD_MAP[cleaned.toLowerCase()];
      else if (/^[a-zA-Z\s]+$/.test(cleaned) && cleaned.length > 1) cityName = cleaned.trim();
    }
    if (cityName) {
      cityName = cityName.replace(/\s+(for|with|to|in|at)\s*$/i, '').trim();
      return { intent: 'EXTEND_TO_CITY', newCity: cityName, extendDays: Math.min(Math.max(dayCount, 1), 7) };
    }
  }

  // 2. DELETE_DAY_AND_REDISTRIBUTE: "remove day 2 and add its stops to other days"
  const deleteDayAndRedistributeMatch = p.match(/(?:remove|delete|drop|cut)\s+(?:the\s+)?day\s*(\d+|one|two|three|four|five|six|seven|first|second|third|fourth|fifth|last).*?(?:add|distribute|move|put|assign|spread|merge|shift|keep).*?(?:stops?|places?|activities?|attractions?)/i)
    || p.match(/(?:add|distribute|move|put|assign|spread|merge|shift|keep).*?(?:stops?|places?|activities?|attractions?).*?(?:from|of|on)\s+(?:the\s+)?(?:deleted|removed)?\s*day\s*(\d+|one|two|three|four|five|six|seven|first|second|third|fourth|fifth|last)/i);
  if (deleteDayAndRedistributeMatch) {
    const raw = deleteDayAndRedistributeMatch[1];
    const ordinalMap = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, last: -1 };
    const dayNum = parseInt(raw) || ordinalMap[raw.toLowerCase()] || WORD_TO_NUM[raw.toLowerCase()] || 1;
    return { intent: 'DELETE_DAY_AND_REDISTRIBUTE', targetDay: dayNum };
  }

  // 3. DELETE_DAY (without redistribution): "remove day 2", "delete day 3"
  const deleteSingleDayMatch = p.match(/^(?:remove|delete|drop|cut|take out)\s+(?:the\s+)?day\s*(\d+|one|two|three|four|five|six|seven|first|second|third|fourth|fifth|last)\s*(?:from\s+(?:the\s+)?(?:trip|itinerary))?$/i)
    || p.match(/^(?:remove|delete|drop|cut|take out)\s+(?:the\s+)?(first|second|third|fourth|fifth|last)\s+day\s*(?:from\s+(?:the\s+)?(?:trip|itinerary))?$/i);
  if (deleteSingleDayMatch) {
    const raw = deleteSingleDayMatch[1];
    const ordinalMap = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, last: -1 };
    const dayNum = parseInt(raw) || ordinalMap[raw.toLowerCase()] || WORD_TO_NUM[raw.toLowerCase()] || 1;
    return { intent: 'DELETE_DAY', targetDay: dayNum };
  }

  // 4. CLEAR_DAY_STOPS: "clear all stops on day 2"
  const clearDayMatch = p.match(/(?:remove|clear|delete|drop)\s+(?:all\s+)?(?:stops?|places?)\s+(?:from|on|in)\s+day\s*(\d+)/i)
    || p.match(/(?:clear|empty)\s+day\s*(\d+)/i);
  if (clearDayMatch) {
    return { intent: 'CLEAR_DAY_STOPS', targetDay: parseInt(clearDayMatch[1]) };
  }

  // 5. INSERT_DAY / ADD_DAY: "add a day", "insert a day before day 2"
  const insertBeforeMatch = p.match(/(?:add|insert|put|include)\s+(?:(?:a\s+)?day|(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days)\s+before\s+day\s*(\d+)/i)
    || p.match(/(?:add|insert|put|include)\s+(?:(?:a\s+)?day|(\d+|one|two|three|four|five)\s+days)\s+before\s+(?:the\s+)?(first|second|third|fourth|fifth)\s+day/i);
  const insertAfterMatch = p.match(/(?:add|insert|put|include)\s+(?:(?:a\s+)?day|(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days)\s+after\s+day\s*(\d+)/i)
    || p.match(/(?:add|insert|put|include)\s+(?:(?:a\s+)?day|(\d+|one|two|three|four|five)\s+days)\s+after\s+(?:the\s+)?(first|second|third|fourth|fifth)\s+day/i);
  const addDayMatch = p.match(/(?:add|include|insert)\s+(?:(a|another|one|1|\d+|two|three|four|five|six|seven|eight|nine|ten)\s+)?(?:more\s+)?days?(?:\s+to\s+my\s+trip)?$/i);

  const ordinalMap = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5 };
  if (insertBeforeMatch) {
    const rawNum = insertBeforeMatch[1];
    const num = rawNum ? (parseInt(rawNum) || WORD_TO_NUM[rawNum.toLowerCase()] || 1) : 1;
    const rawDay = insertBeforeMatch[2];
    const dayNum = parseInt(rawDay) || ordinalMap[rawDay.toLowerCase()] || 1;
    return { intent: 'INSERT_DAY', targetPos: Math.max(1, dayNum), numDays: num };
  }
  if (insertAfterMatch) {
    const rawNum = insertAfterMatch[1];
    const num = rawNum ? (parseInt(rawNum) || WORD_TO_NUM[rawNum.toLowerCase()] || 1) : 1;
    const rawDay = insertAfterMatch[2];
    const dayNum = parseInt(rawDay) || ordinalMap[rawDay.toLowerCase()] || 1;
    return { intent: 'INSERT_DAY', targetPos: dayNum + 1, numDays: num };
  }
  if (addDayMatch) {
    const rawNum = addDayMatch[1];
    const num = rawNum ? (parseInt(rawNum) || WORD_TO_NUM[rawNum.toLowerCase()] || 1) : 1;
    return { intent: 'INSERT_DAY', targetPos: 999, numDays: num };
  }

  // 6. ADD_STOP: "add [place] to day [N]" or "add [place]"
  const addStopMatch = p.match(/(?:add|include|put|insert)\s+(?:a\s+)?(.+?)(?:\s+(?:to|on|in)\s+day\s*(\d+))?$/i)
    || p.match(/(?:add|include|put|insert)\s+(?:a\s+)?(.+?)(?:\s+(?:to|on|in)\s+day\s*(\d+))/i);
  if (addStopMatch) {
    const placeName = addStopMatch[1].replace(/\s+(?:to|on|in)\s+day\s*\d+$/i, '').trim();
    const dayNum = addStopMatch[2] ? parseInt(addStopMatch[2]) : null;
    if (!/^\d+\s+(?:more\s+)?days?(?:\s+.*)?$/i.test(placeName) && !/^(a|another|one)\s+day$/i.test(placeName) && placeName.length > 1 && placeName.length < 120) {
      return { intent: 'ADD_STOP', placeName, targetDay: dayNum };
    }
  }

  // 7. SWAP_STOP: "swap [A] with [B]"
  const swapMatch = p.match(/(?:swap|replace|change)\s+(.+?)\s+(?:with|to|for)\s+(.+)/i);
  if (swapMatch) {
    return { intent: 'SWAP_STOP', oldName: swapMatch[1].trim(), newName: swapMatch[2].trim() };
  }

  // 8. REMOVE_STOPS: "remove [place1] and [place2]"
  const removeStopMatch = p.match(/(?:remove|delete|drop|take out)\s+(?:the\s+)?(.+?)(?:\s+from\s+day\s*(\d+))?$/i);
  if (removeStopMatch) {
    const rawTarget = removeStopMatch[1].trim();
    const dayNum = removeStopMatch[2] ? parseInt(removeStopMatch[2]) : null;

    if (/^day\s*\d+$/i.test(rawTarget)) {
      const dNum = parseInt(rawTarget.replace(/\D/g, ''));
      return { intent: 'DELETE_DAY', targetDay: dNum };
    }

    const parts = rawTarget
      .split(/\s+(?:and|&)\s+|,\s*/i)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !/^(the|a|an)$/i.test(s));

    if (parts.length > 0 && !/^\d+\s+days?$/i.test(rawTarget)) {
      return { intent: 'REMOVE_STOPS', targets: parts, targetDay: dayNum };
    }
  }

  return null;
}

router.post('/chat', async (req, res) => {
  try {
    const { messages, currentTrip } = req.body || {};

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://127.0.0.1:5001/api/v1/generate-trip';

    let jsonResponse = null;
    let usedAiMicroservice = false;

    // 1. PRIMARY: Forward all requests to Wanderloop AI Microservice first
    try {
      console.log(`[server]: Forwarding request to Wanderloop AI Microservice at ${AI_SERVICE_URL}...`);
      const aiRes = await fetch(AI_SERVICE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages, currentTrip }),
        signal: AbortSignal.timeout(90000)
      });

      if (aiRes.ok) {
        jsonResponse = await aiRes.json();
        usedAiMicroservice = true;
        console.log('[server]: Received response from AI Microservice — will run post-processing pipeline.');
      }
    } catch (aiErr) {
      console.warn('[server]: AI Microservice connection failed, attempting deterministic fallback...', aiErr.message);
    }

    // 2. SECONDARY: Deterministic Local Fallback Handler (only if AI Microservice offline/failed)
    if (!jsonResponse) {
      const latestUserMsg = messages[messages.length - 1]?.content || '';
      const modIntent = (currentTrip && Array.isArray(currentTrip.days) && currentTrip.days.length > 0)
        ? parseTripModificationIntent(latestUserMsg)
        : null;

      if (modIntent) {
        console.log(`[server]: Executing deterministic fallback modification intent: ${modIntent.intent}`);
        const trip = JSON.parse(JSON.stringify(currentTrip));
        let replyMessage = '';

        // Determine center coordinates of current trip
        let centerLat = 0, centerLng = 0, validCount = 0;
        for (const d of trip.days) {
          for (const s of (d.stops || [])) {
            if (s.lat && s.lng && s.lat !== 0 && s.lng !== 0) {
              centerLat += s.lat; centerLng += s.lng; validCount++;
            }
          }
        }
        const tripCenterLat = validCount > 0 ? centerLat / validCount : 48.8566;
        const tripCenterLng = validCount > 0 ? centerLng / validCount : 2.3522;

        // ── ADD_STOP: Real place lookup with multi-step commute and guidance ──
        if (modIntent.intent === 'ADD_STOP') {
          const targetDayIdx = modIntent.targetDay ? Math.min(Math.max(modIntent.targetDay - 1, 0), trip.days.length - 1) : 0;
          const targetDay = trip.days[targetDayIdx];

          const realPlace = await geocodeRealStop(modIntent.placeName, trip.destination, tripCenterLat, tripCenterLng);
          const isDup = targetDay.stops.some(s => isDuplicateStop(realPlace, s));

          if (isDup) {
            return res.status(200).json({
              message: `"${realPlace.name}" is already on Day ${targetDay.dayNumber}! Would you like to add it to a different day instead?`,
              trip,
              isComplete: true,
              mapCenter: null
            });
          }

          const prevStop = targetDay.stops.length > 0 ? targetDay.stops[targetDay.stops.length - 1] : null;
          let distKm = 0, travelMins = 15, travelMode = 'local departure', transitDesc = '';
          if (prevStop && prevStop.lat && prevStop.lng && realPlace.lat && realPlace.lng) {
            distKm = haversineKm(prevStop.lat, prevStop.lng, realPlace.lat, realPlace.lng);
            if (distKm <= 1.5) {
              travelMins = Math.max(8, Math.round(distKm * 14));
              travelMode = 'scenic walk';
              transitDesc = `A pleasant ${travelMins} min walk (~${distKm.toFixed(1)} km) from ${prevStop.name}`;
            } else if (distKm <= 15) {
              travelMins = Math.max(10, Math.round(distKm * 2.8 + 6));
              travelMode = 'cab / taxi';
              transitDesc = `Approx ${travelMins} mins by cab/auto (~${distKm.toFixed(1)} km) via main road from ${prevStop.name}`;
            } else {
              travelMins = Math.max(30, Math.round(distKm * 2.4 + 10));
              travelMode = 'scenic drive';
              transitDesc = `A scenic ${travelMins} min drive (~${distKm.toFixed(1)} km) from ${prevStop.name}`;
            }
          } else {
            transitDesc = `Morning departure from your stay in ${trip.destination} (~15-20 min ride)`;
          }

          const newOrder = targetDay.stops.length + 1;
          const timeSlot = TIME_SLOTS[Math.min(newOrder - 1, TIME_SLOTS.length - 1)];
          const step1 = `Step 1 (Transit): ${transitDesc}.`;
          const step2 = `Step 2 (Experience): Explore ${realPlace.name} during ${timeSlot} (~2 hours of sightseeing and photo stops).`;
          const step3 = `Step 3 (Refreshments): Sample local cafes and food vendors nearby for regional delicacies.`;

          targetDay.stops.push({
            id: `s${targetDay.dayNumber}-${newOrder}`,
            name: realPlace.name,
            lat: realPlace.lat,
            lng: realPlace.lng,
            category: realPlace.category,
            timeEstimate: timeSlot,
            costEstimate: realPlace.costEstimate || 10,
            order: newOrder,
            rationale: `${step1} ${step2} ${step3}`
          });

          targetDay.stops = optimizeDayStopsRoute(targetDay.stops);
          deduplicateTripStops(trip);
          calculateAndEnforceTripBudget(trip, messages);

          const fromText = prevStop ? `from **${prevStop.name}**` : `from your accommodation in ${trip.destination}`;
          const distInfo = distKm > 0 ? `approx **${distKm.toFixed(1)} km** (~**${travelMins} mins** via ${travelMode})` : `~**${travelMins} mins** via ${travelMode}`;

          replyMessage = `I've added **${realPlace.name}** to **Day ${targetDay.dayNumber}**! Here is the complete step-by-step travel plan:\n\n` +
            `• **Step 1 (Travel & Transit):** Departing ${fromText}, it is ${distInfo}. ${transitDesc}.\n` +
            `• **Step 2 (What to Experience & Duration):** Scheduled for **${timeSlot}** (~2 hours). Enjoy exploring the highlights, views, and activities at ${realPlace.name}.\n` +
            `• **Step 3 (Food & Local Recommendations):** Stop by authentic cafes and food vendors located right by ${realPlace.name} for refreshments before continuing your day.\n\n` +
            `All map coordinates and route schedules have been refreshed.`;
          return res.status(200).json({
            message: replyMessage,
            trip,
            isComplete: true,
            mapCenter: { lat: realPlace.lat, lng: realPlace.lng, zoom: 14 }
          });
        }

        // ── INSERT_DAY: Discover REAL attractions from map & query ──
        if (modIntent.intent === 'INSERT_DAY') {
          const numDaysToAdd = modIntent.numDays || 1;
          const allStops = trip.days.flatMap(d => d.stops || []);
          const realAttractions = await fetchRealAttractionsForCity(trip.destination, allStops, 4 * numDaysToAdd, tripCenterLat, tripCenterLng);
          const clusteredAttractions = clusterAttractionsForDays(realAttractions, numDaysToAdd, 4);

          let targetPos = Math.min(Math.max(modIntent.targetPos || (trip.days.length + 1), 1), trip.days.length + 1);
          
          for (let d = 0; d < numDaysToAdd; d++) {
            const newDayNum = targetPos + d;
            const dayStops = clusteredAttractions[d] || [];

            const newStops = dayStops.length >= 1 ? dayStops.map((place, idx) => ({
              id: `s${newDayNum}-${idx + 1}`,
              name: place.name,
              lat: place.lat,
              lng: place.lng,
              category: place.category,
              timeEstimate: TIME_SLOTS[idx],
              costEstimate: place.costEstimate || 10,
              order: idx + 1,
              rationale: place.rationale || `Step 1 (Transit): Transit to ${place.name}. Step 2 (Experience): Explore ${place.name} (~2 hours). Step 3 (Food): Local dining nearby.`
            })) : [
              { name: `${trip.destination} Scenic Viewpoint`, category: 'viewpoint', angle: 0 },
              { name: `${trip.destination} Heritage Walk`, category: 'historic', angle: 1.5 },
              { name: `${trip.destination} Nature Trail`, category: 'nature', angle: 3.0 },
              { name: `${trip.destination} Cultural Quarter`, category: 'attraction', angle: 4.5 }
            ].map((item, sIdx) => {
              const s = sIdx + 1;
              const radius = 0.01 + (sIdx * 0.007);
              return {
                id: `s${newDayNum}-${s}`,
                name: item.name,
                lat: parseFloat((tripCenterLat + Math.sin(item.angle) * radius).toFixed(5)),
                lng: parseFloat((tripCenterLng + Math.cos(item.angle) * radius).toFixed(5)),
                category: item.category,
                timeEstimate: TIME_SLOTS[s - 1],
                costEstimate: 15,
                order: s,
                rationale: `Step 1 (Transit): Morning departure. Step 2 (Experience): Explore ${item.name} (~2 hours). Step 3 (Food): Sample local cafes nearby.`
              };
            });

            const newDayObj = {
              id: `day-${newDayNum}`,
              dayNumber: newDayNum,
              colorHue: DAY_COLOR_PALETTE[(newDayNum - 1) % DAY_COLOR_PALETTE.length],
              stops: optimizeDayStopsRoute(newStops)
            };

            trip.days.splice(targetPos - 1 + d, 0, newDayObj);
          }

          reindexTripDaysAndStops(trip);
          deduplicateTripStops(trip);
          calculateAndEnforceTripBudget(trip, messages);

        replyMessage = `Done! I've added ${numDaysToAdd} new day(s) featuring verified attractions in ${trip.destination}.`;
        return res.status(200).json({
          message: replyMessage,
          trip,
          isComplete: true,
          mapCenter: null
        });
      }

      // ── EXTEND_TO_CITY: Multi-city extension with REAL city attractions ──
      if (modIntent.intent === 'EXTEND_TO_CITY') {
        const newCity = modIntent.newCity;
        const extendDays = modIntent.extendDays || 2;
        const existingDayCount = trip.days.length;
        const capitalizedCity = newCity.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        const cityGeo = await geocodeLocation(capitalizedCity);
        const cityLat = cityGeo ? cityGeo.lat : tripCenterLat;
        const cityLng = cityGeo ? cityGeo.lng : tripCenterLng;

        const allStops = trip.days.flatMap(d => d.stops || []);
        const realAttractions = await fetchRealAttractionsForCity(capitalizedCity, allStops, 4 * extendDays, cityLat, cityLng);
        const clusteredAttractions = clusterAttractionsForDays(realAttractions, extendDays, 4);

        const transitDayNum = existingDayCount + 1;
        const transitDay = {
          id: `day-${transitDayNum}`,
          dayNumber: transitDayNum,
          colorHue: DAY_COLOR_PALETTE[(transitDayNum - 1) % DAY_COLOR_PALETTE.length],
          stops: [
            {
              id: `s${transitDayNum}-1`,
              name: `Departure from ${trip.destination}`,
              lat: tripCenterLat, lng: tripCenterLng,
              category: 'transport',
              timeEstimate: '08:00 AM - 10:00 AM',
              costEstimate: 0, order: 1,
              rationale: `Check out and head out from ${trip.destination}.`
            },
            {
              id: `s${transitDayNum}-2`,
              name: `Travel to ${capitalizedCity}`,
              lat: (tripCenterLat + cityLat) / 2, lng: (tripCenterLng + cityLng) / 2,
              category: 'transport',
              timeEstimate: '10:00 AM - 02:00 PM',
              costEstimate: 50, order: 2,
              rationale: `Transit to ${capitalizedCity} by train, flight, or bus.`
            },
            {
              id: `s${transitDayNum}-3`,
              name: `Arrival & Check-in in ${capitalizedCity}`,
              lat: cityLat, lng: cityLng,
              category: 'accommodation',
              timeEstimate: '02:00 PM - 04:00 PM',
              costEstimate: 0, order: 3,
              rationale: `Arrive in ${capitalizedCity}, check in, and get settled.`
            },
            {
              id: `s${transitDayNum}-4`,
              name: `Evening Walk in ${capitalizedCity}`,
              lat: cityLat + 0.002, lng: cityLng + 0.002,
              category: 'attraction',
              timeEstimate: '05:00 PM - 07:00 PM',
              costEstimate: 0, order: 4,
              rationale: `Enjoy your first evening stroll in ${capitalizedCity}.`
            }
          ]
        };
        trip.days.push(transitDay);

        for (let d = 1; d <= extendDays; d++) {
          const dayNum = existingDayCount + 1 + d;
          const dayStops = clusteredAttractions[d - 1];

          trip.days.push({
            id: `day-${dayNum}`,
            dayNumber: dayNum,
            colorHue: DAY_COLOR_PALETTE[(dayNum - 1) % DAY_COLOR_PALETTE.length],
            stops: dayStops.length > 0 ? dayStops.map((place, idx) => ({
              id: `s${dayNum}-${idx + 1}`,
              name: place.name,
              lat: place.lat,
              lng: place.lng,
              category: place.category,
              timeEstimate: TIME_SLOTS[idx],
              costEstimate: place.costEstimate || 10,
              order: idx + 1,
              rationale: place.rationale || `Explore ${place.name} in ${capitalizedCity}.`
            })) : [1, 2, 3, 4].map(s => ({
              id: `s${dayNum}-${s}`,
              name: `Attraction ${s} in ${capitalizedCity}`,
              lat: cityLat, lng: cityLng,
              category: 'attraction',
              timeEstimate: TIME_SLOTS[s - 1],
              costEstimate: 10, order: s,
              rationale: `Explore ${capitalizedCity}.`
            }))
          });
        }

        if (!trip.destination.toLowerCase().includes(capitalizedCity.toLowerCase())) {
          trip.destination = `${trip.destination} + ${capitalizedCity}`;
        }

        reindexTripDaysAndStops(trip);
        deduplicateTripStops(trip);
        calculateAndEnforceTripBudget(trip, messages);

        replyMessage = `Done! I've extended your trip to include ${capitalizedCity}! Your existing itinerary is preserved, plus a travel day and ${extendDays} days of verified attractions in ${capitalizedCity} (now ${trip.days.length} days total).`;
        return res.status(200).json({
          message: replyMessage,
          trip,
          isComplete: true,
          mapCenter: { lat: cityLat, lng: cityLng, zoom: 12 }
        });
      }

      // ── SWAP_STOP ──
      if (modIntent.intent === 'SWAP_STOP') {
        const realNewPlace = await geocodeRealStop(modIntent.newName, trip.destination, tripCenterLat, tripCenterLng);
        let swapped = false;

        for (const day of trip.days) {
          const idx = day.stops.findIndex(s => s.name.toLowerCase().includes(modIntent.oldName.toLowerCase()));
          if (idx >= 0) {
            day.stops[idx].name = realNewPlace.name;
            day.stops[idx].lat = realNewPlace.lat;
            day.stops[idx].lng = realNewPlace.lng;
            day.stops[idx].category = realNewPlace.category;
            day.stops[idx].rationale = realNewPlace.rationale || `Swapped in ${realNewPlace.name}.`;
            day.stops = optimizeDayStopsRoute(day.stops);
            swapped = true;
            break;
          }
        }

        deduplicateTripStops(trip);
        calculateAndEnforceTripBudget(trip, messages);

        if (swapped) {
          replyMessage = `Done! I've replaced "${modIntent.oldName}" with "${realNewPlace.name}" with real map coordinates.`;
        } else {
          replyMessage = `I couldn't find "${modIntent.oldName}" in your itinerary to swap.`;
        }

        return res.status(200).json({
          message: replyMessage,
          trip,
          isComplete: true,
          mapCenter: null
        });
      }

      // ── DELETE_DAY_AND_REDISTRIBUTE ──
      if (modIntent.intent === 'DELETE_DAY_AND_REDISTRIBUTE') {
        if (trip.days.length <= 1) {
          return res.status(200).json({
            message: `Cannot remove Day ${modIntent.targetDay} because it is the only day in your itinerary! You can modify its stops instead.`,
            trip,
            isComplete: true,
            mapCenter: null
          });
        }

        let dayIdx = modIntent.targetDay === -1 ? trip.days.length - 1 : modIntent.targetDay - 1;
        dayIdx = Math.max(0, Math.min(dayIdx, trip.days.length - 1));
        const targetDayNum = trip.days[dayIdx].dayNumber || (dayIdx + 1);
        const orphanStops = trip.days[dayIdx].stops || [];

        trip.days.splice(dayIdx, 1);
        reindexTripDaysAndStops(trip);
        assignStopsToNearestDays(orphanStops, trip.days);
        deduplicateTripStops(trip);
        calculateAndEnforceTripBudget(trip, messages);

        replyMessage = `Done! I've removed Day ${targetDayNum} and intelligently reassigned its stops to the remaining days with the closest nearby places (with all duplicates eliminated). Your trip is now ${trip.days.length} days.`;

        return res.status(200).json({
          message: replyMessage,
          trip,
          isComplete: true,
          mapCenter: null
        });
      }

      // ── DELETE_DAY ──
      if (modIntent.intent === 'DELETE_DAY') {
        if (trip.days.length <= 1) {
          return res.status(200).json({
            message: `Cannot remove Day ${modIntent.targetDay} because it is the only day in your itinerary! You can modify its stops instead.`,
            trip,
            isComplete: true,
            mapCenter: null
          });
        }

        let dayIdx = modIntent.targetDay === -1 ? trip.days.length - 1 : modIntent.targetDay - 1;
        dayIdx = Math.max(0, Math.min(dayIdx, trip.days.length - 1));
        const targetDayNum = trip.days[dayIdx].dayNumber || (dayIdx + 1);

        trip.days.splice(dayIdx, 1);
        reindexTripDaysAndStops(trip);
        deduplicateTripStops(trip);
        calculateAndEnforceTripBudget(trip, messages);

        replyMessage = `Done! I've removed Day ${targetDayNum} and all its stops from your itinerary. Your trip is now ${trip.days.length} days total.`;

        return res.status(200).json({
          message: replyMessage,
          trip,
          isComplete: true,
          mapCenter: null
        });
      }

      // ── CLEAR_DAY_STOPS ──
      if (modIntent.intent === 'CLEAR_DAY_STOPS') {
        const dayIdx = Math.max(0, Math.min(modIntent.targetDay - 1, trip.days.length - 1));
        trip.days[dayIdx].stops = [];
        replyMessage = `Done! I've cleared all stops from Day ${modIntent.targetDay}. Would you like me to add new places or experiences?`;

        return res.status(200).json({
          message: replyMessage,
          trip,
          isComplete: true,
          mapCenter: null
        });
      }

      // ── REMOVE_STOPS ──
      if (modIntent.intent === 'REMOVE_STOPS') {
        const targets = modIntent.targets;
        const removedNames = [];

        for (const rawTarget of targets) {
          const target = rawTarget.trim();
          const ordinalMatch = target.match(/^stop\s*(\d+)$/i);
          const positionalMatch = target.match(/^(first|second|third|fourth|fifth|last)\s+stop$/i);
          const posMap = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, last: -1 };

          const targetOrder = ordinalMatch ? parseInt(ordinalMatch[1]) : (positionalMatch ? posMap[positionalMatch[1].toLowerCase()] : null);
          const targetName = (!targetOrder) ? target.replace(/^(the|a|an)\s+/i, '').trim() : null;

          for (const day of trip.days) {
            if (modIntent.targetDay && day.dayNumber !== modIntent.targetDay) continue;
            if (!Array.isArray(day.stops)) continue;

            let removeIdx = -1;
            if (targetOrder !== null) {
              removeIdx = targetOrder === -1 ? day.stops.length - 1 : day.stops.findIndex(s => s.order === targetOrder);
            } else if (targetName) {
              const normTarget = normalizeStopName(targetName);
              removeIdx = day.stops.findIndex(s => {
                const normS = normalizeStopName(s.name);
                return normS.includes(normTarget) || normTarget.includes(normS);
              });
            }

            if (removeIdx >= 0) {
              const [removedStop] = day.stops.splice(removeIdx, 1);
              removedNames.push(removedStop.name);
            }
          }
        }

        reindexTripDaysAndStops(trip);
        deduplicateTripStops(trip);
        calculateAndEnforceTripBudget(trip, messages);

        if (removedNames.length > 0) {
          replyMessage = `Done! I've removed ${removedNames.map(n => `"${n}"`).join(', ')} from your itinerary. Would you like to add any replacement stops or adjust the schedule?`;
        } else {
          replyMessage = `I couldn't find ${targets.map(t => `"${t}"`).join(', ')} in your itinerary to remove. Could you specify the exact stop name or day number?`;
        }

        return res.status(200).json({
          message: replyMessage,
          trip,
          isComplete: true,
          mapCenter: null
        });
      }
    }
  }

  // Cloud Provider Fallback (Groq Primary -> NVIDIA NIM Fallback)
  if (!jsonResponse) {
      const groqKey = process.env.GROQ_API_KEY;
      const nvidiaKey = process.env.NVIDIA_API_KEY;

      if (!groqKey && !nvidiaKey) {
        return res.status(500).json({ error: 'AI Microservice is offline and neither GROQ_API_KEY nor NVIDIA_API_KEY is configured.' });
      }

      // Format messages for LLM
      const formattedChatMessages = [
        { role: 'system', content: SYSTEM_PROMPT }
      ];

      messages.forEach((msg) => {
        formattedChatMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content
        });
      });

      if (currentTrip && Object.keys(currentTrip).length > 0 && currentTrip.days && currentTrip.days.length > 0) {
        formattedChatMessages.push({
          role: 'system',
          content: `The current active itinerary state is: ${JSON.stringify(currentTrip)}. If the user asks for changes, modify this state and return the updated version.`
        });
      }

      let rawText = null;

      // ── Option A: Groq Cloud Provider (Ultra-Fast) ──
      if (groqKey) {
        const customGroqModel = process.env.GROQ_MODEL;
        const defaultGroqModels = [
          'qwen/qwen3.8-27b',
          'openai/gpt-oss-120b',
          'openai/gpt-oss-20b',
          'allam-2-7b',
          'groq/compound-mini',
          'qwen/qwen3.6-27b'
        ];
        const groqCandidates = customGroqModel
          ? [customGroqModel, ...defaultGroqModels.filter(m => m !== customGroqModel)]
          : defaultGroqModels;

        for (const groqModel of groqCandidates) {
          try {
            console.log(`[server]: Attempting Groq generation with model "${groqModel}"...`);
            let groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${groqKey}`
              },
              body: JSON.stringify({
                model: groqModel,
                messages: formattedChatMessages,
                response_format: { type: 'json_object' },
                temperature: 0.4,
                max_tokens: 4096
              }),
              signal: AbortSignal.timeout(30000)
            });

            // If 400 on json_object (e.g. thinking models json_validate_failed), retry with standard prompt
            if (!groqRes.ok && groqRes.status === 400) {
              console.warn(`[server]: Groq model "${groqModel}" returned 400 on json_object, retrying with standard prompt...`);
              groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${groqKey}`
                },
                body: JSON.stringify({
                  model: groqModel,
                  messages: formattedChatMessages,
                  temperature: 0.4,
                  max_tokens: 4096
                }),
                signal: AbortSignal.timeout(30000)
              });
            }

            if (groqRes.ok) {
              const groqData = await groqRes.json();
              rawText = (groqData.choices[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
              console.log(`[server]: LLM response generated successfully using Groq "${groqModel}"`);
              break;
            } else {
              const errBody = await groqRes.text().catch(() => '');
              console.warn(`[server]: Groq model "${groqModel}" returned HTTP ${groqRes.status}: ${errBody.substring(0, 120)}`);
            }
          } catch (gErr) {
            console.warn(`[server]: Groq model "${groqModel}" error:`, gErr.message);
          }
        }
      }

      // ── Option B: NVIDIA NIM Cloud Provider (Fallback) ──
      if (!rawText && nvidiaKey) {
        console.log('[server]: Falling back to NVIDIA NIM Cloud Provider...');
        const baseUrl = process.env.NIM_API_BASE_URL || 'https://integrate.api.nvidia.com/v1';
        const candidateModels = [
          'nvidia/nemotron-3-super-120b-a12b',
          'nvidia/nemotron-3.5-lightning-30b-a3b',
          'nvidia/nemotron-3-nano-30b-a3b',
          'google/gemma-4-31b-it',
          'moonshotai/kimi-k3',
          'openai/gpt-oss-20b'
        ];

        for (const modelCandidate of candidateModels) {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000);

            const response = await fetch(`${baseUrl}/chat/completions`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${nvidiaKey}`
              },
              body: JSON.stringify({
                model: modelCandidate,
                messages: formattedChatMessages,
                response_format: { type: 'json_object' },
                temperature: 0.5,
                max_tokens: 4096
              }),
              signal: controller.signal
            });

            clearTimeout(timeoutId);
            if (response.ok) {
              const data = await response.json();
              rawText = (data.choices[0]?.message?.content || '').trim();
              console.log(`[server]: LLM response generated successfully using NIM "${modelCandidate}"`);
              break;
            } else {
              const errBody = await response.text().catch(() => '');
              console.warn(`[server]: NIM Model ${modelCandidate} returned HTTP ${response.status}: ${errBody.substring(0, 120)}. Trying next...`);
            }
          } catch (err) {
            console.warn(`[server]: NIM Model ${modelCandidate} failed or timed out: ${err.message}. Trying next candidate...`);
          }
        }
      }

      if (!rawText) {
        throw new Error('All cloud AI models (Groq and NVIDIA NIM) failed or timed out.');
      }

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
    // SKIP when the AI microservice handled the request — it has its own validator that already
    // enforces correct day counts (including multi-city extensions like Paris 2d + transit + Amsterdam 2d = 5d).
    // Running enforceRequestedDays on top of the AI service output was truncating extended trips.
    let isMultiCity = false;
    if (jsonResponse && jsonResponse.trip && !usedAiMicroservice) {
      const requestedDays = extractRequestedDays(messages);
      isMultiCity = detectMultiCityTrip(jsonResponse.trip, messages);
      const targetDays = requestedDays || (Array.isArray(jsonResponse.trip.days) ? jsonResponse.trip.days.length : 3);
      console.log(`[server]: Enforcing ${targetDays} days (multiCity: ${isMultiCity})...`);
      enforceRequestedDays(jsonResponse.trip, targetDays, fallbackCenterLat, fallbackCenterLng, messages, isMultiCity);
    } else if (jsonResponse && jsonResponse.trip) {
      isMultiCity = detectMultiCityTrip(jsonResponse.trip, messages);
      console.log(`[server]: AI microservice handled day enforcement — skipping backend enforceRequestedDays (days: ${jsonResponse.trip.days?.length}, multiCity: ${isMultiCity})`);
    }

    // POST-PROCESSING: Calculate and enforce correct trip budget (Total Budget = Daily Budget * Total Days)
    if (jsonResponse && jsonResponse.trip) {
      calculateAndEnforceTripBudget(jsonResponse.trip, messages);
    }

    // DYNAMIC GEOCODING: Only geocode stops that are MISSING valid coordinates.
    // If the AI microservice already resolved coordinates (from scoutAgent/OSM), preserve them.
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      const destName = jsonResponse.trip.destination || '';
      for (const day of jsonResponse.trip.days) {
        if (!Array.isArray(day.stops)) continue;
        for (const stop of day.stops) {
          // Skip stops that already have valid, non-zero coordinates
          const hasValidCoords = typeof stop.lat === 'number' && !isNaN(stop.lat) &&
                                 typeof stop.lng === 'number' && !isNaN(stop.lng) &&
                                 stop.lat !== 0 && stop.lng !== 0;
          if (hasValidCoords) {
            continue; // Preserve existing valid coordinates from AI microservice
          }

          try {
            // Only geocode stops with missing/zero/invalid coordinates
            const geocoded = await geocodeLocation(stop.name, destName, fallbackCenterLat, fallbackCenterLng);
            if (geocoded && typeof geocoded.lat === 'number' && typeof geocoded.lng === 'number') {
              stop.lat = geocoded.lat;
              stop.lng = geocoded.lng;
            } else {
              stop.lat = fallbackCenterLat;
              stop.lng = fallbackCenterLng;
            }
            await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit pause
          } catch (err) {
            console.error('Failed to geocode stop dynamically:', stop.name, err);
            if (typeof stop.lat !== 'number' || isNaN(stop.lat)) stop.lat = fallbackCenterLat;
            if (typeof stop.lng !== 'number' || isNaN(stop.lng)) stop.lng = fallbackCenterLng;
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

    // POST-PROCESSING: Reorder stops by geographic nearest-neighbor feasibility
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      const isModificationRequest = Boolean(currentTrip && Array.isArray(currentTrip.days) && currentTrip.days.length > 0);
      const MAX_DISTANCE_KM = (isMultiCity || isModificationRequest) ? 10000 : 300; // Allow full distance for modifications & multi-city

      for (const day of jsonResponse.trip.days) {
        if (!Array.isArray(day.stops) || day.stops.length < 2) continue;

        // Calculate centroid of all stops in this day
        let centroidLat = 0, centroidLng = 0;
        day.stops.forEach(s => { centroidLat += s.lat; centroidLng += s.lng; });
        centroidLat /= day.stops.length;
        centroidLng /= day.stops.length;

        // Filter out stops that are extreme outliers (skipped during user modifications to preserve user requested stops)
        const validStops = [];
        const removedStops = [];
        for (const stop of day.stops) {
          const dist = haversineKm(centroidLat, centroidLng, stop.lat, stop.lng);
          if (dist <= MAX_DISTANCE_KM || isModificationRequest || usedAiMicroservice) {
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

        // GUARANTEE DEPTH: Only for initial automated trip creation (never during user modifications)
        if (!isModificationRequest && !usedAiMicroservice && day.stops.length < 3 && day.stops.length > 0) {
          const destName = jsonResponse.trip.destination || 'local area';
          const existingDayStops = jsonResponse.trip.days.flatMap(d => d.stops || []);
          const neededCount = 3 - day.stops.length;
          
          try {
            const realExtra = await fetchRealAttractionsForCity(destName, existingDayStops, neededCount, day.stops[0].lat, day.stops[0].lng);
            for (const place of realExtra) {
              const newOrder = day.stops.length + 1;
              day.stops.push({
                id: `${day.id}-s${newOrder}`,
                name: place.name,
                lat: place.lat,
                lng: place.lng,
                category: place.category || 'attraction',
                timeEstimate: TIME_SLOTS[Math.min(newOrder - 1, TIME_SLOTS.length - 1)],
                costEstimate: place.costEstimate || 10,
                rationale: place.rationale || `Visit ${place.name} in ${destName}.`,
                order: newOrder
              });
            }
          } catch (e) {
            console.warn('[server]: fetchRealAttractionsForCity failed during depth guarantee:', e.message);
          }

          day.stops = optimizeDayStopsRoute(day.stops);
        }
      }
    }

    // POST-PROCESSING: Global stop deduplication across all days
    if (jsonResponse.trip && Array.isArray(jsonResponse.trip.days)) {
      jsonResponse.trip = deduplicateTripStops(jsonResponse.trip);

      // GUARANTEE: Never send any day with 0 locations back to the frontend!
      const dName = jsonResponse.trip.destination || 'Destination';
      for (const day of jsonResponse.trip.days) {
        if (!Array.isArray(day.stops) || day.stops.length === 0) {
          console.warn(`[server]: Day ${day.dayNumber || day.id} had 0 stops after post-processing! Backfilling immediately.`);
          const cLat = fallbackCenterLat || 32.2484;
          const cLng = fallbackCenterLng || 77.1808;
          day.stops = [
            { name: `${dName} Scenic Viewpoint`, category: 'viewpoint', angle: 0 },
            { name: `${dName} Heritage Walk`, category: 'historic', angle: 1.5 },
            { name: `${dName} Nature Trail`, category: 'nature', angle: 3.0 },
            { name: `${dName} Cultural Quarter`, category: 'attraction', angle: 4.5 }
          ].map((item, idx) => ({
            id: `s${day.dayNumber || 1}-${idx + 1}`,
            name: item.name,
            lat: parseFloat((cLat + Math.sin(item.angle) * (0.01 + idx * 0.005)).toFixed(5)),
            lng: parseFloat((cLng + Math.cos(item.angle) * (0.01 + idx * 0.005)).toFixed(5)),
            category: item.category,
            timeEstimate: TIME_SLOTS[idx],
            costEstimate: 15,
            order: idx + 1,
            rationale: `Step 1 (Transit): Morning departure. Step 2 (Experience): Explore ${item.name} (~2 hours). Step 3 (Food): Sample local cafes nearby.`
          }));
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

    // Priority 1: Standalone "X days" or "for X days"
    if (bestPriority < 1) {
      const allDayMatches = [...text.matchAll(/(?:^|[^a-z])(\d+)\s*\+?\s*(?:-\s*day|day|days)\b/gi)];
      for (const m of allDayMatches) {
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
        // Expand using previous day stops with slight offset and distinct discovery naming
        const templateDay = isMultiCity ? trip.days[currentCount - 1] : trip.days[(d - 1) % currentCount];
        newStops = (templateDay.stops || []).map((s, idx) => {
          const angle = (idx * 1.5) % (2 * Math.PI);
          const radius = 0.005 + (idx * 0.003);
          return {
            ...s,
            id: `s${d}-${idx + 1}`,
            name: `${s.name} Discovery & Walk`,
            lat: parseFloat(((s.lat || centerLat) + Math.sin(angle) * radius).toFixed(5)),
            lng: parseFloat(((s.lng || centerLng) + Math.cos(angle) * radius).toFixed(5)),
            order: idx + 1
          };
        });
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

// Extract budget details from user messages (multi-currency aware: $, ₹, ¥, £, €, etc.)
function extractUserBudget(messages) {
  if (!messages || !Array.isArray(messages)) return null;

  const cleanNum = (str) => parseInt(String(str).replace(/[^\d]/g, ''), 10);
  const currSym = '(?:[\\$€£₹¥₩฿]|AED|A\\$|CA\\$|S\\$|Rp|₫)?\\s*';

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user' || !msg.content) continue;
    const text = msg.content;

    // 1. Range per day: "$80-120 per day", "₹2,000–3,500/day", "Budget: ₹2,000–3,500"
    const rangeRegex = new RegExp(`(?:Budget\\s*:\\s*|budget.*?)?${currSym}([\\d,]+)\\s*(?:[–-]|to)\\s*${currSym}([\\d,]+)\\s*(?:\\/|\\s*per|\\s*a)?\\s*(?:day|daily)?`, 'i');
    const dailyRangeMatch = text.match(rangeRegex);
    if (dailyRangeMatch) {
      const min = cleanNum(dailyRangeMatch[1]);
      const max = cleanNum(dailyRangeMatch[2]);
      if (min > 0 && max > min) {
        const avgDaily = Math.round((min + max) / 2);
        return { isDaily: true, dailyRate: avgDaily, minRate: min, maxRate: max };
      }
    }

    // 2. Single rate per day: "$100/day", "₹5,000/day", "Budget: ₹5,000", "daily budget: 1500"
    const singleRegex = new RegExp(`(?:daily\\s+budget|budget\\s*:\\s*|budget)?\\s*${currSym}([\\d,]+)\\s*(?:\\/|\\s*per|\\s*a)?\\s*day`, 'i');
    const singleDailyMatch = text.match(singleRegex);
    if (singleDailyMatch) {
      const rate = cleanNum(singleDailyMatch[1]);
      if (rate > 0) {
        return { isDaily: true, dailyRate: rate, minRate: rate, maxRate: rate };
      }
    }

    // 3. Explicit total budget: "budget of $1500", "total budget of ₹50,000", "budget 2000"
    const totalRegex = new RegExp(`(?:total\\s+budget(?:\\s+of)?|budget\\s+of|budget:?)\\s*${currSym}([\\d,]+)\\b`, 'i');
    const totalMatch = text.match(totalRegex);
    if (totalMatch) {
      const total = cleanNum(totalMatch[1]);
      if (total > 0) {
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

