import { Router } from 'express';
import { poiCache } from '../utils/cache.js';

const router = Router();

// Use the reliable mail.ru Overpass mirror (primary overpass-api.de often 504s)
const OVERPASS_MIRRORS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter'
];

// GET /api/lodgings?lat=35.7148&lng=139.7967&radius=2000
router.get('/lodgings', async (req, res) => {
  const query = req.query || {};
  const lat = parseFloat(query.lat);
  const lng = parseFloat(query.lng);
  const radius = parseInt(query.radius) || 2000;

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }

  try {
    const cacheKey = `lodgings-${lat.toFixed(4)}-${lng.toFixed(4)}-${radius}`;
    const cachedData = poiCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const lodgings = await fetchRealLodgings(lat, lng, radius);
    if (lodgings.length > 0) {
      poiCache.set(cacheKey, lodgings);
    }
    return res.status(200).json(lodgings);

  } catch (error) {
    console.error('Lodging error:', error.message);
    return res.status(200).json([]);
  }
});


/**
 * Fetch real hotels, guest houses, and hostels from OpenStreetMap via Overpass API.
 * Uses nwr (node/way/relation) with regex matching for efficiency.
 */
async function fetchRealLodgings(lat, lng, radius) {
  const overpassQuery = `
    [out:json][timeout:25];
    (
      nwr["tourism"~"hotel|guest_house|hostel"]["name"](around:${radius},${lat},${lng});
    );
    out center 15;
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
    // De-duplicate by name, take top 3
    const seen = new Set();
    const unique = [];
    for (const el of data.elements) {
      const name = el.tags?.name;
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      unique.push(el);
      if (unique.length >= 3) break;
    }

    return unique.map((el, i) => formatLodging(el, i, lat, lng));
  }

  // 2. Try Geoapify API key fallback
  if (process.env.GEOAPIFY_API_KEY) {
    try {
      console.log(`OpenStreetMap returned no results. Querying Geoapify API backup for coordinates [${lat}, ${lng}]`);
      const geoResults = await fetchGeoapifyLodgings(lat, lng, radius);
      if (geoResults.length > 0) return geoResults;
    } catch (err) {
      console.error('Geoapify lodging backup failed:', err.message);
    }
  }

  // 3. Try Foursquare API key fallback
  if (process.env.FOURSQUARE_API_KEY) {
    try {
      console.log(`OpenStreetMap returned no results. Querying Foursquare API backup for coordinates [${lat}, ${lng}]`);
      const fsqResults = await fetchFoursquareLodgings(lat, lng, radius);
      if (fsqResults.length > 0) return fsqResults;
    } catch (err) {
      console.error('Foursquare lodging backup failed:', err.message);
    }
  }

  // 4. Simulated local mock data
  console.log(`Generating fallback mock lodgings for coordinate [${lat}, ${lng}]`);
  return generateFallbackLodgings(lat, lng);
}

async function fetchFoursquareLodgings(lat, lng, radius) {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) {
    throw new Error('FOURSQUARE_API_KEY not configured');
  }

  // Foursquare category ID: 19009 (Lodging/Accommodation)
  const url = `https://api.foursquare.com/v3/places/search?ll=${lat},${lng}&radius=${radius}&categories=19009&limit=10`;

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

  // Take top 3 unique places
  const seen = new Set();
  const unique = [];
  for (const place of data.results) {
    if (seen.has(place.name.toLowerCase())) continue;
    seen.add(place.name.toLowerCase());
    unique.push(place);
    if (unique.length >= 3) break;
  }

  return unique.map((place, idx) => {
    const elLat = place.geocodes?.main?.latitude || lat;
    const elLng = place.geocodes?.main?.longitude || lng;
    const distKm = haversineDistance(lat, lng, elLat, elLng);
    const walkMinutes = Math.max(1, Math.round(distKm / 0.08));

    const pricePerNight = 6000 + (idx * 5000) + Math.floor(Math.random() * 3000);

    return {
      id: `lodging-fsq-${place.fsq_id}`,
      name: place.name,
      lat: elLat,
      lng: elLng,
      pricePerNight,
      rating: parseFloat((4.0 + Math.random() * 0.8).toFixed(1)),
      reviewCount: Math.floor(25 + Math.random() * 180),
      amenities: ['Free Wi-Fi', 'Breakfast', 'Air Conditioning', 'Luggage Storage'],
      avgCommuteMinutes: walkMinutes,
      rationale: `Real hotel found via Foursquare ${distKm.toFixed(1)}km from your planned stops.`
    };
  });
}

function formatLodging(el, index, queryLat, queryLng) {
  const tags = el.tags || {};

  // Get coordinates — for way/relation elements, use center
  const elLat = el.lat || el.center?.lat || queryLat;
  const elLng = el.lon || el.center?.lon || queryLng;

  // Estimate price from stars tag or tourism type
  const stars = parseInt(tags.stars) || 0;
  const pricePerNight = estimatePrice(stars, tags.tourism);

  // Extract amenities from OSM tags
  const amenities = extractAmenities(tags);

  // Rough commute estimate (haversine distance -> minutes walking at ~5km/h)
  const distKm = haversineDistance(queryLat, queryLng, elLat, elLng);
  const walkMinutes = Math.max(1, Math.round(distKm / 0.08));

  return {
    id: `lodging-osm-${el.id}`,
    name: tags.name,
    lat: elLat,
    lng: elLng,
    pricePerNight,
    rating: stars >= 1
      ? Math.min(5, 3.5 + stars * 0.3)
      : parseFloat((3.8 + Math.random() * 1.0).toFixed(1)),
    reviewCount: Math.floor(20 + Math.random() * 280),
    amenities,
    avgCommuteMinutes: walkMinutes,
    rationale: `Real ${tags.tourism?.replace('_', ' ') || 'hotel'} found ${distKm.toFixed(1)}km from your planned stops.`
  };
}

function estimatePrice(stars, tourismType) {
  if (stars >= 5) return 25000 + Math.floor(Math.random() * 15000);
  if (stars >= 4) return 15000 + Math.floor(Math.random() * 10000);
  if (stars >= 3) return 8000 + Math.floor(Math.random() * 7000);
  if (stars >= 2) return 4000 + Math.floor(Math.random() * 4000);
  if (stars >= 1) return 2000 + Math.floor(Math.random() * 3000);

  // No stars tag — estimate from accommodation type
  if (tourismType === 'hostel') return 2500 + Math.floor(Math.random() * 3000);
  if (tourismType === 'guest_house') return 5000 + Math.floor(Math.random() * 5000);
  if (tourismType === 'motel') return 4000 + Math.floor(Math.random() * 4000);

  // Default hotel
  return 8000 + Math.floor(Math.random() * 12000);
}

function extractAmenities(tags) {
  const amenities = [];
  if (tags.internet_access === 'wlan' || tags.internet_access === 'yes') amenities.push('Free Wi-Fi');
  if (tags.swimming_pool === 'yes') amenities.push('Swimming Pool');
  if (tags.breakfast === 'yes' || tags.meal === 'breakfast') amenities.push('Breakfast');
  if (tags.parking === 'yes' || tags.parking === 'surface') amenities.push('Parking');
  if (tags.air_conditioning === 'yes') amenities.push('Air Conditioning');
  if (tags.spa === 'yes') amenities.push('Spa');
  if (tags.fitness_centre === 'yes' || tags.gym === 'yes') amenities.push('Gym');
  if (tags.bar === 'yes') amenities.push('Bar');
  if (tags.restaurant === 'yes') amenities.push('On-site Restaurant');

  // If we found nothing from tags, provide sensible defaults
  if (amenities.length === 0) {
    amenities.push('Free Wi-Fi');
    const defaults = ['Breakfast', 'Air Conditioning', 'Room Service', 'Luggage Storage', '24h Front Desk'];
    const count = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * defaults.length);
      amenities.push(defaults.splice(idx, 1)[0]);
    }
  }

  return amenities;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function generateFallbackLodgings(lat, lng) {
  return [
    {
      id: `lodging-fallback-1-${lat}-${lng}`,
      name: 'The Grand Vista Pavilion',
      lat: lat + (Math.random() - 0.5) * 0.006,
      lng: lng + (Math.random() - 0.5) * 0.006,
      pricePerNight: 16500,
      rating: parseFloat((4.5 + Math.random() * 0.4).toFixed(1)),
      reviewCount: Math.floor(100 + Math.random() * 150),
      amenities: ['Free Wi-Fi', 'Swimming Pool', 'Breakfast', 'Spa', 'Gym'],
      avgCommuteMinutes: 8,
      rationale: 'Premium hotel fallback generated near your selected locations.'
    },
    {
      id: `lodging-fallback-2-${lat}-${lng}`,
      name: 'Serene Garden Lodging',
      lat: lat + (Math.random() - 0.5) * 0.006,
      lng: lng + (Math.random() - 0.5) * 0.006,
      pricePerNight: 7800,
      rating: parseFloat((4.1 + Math.random() * 0.5).toFixed(1)),
      reviewCount: Math.floor(40 + Math.random() * 120),
      amenities: ['Free Wi-Fi', 'Breakfast', 'Air Conditioning', 'Luggage Storage'],
      avgCommuteMinutes: 12,
      rationale: 'Cozy guest house fallback generated near your selected locations.'
    },
    {
      id: `lodging-fallback-3-${lat}-${lng}`,
      name: 'Nomad Travelers Hub',
      lat: lat + (Math.random() - 0.5) * 0.006,
      lng: lng + (Math.random() - 0.5) * 0.006,
      pricePerNight: 3200,
      rating: parseFloat((3.9 + Math.random() * 0.6).toFixed(1)),
      reviewCount: Math.floor(20 + Math.random() * 80),
      amenities: ['Free Wi-Fi', 'Room Service', '24h Front Desk'],
      avgCommuteMinutes: 15,
      rationale: 'Budget hostel fallback generated near your selected locations.'
    }
  ];
}

async function fetchGeoapifyLodgings(lat, lng, radius) {
  const apiKey = process.env.GEOAPIFY_API_KEY;
  if (!apiKey) {
    throw new Error('GEOAPIFY_API_KEY not configured');
  }

  const categories = 'accommodation.hotel,accommodation.hostel,accommodation.motel,accommodation.guest_house';
  let currentRadius = Math.max(radius, 1000);
  let features = [];
  
  while (currentRadius <= 20000) {
    const url = `https://api.geoapify.com/v2/places?categories=${categories}&filter=circle:${lng},${lat},${currentRadius}&limit=10&apiKey=${apiKey}`;
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const data = await response.json();
        if (data && data.features && data.features.length >= 3) {
          features = data.features;
          console.log(`Geoapify Lodgings found ${features.length} results at radius ${currentRadius}m`);
          break;
        } else if (data && data.features && data.features.length > 0) {
          features = data.features; // Hold onto whatever we have so far
        }
      }
    } catch (err) {
      console.warn(`Geoapify lodging search at radius ${currentRadius}m failed:`, err.message);
    }
    
    if (currentRadius >= 20000) break;
    currentRadius = Math.min(20000, Math.round(currentRadius * 2.5));
  }

  if (features.length === 0) return [];

  const seen = new Set();
  const unique = [];
  for (const f of features) {
    const props = f.properties || {};
    const name = props.name || props.street || 'Cozy Mountain Lodge';
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    unique.push({ ...props, displayName: name });
    if (unique.length >= 3) break;
  }

  return unique.map((props, idx) => {
    const elLat = props.lat;
    const elLng = props.lon;
    const distKm = haversineDistance(lat, lng, elLat, elLng);
    const walkMinutes = Math.max(1, Math.round(distKm / 0.08));

    const pricePerNight = 4000 + (idx * 2500) + Math.floor(Math.random() * 2000);

    return {
      id: `lodging-geoapify-${props.place_id}`,
      name: props.displayName,
      lat: elLat,
      lng: elLng,
      pricePerNight,
      rating: parseFloat((4.0 + Math.random() * 0.8).toFixed(1)),
      reviewCount: Math.floor(20 + Math.random() * 200),
      amenities: ['Free Wi-Fi', 'Breakfast', 'Air Conditioning', 'Luggage Storage'],
      avgCommuteMinutes: walkMinutes,
      rationale: `Real accommodation found via Geoapify ${distKm.toFixed(1)}km from your planned stops.`
    };
  });
}

export default router;
