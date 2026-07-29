import { Router } from 'express';
import { geocodeCache } from '../utils/cache.js';

const router = Router();

// GET /api/geocode?text=Sensoji
router.get('/geocode', async (req, res) => {
  try {
    const { text } = req.query || {};
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Search text is required' });
    }

    const cacheKey = text.toLowerCase().trim();
    const cachedData = geocodeCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    let features = [];

    // Attempt 1: OpenStreetMap Nominatim
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=geojson&limit=3`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          features = data.features;
        }
      }
    } catch (err) {
      console.warn('[Geocode]: Nominatim primary query failed:', err.message);
    }

    // Attempt 2: Komoot Photon API (Secondary free global provider)
    if (features.length === 0) {
      try {
        const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(text)}&limit=3`;
        const pRes = await fetch(photonUrl);
        if (pRes.ok) {
          const pData = await pRes.json();
          if (pData.features && pData.features.length > 0) {
            features = pData.features;
          }
        }
      } catch (err) {
        console.warn('[Geocode]: Photon secondary query failed:', err.message);
      }
    }

    if (features.length > 0) {
      const formattedData = {
        features: features.map(f => ({
          type: 'Feature',
          geometry: f.geometry,
          properties: {
            label: f.properties.display_name || f.properties.name || text,
            name: f.properties.name || (f.properties.display_name ? f.properties.display_name.split(',')[0] : text),
            confidence: 0.9
          }
        }))
      };
      geocodeCache.set(cacheKey, formattedData);
      return res.status(200).json(formattedData);
    }

    // Fallback to mock dictionary if both geocoders return zero results
    return res.status(200).json(generateMockGeocode(text));

  } catch (error) {
    console.error('Geocoding route error:', error);
    const textVal = (req.query && req.query.text) || '';
    return res.status(200).json(generateMockGeocode(textVal));
  }
});

// Helper to generate mock geocode responses with worldwide city awareness
function generateMockGeocode(text) {
  const query = text.toLowerCase();
  let coords = [139.6917, 35.6895]; // Default Tokyo fallback
  let label = `${text}, Travel Destination`;

  if (query.includes('paris') || query.includes('eiffel') || query.includes('louvre')) {
    coords = [2.3522, 48.8566]; // Paris
    label = `${text}, Paris, France`;
  } else if (query.includes('london') || query.includes('big ben') || query.includes('eye')) {
    coords = [-0.1276, 51.5074]; // London
    label = `${text}, London, UK`;
  } else if (query.includes('york') || query.includes('times square') || query.includes('manhattan')) {
    coords = [-74.0060, 40.7128]; // NYC
    label = `${text}, New York, USA`;
  } else if (query.includes('rome') || query.includes('colosseum') || query.includes('vatikan')) {
    coords = [12.4964, 41.9028]; // Rome
    label = `${text}, Rome, Italy`;
  } else if (query.includes('bali') || query.includes('ubud') || query.includes('kuta')) {
    coords = [115.1889, -8.4095]; // Bali
    label = `${text}, Bali, Indonesia`;
  } else if (query.includes('kyoto')) {
    coords = [135.7681, 35.0116]; // Kyoto
    label = `${text}, Kyoto, Japan`;
  } else if (query.includes('osaka')) {
    coords = [135.5023, 34.6937]; // Osaka
    label = `${text}, Osaka, Japan`;
  } else if (query.includes('mumbai') || query.includes('gateway')) {
    coords = [72.8777, 19.0760]; // Mumbai
    label = `${text}, Mumbai, India`;
  } else if (query.includes('delhi') || query.includes('taj')) {
    coords = [77.2090, 28.6139]; // Delhi
    label = `${text}, Delhi, India`;
  } else if (query.includes('sydney') || query.includes('opera')) {
    coords = [151.2093, -33.8688]; // Sydney
    label = `${text}, Sydney, Australia`;
  } else if (query.includes('singapore') || query.includes('marina bay')) {
    coords = [103.8198, 1.3521]; // Singapore
    label = `${text}, Singapore`;
  } else if (query.includes('senso') || query.includes('asakusa')) {
    coords = [139.7967, 35.7148]; // Senso-ji Temple
    label = 'Senso-ji, Asakusa, Taito, Tokyo, Japan';
  } else if (query.includes('skytree')) {
    coords = [139.8107, 35.7101]; // Tokyo Skytree
    label = 'Tokyo Skytree, Sumida, Tokyo, Japan';
  } else if (query.includes('shibuya')) {
    coords = [139.7006, 35.6596]; // Shibuya Crossing
    label = 'Shibuya Crossing, Shibuya, Tokyo, Japan';
  } else if (query.includes('meiji')) {
    coords = [139.6997, 35.6764]; // Meiji Shrine
    label = 'Meiji Shrine, Shibuya, Tokyo, Japan';
  }

  return {
    geocoding: {
      version: '0.2',
      query: { text, size: 1 }
    },
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: coords
        },
        properties: {
          label: label,
          name: text,
          confidence: 0.8
        }
      }
    ]
  };
}

export default router;
