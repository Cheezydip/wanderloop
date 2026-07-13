import { Router } from 'express';
import { poiCache } from '../utils/cache.js';

const router = Router();

// GET /api/poi?lat=35.7148&lng=139.7967&radius=500
router.get('/poi', async (req, res) => {
  const query = req.query || {};
  let lat = parseFloat(query.lat);
  let lng = parseFloat(query.lng);
  const radius = parseInt(query.radius) || 500;
  
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng are required' });
  }

  try {
    const cacheKey = `${lat}-${lng}-${radius}`;
    const cachedData = poiCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const formattedPOIs = generateMockPOIs(lat, lng);
    poiCache.set(cacheKey, formattedPOIs);
    return res.status(200).json(formattedPOIs);

  } catch (error) {
    console.error('POI error:', error);
    return res.status(200).json(generateMockPOIs(lat, lng));
  }
});



function generateMockPOIs(lat, lng) {
  const offsets = [
    { dLat: 0.0012, dLng: -0.0008, name: 'Local Ramen Shop', category: 'food', rating: '4.8', reviews: 215, address: '2-chome-3 Asakusa' },
    { dLat: -0.0009, dLng: 0.0015, name: 'Premium Coffee Lab', category: 'cafe', rating: '4.6', reviews: 88, address: '1-chome-5 Hanakawado' },
    { dLat: 0.0019, dLng: 0.0011, name: 'Traditional Craft Museum', category: 'sight', rating: '4.7', reviews: 142, address: '3-chome-2 Asakusa' },
  ];

  if (lat > 35.65 && lat < 35.67 && lng > 139.69 && lng < 139.71) {
    offsets[0].name = 'Ichiran Shibuya Ramen';
    offsets[0].address = '1-chome-22 Jinnan';
    offsets[1].name = 'Streamer Coffee Shibuya';
    offsets[1].address = '1-chome-20 Shibuya';
    offsets[2].name = 'Hachiko Memorial Statue';
    offsets[2].address = 'Shibuya Station';
  } else if (lat > 35.64 && lat < 35.66 && lng > 139.78 && lng < 139.80) {
    offsets[0].name = 'Toyosu Sushi Market';
    offsets[0].address = '6-chome Toyosu';
    offsets[1].name = 'Blue Bottle Coffee Toyosu';
    offsets[1].address = '3-chome Toyosu';
    offsets[2].name = 'Gas Science Museum';
    offsets[2].address = '2-chome Toyosu';
  }

  return offsets.map((o, i) => ({
    id: `poi-mock-${i}-${Date.now()}`,
    name: o.name,
    lat: lat + o.dLat,
    lng: lng + o.dLng,
    category: o.category,
    rating: o.rating,
    reviewsCount: o.reviews,
    address: o.address
  }));
}

export default router;
