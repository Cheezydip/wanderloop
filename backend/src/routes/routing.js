import { Router } from 'express';
import { routeCache } from '../utils/cache.js';

const router = Router();

// POST /api/route
router.post('/route', async (req, res) => {
  try {
    const { coordinates, profile = 'foot-walking' } = req.body || {};
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'At least 2 coordinates are required' });
    }

    // Cache key based on profile + coordinates
    const cacheKey = `${profile}-${JSON.stringify(coordinates)}`;
    const cachedData = routeCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Map profile to OSRM service type (foot, car, bike)
    const osrmProfile = profile.includes('driving') ? 'car' : profile.includes('cycling') ? 'bicycle' : 'foot';
    const coordinatesJoined = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/${osrmProfile}/${coordinatesJoined}?overview=full&geometries=geojson`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OSRM returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(`OSRM routing failed: ${data.code}`);
    }

    const route = data.routes[0];
    const formattedData = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {
            summary: {
              distance: route.distance, // in meters
              duration: route.duration  // in seconds
            }
          },
          geometry: route.geometry
        }
      ]
    };

    routeCache.set(cacheKey, formattedData);
    return res.status(200).json(formattedData);

  } catch (error) {
    console.error('Routing error:', error);
    // Graceful fallback to mock route
    const coords = (req.body && req.body.coordinates) || [];
    const prof = (req.body && req.body.profile) || 'foot-walking';
    return res.status(200).json(generateMockRoute(coords, prof));
  }
});

// Helper to generate mock GeoJSON route between points using Haversine formula
function generateMockRoute(coordinates, profile) {
  const speed = profile === 'foot-walking' ? 1.4 : 11.0; // walking: 5 km/h, driving: 40 km/h
  
  let totalDistance = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lng1, lat1] = coordinates[i];
    const [lng2, lat2] = coordinates[i+1];
    
    const R = 6371e3; // Earth radius in metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // in metres
    
    totalDistance += d;
  }

  const totalDuration = totalDistance / speed;

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          summary: {
            distance: totalDistance,
            duration: totalDuration
          }
        },
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    ]
  };
}

export default router;
