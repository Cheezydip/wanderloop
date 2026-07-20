/**
 * Haversine formula — calculates the great-circle distance between two points
 * on Earth given their latitude and longitude in decimal degrees.
 * Returns distance in kilometers.
 */
export function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Converts a haversine distance (km) into a human-readable travel label.
 * Thresholds match the reference design:
 *   < 5 km  → "walk"
 *   < 30 km → "Xmin train"
 *   ≥ 30 km → "Xh shinkansen"
 */
export function getTravelLabel(distKm) {
  if (distKm < 1.5) return `${Math.max(1, Math.round(distKm / 0.08))}min walk`;
  if (distKm < 15) return `${Math.max(1, Math.round(distKm / 0.5))}min drive`;
  if (distKm < 100) return `${Math.round(distKm / 0.8)}min train`;
  return `${Math.max(1, Math.round(distKm / 250))}h train`;
}
