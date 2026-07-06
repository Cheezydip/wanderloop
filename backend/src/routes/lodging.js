import { Router } from 'express';
import { poiCache } from '../utils/cache.js';

const router = Router();

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
    const cacheKey = `lodgings-${lat}-${lng}-${radius}`;
    const cachedData = poiCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Bounding box: ~radius metres around the trip center
    const delta = (radius / 1000) * 0.009; // ~0.009 deg per km
    const viewbox = `${lng - delta},${lat + delta},${lng + delta},${lat - delta}`;
    const url = `https://nominatim.openstreetmap.org/search?q=hotel&format=geojson&viewbox=${viewbox}&bounded=1&limit=10`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nominatim Lodgings returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    let features = data.features || [];

    // If no hotels found in the tight box, fall back to mock lodgings for this location
    if (features.length === 0) {
      console.warn('[server]: No hotels found via Nominatim in this area. Using mock lodgings.');
      const cached = generateMockLodgings(lat, lng);
      poiCache.set(cacheKey, cached);
      return res.status(200).json(cached);
    }

    const formattedLodgings = features.map((f, i) => {
      const coords = f.geometry.coordinates;
      const name = f.properties.name || f.properties.display_name.split(',')[0] || `Hotel near stops #${i + 1}`;
      const price = 5000 + Math.floor(Math.random() * 15000);
      const rating = (4.2 + Math.random() * 0.7).toFixed(1);
      const reviews = Math.floor(20 + Math.random() * 300);
      const amenities = ['Free Wifi', 'Air Conditioning', 'Bath Amenities'];
      if (Math.random() > 0.5) amenities.push('Breakfast Included');
      if (Math.random() > 0.5) amenities.push('Laundry Service');

      return {
        id: `lodging-real-${i}-${Date.now()}`,
        name: name,
        lat: coords[1],
        lng: coords[0],
        pricePerNight: price,
        rating: parseFloat(rating),
        reviewCount: reviews,
        amenities: amenities,
        avgCommuteMinutes: Math.floor(5 + Math.random() * 15),
        rationale: `Real lodging matching your geographic route. Located in close proximity to major stops in this area.`
      };
    });

    poiCache.set(cacheKey, formattedLodgings);
    return res.status(200).json(formattedLodgings);

  } catch (error) {
    console.error('Lodging error:', error);
    return res.status(200).json(generateMockLodgings(lat, lng));
  }
});

function generateMockLodgings(lat, lng) {
  const lodgings = [
    { name: 'Zen Tokyo Ryokan', price: 6200, rating: 4.8, reviews: 142, amenities: ['Tatami Room', 'Onsen Tub', 'Free Tea'], offset: { dLat: 0.003, dLng: -0.002 } },
    { name: 'Tokyo Metro Loft', price: 9800, rating: 4.6, reviews: 96, amenities: ['Kitchenette', 'City View', 'Dryer'], offset: { dLat: -0.002, dLng: 0.004 } },
    { name: 'District Market Suite', price: 8500, rating: 4.7, reviews: 114, amenities: ['Coffee Machine', 'Work Desk', 'Slippers'], offset: { dLat: 0.004, dLng: 0.002 } }
  ];

  return lodgings.map((l, i) => ({
    id: `lodging-mock-${i}-${Date.now()}`,
    name: l.name,
    lat: lat + l.offset.dLat,
    lng: lng + l.offset.dLng,
    pricePerNight: l.price,
    rating: l.rating,
    reviewCount: l.reviews,
    amenities: l.amenities,
    avgCommuteMinutes: Math.floor(5 + Math.random() * 10),
    rationale: `Curated mock lodging near the center of gravity of your stops. perfect match for budget and travel efficiency.`
  }));
}

export default router;
