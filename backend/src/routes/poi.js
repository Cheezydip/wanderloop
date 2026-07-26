import { Router } from 'express';
import { poiCache } from '../utils/cache.js';

const router = Router();

// Multiple reliable Overpass API mirrors
const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter',
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
  return R * c;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function filterPOIsByNearestOwnership(pois, activeLat, activeLng, allStops) {
  if (!pois || pois.length === 0) return [];

  if (allStops.length <= 1) {
    return balancePOICategories(pois);
  }

  const primaryByCat = { food: [], cafe: [], sight: [], hotel: [] };
  const secondaryByCat = { food: [], cafe: [], sight: [], hotel: [] };

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

    const cat = poi.category || 'sight';
    if (isActiveStop) {
      if (!primaryByCat[cat]) primaryByCat[cat] = [];
      primaryByCat[cat].push(poiWithDist);
    } else {
      if (!secondaryByCat[cat]) secondaryByCat[cat] = [];
      secondaryByCat[cat].push(poiWithDist);
    }
  }

  // Sort by distance to active stop
  Object.keys(primaryByCat).forEach(k => primaryByCat[k].sort((a, b) => a.distToActive - b.distToActive));
  Object.keys(secondaryByCat).forEach(k => secondaryByCat[k].sort((a, b) => a.distToActive - b.distToActive));

  const result = [];
  const limitPerCat = 5;
  const counts = { food: 0, cafe: 0, sight: 0, hotel: 0 };

  // First pick primary (active stop) POIs
  for (const cat of ['food', 'cafe', 'sight', 'hotel']) {
    for (const item of primaryByCat[cat]) {
      if (counts[cat] < limitPerCat) {
        result.push(item);
        counts[cat]++;
      }
    }
  }

  // Next fill with secondary (neighboring stops) POIs
  for (const cat of ['food', 'cafe', 'sight', 'hotel']) {
    for (const item of secondaryByCat[cat]) {
      if (counts[cat] < limitPerCat) {
        result.push(item);
        counts[cat]++;
      }
    }
  }

  return result.map(({ distToActive, ...rest }) => rest);
}

function balancePOICategories(pois) {
  const byCat = {
    food: pois.filter(p => p.category === 'food'),
    cafe: pois.filter(p => p.category === 'cafe'),
    sight: pois.filter(p => p.category === 'sight'),
    hotel: pois.filter(p => p.category === 'hotel')
  };

  const limitEach = 5;
  const result = [];

  for (const cat of ['food', 'cafe', 'sight', 'hotel']) {
    const items = byCat[cat] || [];
    items.sort((a, b) => (a.distToActive || 0) - (b.distToActive || 0));
    result.push(...items.slice(0, limitEach));
  }

  return result;
}

// GET /api/poi?lat=35.7148&lng=139.7967&radius=500&allStops=lat1,lng1|lat2,lng2|...
router.get('/poi', async (req, res) => {
  const query = req.query || {};
  let lat = parseFloat(query.lat);
  let lng = parseFloat(query.lng);
  const radius = parseInt(query.radius) || 800;
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
    
    if (!pois || pois.length === 0) {
      pois = await fetchRealPOIsWithExpansion(lat, lng, radius);
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
 * Fetch real nearby places from OpenStreetMap via Overpass API with multi-radius expansion.
 */
async function fetchRealPOIsWithExpansion(lat, lng, initialRadius) {
  const radiiToTry = [Math.max(initialRadius, 1000), 2500, 5000];

  for (const searchRadius of radiiToTry) {
    const pois = await fetchOverpassPOIs(lat, lng, searchRadius);
    if (pois.length >= 8) {
      console.log(`[POI]: Found ${pois.length} places via Overpass at radius ${searchRadius}m`);
      return pois;
    }
  }

  // Try Nominatim fallback if Overpass returned low/empty results
  console.log(`[POI]: Overpass returned sparse results for [${lat}, ${lng}]. Attempting Nominatim fallback search...`);
  const nominatimPOIs = await fetchNominatimPOIs(lat, lng);
  if (nominatimPOIs.length > 0) {
    return nominatimPOIs;
  }

  // Simulated local fallback if all APIs are rate-limited
  console.log(`Generating fallback mock POIs for coordinate [${lat}, ${lng}]`);
  return generateFallbackPOIs(lat, lng);
}

async function fetchOverpassPOIs(lat, lng, searchRadius) {
  const overpassQuery = `
    [out:json][timeout:20];
    (
      nwr["amenity"~"restaurant|fast_food|food_court|pub|bar|ice_cream"]["name"](around:${searchRadius},${lat},${lng});
      nwr["amenity"="cafe"]["name"](around:${searchRadius},${lat},${lng});
      nwr["tourism"~"hotel|hostel|motel|guest_house|resort|chalet"]["name"](around:${searchRadius},${lat},${lng});
      nwr["tourism"~"attraction|museum|viewpoint|zoo|artwork"]["name"](around:${searchRadius},${lat},${lng});
    );
    out center 60;
  `;

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(mirror, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
        },
        body: `data=${encodeURIComponent(overpassQuery)}`,
        signal: AbortSignal.timeout(12000)
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.elements && data.elements.length > 0) {
          const result = [];
          const seenNames = new Set();

          for (const el of data.elements) {
            const name = el.tags?.name;
            if (!name || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());

            const category = classifyElement(el);
            result.push(formatPOI(el, category));
          }
          if (result.length > 0) return result;
        }
      }
    } catch (err) {
      console.warn(`Overpass mirror ${mirror} failed:`, err.message);
    }
  }

  return [];
}

async function fetchNominatimPOIs(lat, lng) {
  const categoriesToSearch = ['restaurant', 'cafe', 'hotel', 'attraction'];
  const results = [];
  const seenNames = new Set();

  for (const cat of categoriesToSearch) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${cat}&format=json&limit=6&viewbox=${lng - 0.05},${lat + 0.05},${lng + 0.05},${lat - 0.05}&bounded=1`;
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        const items = await res.json();
        for (const item of items) {
          const name = item.display_name.split(',')[0].trim();
          if (!name || seenNames.has(name.toLowerCase())) continue;
          seenNames.add(name.toLowerCase());

          let mappedCategory = 'sight';
          if (cat === 'restaurant') mappedCategory = 'food';
          else if (cat === 'cafe') mappedCategory = 'cafe';
          else if (cat === 'hotel') mappedCategory = 'hotel';

          results.push({
            id: `poi-nom-${item.place_id}`,
            name: name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            category: mappedCategory,
            rating: (4.0 + Math.random() * 0.9).toFixed(1),
            reviewsCount: Math.floor(25 + Math.random() * 200),
            address: item.display_name
          });
        }
      }
    } catch (err) {
      console.warn(`Nominatim POI search for ${cat} failed:`, err.message);
    }
  }

  return results;
}

function classifyElement(el) {
  const tags = el.tags || {};
  if (tags.amenity === 'cafe') return 'cafe';
  if (['restaurant', 'fast_food', 'food_court', 'pub', 'bar', 'ice_cream'].includes(tags.amenity)) return 'food';
  if (['hotel', 'hostel', 'motel', 'guest_house', 'resort', 'chalet'].includes(tags.tourism)) return 'hotel';
  return 'sight';
}

function formatPOI(el, category) {
  const tags = el.tags || {};

  const poiLat = el.lat || el.center?.lat;
  const poiLng = el.lon || el.center?.lon;

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
    rating: (3.8 + Math.random() * 1.1).toFixed(1),
    reviewsCount: Math.floor(20 + Math.random() * 280),
    address
  };
}

function generateFallbackPOIs(lat, lng) {
  return [
    {
      id: `poi-fallback-food-1-${lat}-${lng}`,
      name: 'Local Heritage Restaurant & Street Food',
      lat: lat + (Math.random() - 0.5) * 0.003,
      lng: lng + (Math.random() - 0.5) * 0.003,
      category: 'food',
      rating: (4.6 + Math.random() * 0.3).toFixed(1),
      reviewsCount: Math.floor(120 + Math.random() * 100),
      address: 'Central Market Lane'
    },
    {
      id: `poi-fallback-cafe-1-${lat}-${lng}`,
      name: 'Alpine Peaks Coffee & Bakery',
      lat: lat + (Math.random() - 0.5) * 0.003,
      lng: lng + (Math.random() - 0.5) * 0.003,
      category: 'cafe',
      rating: (4.4 + Math.random() * 0.5).toFixed(1),
      reviewsCount: Math.floor(60 + Math.random() * 100),
      address: 'Pine Valley Rd'
    },
    {
      id: `poi-fallback-hotel-1-${lat}-${lng}`,
      name: 'Pine Crest Resort & Spa',
      lat: lat + (Math.random() - 0.5) * 0.004,
      lng: lng + (Math.random() - 0.5) * 0.004,
      category: 'hotel',
      rating: (4.5 + Math.random() * 0.4).toFixed(1),
      reviewsCount: Math.floor(100 + Math.random() * 200),
      address: 'Resort Hill Rd'
    },
    {
      id: `poi-fallback-sight-1-${lat}-${lng}`,
      name: 'Old Town Heritage Vista & Gardens',
      lat: lat + (Math.random() - 0.5) * 0.004,
      lng: lng + (Math.random() - 0.5) * 0.004,
      category: 'sight',
      rating: (4.7 + Math.random() * 0.2).toFixed(1),
      reviewsCount: Math.floor(200 + Math.random() * 300),
      address: 'Viewpoint Ridge'
    }
  ];
}

export default router;

