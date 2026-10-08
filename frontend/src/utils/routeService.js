/**
 * Route Service to interact with the backend OSRM routing routes.
 */

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

// Helper to make POST requests
async function postData(url = '', data = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches the route geometry and leg summaries for a set of coordinates.
 * @param {Array<Array<number>>} coordinates [[lng, lat], ...]
 * @param {string} profile 'foot-walking' | 'driving-car'
 */
export async function fetchRoute(coordinates, profile = 'foot-walking') {
  return postData(`${API_BASE}/api/route`, { coordinates, profile });
}

/**
 * Fetches the distance and duration matrix between all coordinates.
 * @param {Array<Array<number>>} coordinates [[lng, lat], ...]
 * @param {string} profile 'foot-walking' | 'driving-car'
 */
export async function fetchDistanceTable(coordinates, profile = 'foot-walking') {
  return postData(`${API_BASE}/api/route/table`, { coordinates, profile });
}

/**
 * Fetches the TSP optimized waypoint ordering and geometry for a set of coordinates.
 * @param {Array<Array<number>>} coordinates [[lng, lat], ...]
 * @param {string} profile 'foot-walking' | 'driving-car'
 */
export async function fetchOptimizedOrder(coordinates, profile = 'foot-walking') {
  return postData(`${API_BASE}/api/route/optimize`, { coordinates, profile });
}

