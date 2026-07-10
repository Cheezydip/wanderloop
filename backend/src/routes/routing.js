import { Router } from 'express';
import { routeCache, tableCache, optimizeCache } from '../utils/cache.js';

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
            },
            legs: route.legs
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

// POST /api/route/table
router.post('/route/table', async (req, res) => {
  try {
    const { coordinates, profile = 'foot-walking' } = req.body || {};
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'At least 2 coordinates are required' });
    }

    const cacheKey = `${profile}-${JSON.stringify(coordinates)}`;
    const cachedData = tableCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const osrmProfile = profile.includes('driving') ? 'car' : profile.includes('cycling') ? 'bicycle' : 'foot';
    const coordinatesJoined = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `https://router.project-osrm.org/table/v1/${osrmProfile}/${coordinatesJoined}?annotations=distance,duration`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OSRM Table returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok') {
      throw new Error(`OSRM Table query failed: ${data.code}`);
    }

    tableCache.set(cacheKey, data);
    return res.status(200).json(data);

  } catch (error) {
    console.error('Table routing error:', error);
    const coords = (req.body && req.body.coordinates) || [];
    return res.status(200).json(generateMockTable(coords));
  }
});

// POST /api/route/optimize
router.post('/route/optimize', async (req, res) => {
  try {
    const { coordinates, profile = 'foot-walking' } = req.body || {};
    
    if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
      return res.status(400).json({ error: 'At least 2 coordinates are required' });
    }

    const cacheKey = `${profile}-${JSON.stringify(coordinates)}`;
    const cachedData = optimizeCache.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const osrmProfile = profile.includes('driving') ? 'car' : profile.includes('cycling') ? 'bicycle' : 'foot';
    const coordinatesJoined = coordinates.map(c => `${c[0]},${c[1]}`).join(';');
    const url = `https://router.project-osrm.org/trip/v1/${osrmProfile}/${coordinatesJoined}?source=first&destination=any&roundtrip=false&geometries=geojson&overview=full`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'WanderloopTravelPlanner/1.0 (contact: rupayansaha@wanderloop.com)'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OSRM Trip returned error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.code !== 'Ok') {
      throw new Error(`OSRM Trip query failed: ${data.code}`);
    }

    optimizeCache.set(cacheKey, data);
    return res.status(200).json(data);

  } catch (error) {
    console.error('Optimization routing error:', error);
    const coords = (req.body && req.body.coordinates) || [];
    return res.status(200).json(generateMockOptimize(coords));
  }
});

// Helper to generate mock GeoJSON route between points using Haversine formula
function generateMockRoute(coordinates, profile) {
  const speed = profile === 'foot-walking' ? 1.4 : 11.0; // walking: 5 km/h, driving: 40 km/h
  
  let totalDistance = 0;
  const legs = [];

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
    legs.push({
      distance: d,
      duration: d / speed
    });
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
          },
          legs: legs
        },
        geometry: {
          type: 'LineString',
          coordinates: coordinates
        }
      }
    ]
  };
}

function generateMockTable(coordinates) {
  const n = coordinates.length;
  const distances = Array.from({ length: n }, () => Array(n).fill(0));
  const durations = Array.from({ length: n }, () => Array(n).fill(0));
  const speed = 1.4; // 1.4 m/s walking speed

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const [lng1, lat1] = coordinates[i];
      const [lng2, lat2] = coordinates[j];
      
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

      distances[i][j] = d;
      durations[i][j] = d / speed;
    }
  }

  return { code: 'Ok', distances, durations };
}

function generateMockOptimize(coordinates) {
  const n = coordinates.length;
  if (n <= 2) {
    return {
      code: 'Ok',
      waypoints: coordinates.map((c, idx) => ({ waypoint_index: idx }))
    };
  }

  const unvisited = new Set(Array.from({ length: n - 1 }, (_, i) => i + 1));
  const visitOrder = [0];

  let currentIdx = 0;
  while (unvisited.size > 0) {
    let nearestIdx = -1;
    let minDistance = Infinity;

    const [lng1, lat1] = coordinates[currentIdx];
    for (const nextIdx of unvisited) {
      const [lng2, lat2] = coordinates[nextIdx];
      const distSq = Math.pow(lng2 - lng1, 2) + Math.pow(lat2 - lat1, 2);
      if (distSq < minDistance) {
        minDistance = distSq;
        nearestIdx = nextIdx;
      }
    }

    visitOrder.push(nearestIdx);
    unvisited.delete(nearestIdx);
    currentIdx = nearestIdx;
  }

  const waypoints = Array.from({ length: n }, (_, idx) => {
    const seq = visitOrder.indexOf(idx);
    return { waypoint_index: seq };
  });

  return { code: 'Ok', waypoints };
}

export default router;
