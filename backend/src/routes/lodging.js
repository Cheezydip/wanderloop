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

    const formattedLodgings = generateMockLodgings(lat, lng);
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
