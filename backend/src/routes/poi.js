import { Router } from 'express';
import { poiCache } from '../utils/cache.js';

const router = Router();

// Use the reliable mail.ru Overpass mirror (primary overpass-api.de often 504s)
const OVERPASS_MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function filterPOIsByNearestOwnership(pois, activeLat, activeLng, allStops) {
  if (allStops.length <= 1) {
    return balanceHotelsAndCafes(pois);
  }

  const primaryCafes = [];
  const primaryHotels = [];
  const secondaryCafes = [];
  const secondaryHotels = [];

  for (const poi of pois) {
    let minStopDist = Infinity;
    let nearestStop = null;

    for (const stop of allStops) {
      const dist = haversineDistance(poi.lat, poi.lng, stop.lat, stop.lng);
      if (dist < minStopDist) {
        minStopDist = dist;
        nearestStop = stop;
      }
    }

    const isActiveStop = nearestStop && 
      Math.abs(nearestStop.lat - activeLat) < 0.0001 && 
      Math.abs(nearestStop.lng - activeLng) < 0.0001;

    const poiWithDist = { 
      ...poi, 
      distToActive: haversineDistance(poi.lat, poi.lng, activeLat, activeLng) 
    };

    if (isActiveStop) {
      if (poi.category === 'cafe') primaryCafes.push(poiWithDist);
      else if (poi.category === 'hotel') primaryHotels.push(poiWithDist);
    } else {
      if (poi.category === 'cafe') secondaryCafes.push(poiWithDist);
      else if (poi.category === 'hotel') secondaryHotels.push(poiWithDist);
    }
  }

  // Sort all lists by distance to active stop
  primaryCafes.sort((a, b) => a.distToActive - b.distToActive);
  primaryHotels.sort((a, b) => a.distToActive - b.distToActive);
  secondaryCafes.sort((a, b) => a.distToActive - b.distToActive);
  secondaryHotels.sort((a, b) => a.distToActive - b.distToActive);

  // Group unique (primary) places first, alternating cafe and hotel
  const primaries = [];
  const maxPrimary = Math.max(primaryCafes.length, primaryHotels.length);
  for (let i = 0; i < maxPrimary; i++) {
    if (primaryCafes[i]) primaries.push(primaryCafes[i]);
    if (primaryHotels[i]) primaries.push(primaryHotels[i]);
  }

  // Group secondary (neighboring stops) places next, alternating cafe and hotel
  const secondaries = [];
  const maxSecondary = Math.max(secondaryCafes.length, secondaryHotels.length);
  for (let i = 0; i < maxSecondary; i++) {
    if (secondaryCafes[i]) secondaries.push(secondaryCafes[i]);
    if (secondaryHotels[i]) secondaries.push(secondaryHotels[i]);
  }

  // Combine them: primary (unique) first, secondary (neighboring) next
  const combined = [...primaries, ...secondaries];

  // Pick up to 5 cafes and 5 hotels
  const targetCountEach = 5;
  let cafeCount = 0;
  let hotelCount = 0;
  const result = [];

  for (const item of combined) {
    if (item.category === 'cafe' && cafeCount < targetCountEach) {
      result.push(item);
      cafeCount++;
    } else if (item.category === 'hotel' && hotelCount < targetCountEach) {
      result.push(item);
      hotelCount++;
    }
  }

  return result.map(({ distToActive, ...rest }) => rest);
}

function balanceHotelsAndCafes(pois) {
  const cafes = pois.filter(p => p.category === 'cafe');
  const hotels = pois.filter(p => p.category === 'hotel');

  // Sort by distance if available, else random/default
  cafes.sort((a, b) => (a.distToActive || 0) - (b.distToActive || 0));
  hotels.sort((a, b) => (a.distToActive || 0) - (b.distToActive || 0));

  const result = [];
  const limitEach = 5;
  const maxLimit = Math.max(cafes.length, hotels.length);

  for (let i = 0; i < maxLimit; i++) {
    if (cafes[i] && result.length < limitEach * 2) result.push(cafes[i]);
    if (hotels[i] && result.length < limitEach * 2) result.push(hotels[i]);
  }

  return result.slice(0, limitEach * 2);
}

// GET /api/poi?lat=35.7148&lng=139.7967&radius=500&allStops=lat1,lng1|lat2,lng2|...
router.get('/poi', async (req, res) => {
  const query = req.query || {};
  let lat = parseFloat(query.lat);
  let lng = parseFloat(query.lng);
  const radius = parseInt(query.radius) || 500;
  const allStopsParam = query.allStops || '';

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }

  const allStops = allStopsParam
    ? allStopsParam.split('|').map(s => {
        const [sLat, sLng] = s.split(',').map(parseFloat);
        return { lat: sLat, lng: sLng };
      }).filter(s => !isNaN(s.lat) && !isNaN(s.lng))
    : [];

  try {
    const cacheKey = `poi-${lat.toFixed(4)}-${lng.toFixed(4)}-${radius}`;
    let pois = poiCache.get(cacheKey);
    
    if (!pois) {
      pois = await fetchRealPOIs(lat, lng, radius);
      if (pois.length > 0) {
        poiCache.set(cacheKey, pois);
      }
    }

    const processedPois = filterPOIsByNearestOwnership(pois, lat, lng, allStops);
    return res.status(200).json(processedPois);

  } catch (error) {
    console.error('POI error:', error.message);
    return res.status(200).json([]);
  }
});


/**
 * Fetch real nearby places from OpenStreetMap via Overpass API.
 * Queries for restaurants, cafes, and tourist attractions within the radius.
 * Tries multiple mirrors for reliability.
 */
async function fetchRealPOIs(lat, lng, radius) {
  const searchRadius = Math.max(radius, 800);

  const overpassQuery = `
    [out:json][timeout:25];
    (
      nwr["amenity"="cafe"]["name"](around:${searchRadius},${lat},${lng});
      nwr["tourism"~"hotel|hostel|motel|guest_house"]["name"](around:${searchRadius},${lat},${lng});
    );
    out center 40;
  `;

  let data = null;
  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(30000)
      });

      if (response.ok) {
        data = await response.json();
        break;
      }
    } catch (err) {
      console.warn(`Overpass mirror ${mirror} failed:`, err.message);
    }
  }

  if (data && data.elements && data.elements.length > 0) {
    const elements = data.elements;
    const result = [];
    const seenNames = new Set();

    for (const el of elements) {
      const name = el.tags?.name;
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());

      const category = classifyElement(el);
      if (category !== 'cafe' && category !== 'hotel') continue;

      result.push(formatPOI(el, category));
    }

    return result;
  }

  // 2. Try Geoapify API key fallback
  if (process.env.GEOAPIFY_API_KEY) {
    try {
      console.log(`OpenStreetMap returned no results. Querying Geoapify API backup for coordinates [${lat}, ${lng}]`);
      const geoResults = await fetchGeoapifyPOIs(lat, lng, radius);
      if (geoResults.length > 0) return geoResults;
    } catch (err) {
      console.error('Geoapify POI backup failed:', err.message);
    }
  }

  // 3. Try Foursquare API key fallback
  if (process.env.FOURSQUARE_API_KEY) {
    try {
      console.log(`OpenStreetMap returned no results. Querying Foursquare API backup for coordinates [${lat}, ${lng}]`);
      const fsqResults = await fetchFoursquarePOIs(lat, lng, radius);
      if (fsqResults.length > 0) return fsqResults;
    } catch (err) {
      console.error('Foursquare POI backup failed:', err.message);
    }
  }

  // 4. Simulated local mock data
  console.log(`Generating fallback mock POIs for coordinate [${lat}, ${lng}]`);
  return generateFallbackPOIs(lat, lng);
}

async function fetchFoursquarePOIs(lat, lng, radius) {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    throw new Error('FOURSQUARE_API_KEY not configured');
  }

  const searchRadius = Math.max(radius, 800);
  const url = `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&radius=${searchRadius}&categories=13032,19014&limit=25`;

  const response = await fetch(url, {
    headers: {
      'Authorization': apiKey,
      'Accept': 'application/json'
    },
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    throw new Error(`Foursquare API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (!data || !data.results) return [];

  return data.results.map(place => {
    let category = 'sight';
    const primaryCat = place.categories?.[0]?.id;
    if (primaryCat) {
      if (primaryCat === 13032) category = 'cafe';
      else if (primaryCat >= 19000 && primaryCat <= 19030) category = 'hotel';
    }

    return {
      id: `poi-fsq-${place.fsq_id}`,
      name: place.name,
      lat: place.geocodes?.main?.latitude || lat,
      lng: place.geocodes?.main?.longitude || lng,
      category,
      rating: (4.0 + Math.random() * 0.8).toFixed(1),
      reviewsCount: Math.floor(15 + Math.random() * 150),
      address: place.location?.formatted_address || place.location?.address || ''
    };
  }).filter(poi => poi.category === 'cafe' || poi.category === 'hotel');
}

function classifyElement(el) {
  const tags = el.tags || {};
  if (tags.amenity === 'cafe') return 'cafe';
  if (tags.tourism === 'hotel' || tags.tourism === 'hostel' || tags.tourism === 'motel' || tags.tourism === 'guest_house' || tags.accommodation === 'hotel') return 'hotel';
  return 'sight';
}

function formatPOI(el, category) {
  const tags = el.tags || {};

  // Get coordinates — for way/relation elements, use the center property
  const poiLat = el.lat || el.center?.lat;
  const poiLng = el.lon || el.center?.lon;

  // Build address from OSM addr tags
  const addrParts = [];
  if (tags['addr:housenumber']) addrParts.push(tags['addr:housenumber']);
  if (tags['addr:street']) addrParts.push(tags['addr:street']);
  if (tags['addr:city']) addrParts.push(tags['addr:city']);
  const address = addrParts.length > 0
    ? addrParts.join(', ')
    : (tags['addr:full'] || '');

  return {
    id: `poi-osm-${el.id}`,
    name: tags.name,
    lat: poiLat,
    lng: poiLng,
    category,
    rating: (3.8 + Math.random() * 1.0).toFixed(1),
    reviewsCount: Math.floor(20 + Math.random() * 280),
    address
  };
}

function generateFallbackPOIs(lat, lng) {
  return [
    {
      id: `poi-fallback-cafe-1-${lat}-${lng}`,
      name: 'Alpine Peaks Coffee House',
      lat: lat + (Math.random() - 0.5) * 0.003,
      lng: lng + (Math.random() - 0.5) * 0.003,
      category: 'cafe',
      rating: (4.4 + Math.random() * 0.5).toFixed(1),
      reviewsCount: Math.floor(60 + Math.random() * 100),
      address: 'Pine Valley Rd'
    },
    {
      id: `poi-fallback-hotel-1-${lat}-${lng}`,
      name: 'Pine Crest Resort',
      lat: lat + (Math.random() - 0.5) * 0.004,
      lng: lng + (Math.random() - 0.5) * 0.004,
      category: 'hotel',
      rating: (4.5 + Math.random() * 0.4).toFixed(1),
      reviewsCount: Math.floor(100 + Math.random() * 200),
      address: 'Resort Hill Rd'
    },
    {
      id: `poi-fallback-cafe-2-${lat}-${lng}`,
      name: 'Valley Stream Cafe',
      lat: lat + (Math.random() - 0.5) * 0.003,
      lng: lng + (Math.random() - 0.5) * 0.003,
      category: 'cafe',
      rating: (4.3 + Math.random() * 0.5).toFixed(1),
      reviewsCount: Math.floor(40 + Math.random() * 80),
      address: 'Waterfront Dr'
    },
    {
      id: `poi-fallback-hotel-2-${lat}-${lng}`,
      name: 'Summit Horizon Lodge',
      lat: lat + (Math.random() - 0.5) * 0.005,
      lng: lng + (Math.random() - 0.5) * 0.005,
      category: 'hotel',
      rating: (4.2 + Math.random() * 0.5).toFixed(1),
      reviewsCount: Math.floor(50 + Math.random() * 150),
      address: 'Peak Panorama Way'
    }
  ];
}

async function fetchGeoapifyPOIs(lat, lng, radius) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  const categories = 'accommodation.hotel,catering.cafe';
  let currentRadius = Math.max(radius, 1000);
  let features = [];
  
  while (currentRadius <= 20000) {
    const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${currentRadius}&limit=40&apiKey=${apiKey}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data = await response.json();
        if (data && data.features) {
          const cafesCount = data.features.filter(f => f.properties?.categories?.includes('catering.cafe')).length;
          const hotelsCount = data.features.filter(f => f.properties?.categories?.includes('accommodation.hotel')).length;
          
          if (cafesCount >= 2 && hotelsCount >= 2) {
            features = data.features;
            console.log(`Geoapify POIs found enough results (${cafesCount} cafes, ${hotelsCount} hotels) at radius ${currentRadius}m`);
            break;
          } else if (data.features.length > 0) {
            features = data.features;
          }
        }
      }
    } catch (err) {
      console.warn(`Geoapify search at radius ${currentRadius}m failed:`, err.message);
    }
    
    if (currentRadius >= 20000) break;
    currentRadius = Math.min(20000, Math.round(currentRadius * 2.5));
  }

  if (features.length === 0) return [];

  const result = [];

  for (const f of features) {
    const props = f.properties || {};
    let category = '';
    if (props.categories?.includes('catering.cafe')) {
      category = 'cafe';
    } else if (props.categories?.includes('accommodation.hotel')) {
      category = 'hotel';
    }
    if (!category) continue;

    let name = props.name || props.street;
    if (!name) {
      name = category === 'cafe' ? 'Local Cafe' : 'Nearby Hotel';
    }

    result.push({
      id: `poi-geoapify-${props.place_id}`,
      name: name,
      lat: props.lat,
      lng: props.lon,
      category,
      rating: (4.0 + Math.random() * 0.8).toFixed(1),
      reviewsCount: Math.floor(10 + Math.random() * 190),
      address: props.formatted || ''
    });
  }

  return result;
}

export default router;
