/**
 * Export utilities for generating Google Maps, Apple Maps, GPX, and KML links/files for Wanderloop itineraries.
 */

/**
 * Extracts all stops across all days in sequential order, including selected hotels/homestays.
 * @param {Object} trip The trip object containing days and stops
 * @param {Array} homestays List of available homestays/hotels
 * @param {Object} selectedHomestaysByDay Map of dayId -> array of selected homestay IDs
 * @param {string} selectedHomestayId Single selected homestay ID fallback
 * @param {boolean} includeHotels Whether to include hotels in the exported stops list
 * @returns {Array} List of all stops with day context
 */
export function getAllStopsFromTrip(
  trip,
  homestays = [],
  selectedHomestaysByDay = {},
  selectedHomestayId = null,
  includeHotels = true
) {
  if (!trip || !Array.isArray(trip.days)) return [];

  const allStops = [];
  trip.days.forEach(day => {
    // Resolve selected hotels for this day
    if (includeHotels && Array.isArray(homestays) && homestays.length > 0) {
      const dayHotelIds = selectedHomestaysByDay?.[day.id] || [];
      let dayHotels = [];
      if (Array.isArray(dayHotelIds) && dayHotelIds.length > 0) {
        dayHotels = homestays.filter(h => dayHotelIds.includes(h.id));
      } else if (selectedHomestayId) {
        const found = homestays.find(h => h.id === selectedHomestayId);
        if (found) dayHotels = [found];
      }

      dayHotels.forEach(hotel => {
        const key = `hotel-${day.id}-${hotel.id}`;
        let shouldInclude = true;
        if (typeof includeHotels === 'boolean') {
          shouldInclude = includeHotels;
        } else if (typeof includeHotels === 'object' && includeHotels !== null) {
          shouldInclude = includeHotels[key] !== false;
        }

        if (shouldInclude && hotel && typeof hotel.lat === 'number' && typeof hotel.lng === 'number') {
          const hotelName = hotel.name.toLowerCase().includes('hotel') ||
            hotel.name.toLowerCase().includes('ryokan') ||
            hotel.name.toLowerCase().includes('homestay') ||
            hotel.name.toLowerCase().includes('studio') ||
            hotel.name.toLowerCase().includes('loft')
              ? hotel.name
              : `${hotel.name} (Hotel)`;

          allStops.push({
            id: key,
            name: hotelName,
            lat: hotel.lat,
            lng: hotel.lng,
            dayNumber: day.dayNumber,
            dayId: day.id,
            timeEstimate: 'Overnight Stay / Starting Point',
            rationale: `Selected lodging: ${hotel.name}`,
            isHotel: true
          });
        }
      });
    }

    // Add regular itinerary stops
    (day.stops || []).forEach(stop => {
      if (stop && typeof stop.lat === 'number' && typeof stop.lng === 'number') {
        allStops.push({
          ...stop,
          dayNumber: day.dayNumber,
          dayId: day.id
        });
      }
    });
  });

  return allStops;
}

/**
 * Builds a Google Maps Directions URL for a given array of stops.
/**
 * Formats a stop into a location string suitable for Google Maps API.
 * Uses place names with destination city context when available,
 * or raw lat,lng as fallback.
 */
export function formatStopForMaps(stop, tripTitle = '') {
  if (!stop) return '';

  if (stop.name && typeof stop.name === 'string' && stop.name.trim().length > 0) {
    let cleanName = stop.name.trim();

    // Clean up hotel suffix or extra parenthesis formatting if present
    cleanName = cleanName.replace(/\s*\(Hotel\)/gi, '').replace(/\(([^)]+)\)/g, '$1');

    // Extract city context from trip title
    let city = '';
    if (tripTitle && typeof tripTitle === 'string') {
      const lowerTitle = tripTitle.toLowerCase();
      if (lowerTitle.includes('tokyo')) city = 'Tokyo';
      else if (lowerTitle.includes('kyoto')) city = 'Kyoto';
      else if (lowerTitle.includes('osaka')) city = 'Osaka';
      else if (lowerTitle.includes('hakone')) city = 'Hakone';
    }

    if (city && !cleanName.toLowerCase().includes(city.toLowerCase())) {
      cleanName += `, ${city}`;
    }

    return encodeURIComponent(cleanName);
  }

  if (typeof stop.lat === 'number' && typeof stop.lng === 'number' && !isNaN(stop.lat) && !isNaN(stop.lng)) {
    return `${stop.lat},${stop.lng}`;
  }

  return '';
}

export function buildGoogleMapsUrl(stops = [], travelMode = 'transit', tripTitle = '') {
  if (!stops || !Array.isArray(stops) || stops.length === 0) {
    return 'https://www.google.com/maps';
  }

  const validStops = stops.filter(s => s && (s.name || (typeof s.lat === 'number' && typeof s.lng === 'number')));
  if (validStops.length === 0) return 'https://www.google.com/maps';

  const validTravelMode = ['transit', 'walking', 'driving', 'bicycling'].includes(travelMode) ? travelMode : 'transit';

  if (validStops.length === 1) {
    const single = validStops[0];
    const query = formatStopForMaps(single, tripTitle);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }

  const originParam = formatStopForMaps(validStops[0], tripTitle);
  const destParam = formatStopForMaps(validStops[validStops.length - 1], tripTitle);

  let url = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=${validTravelMode}`;

  const intermediateStops = validStops.slice(1, validStops.length - 1);
  if (intermediateStops.length > 0) {
    const cappedWaypoints = intermediateStops.slice(0, 9);
    const waypointsParam = cappedWaypoints.map(s => formatStopForMaps(s, tripTitle)).join('%7C');
    url += `&waypoints=${waypointsParam}`;
  }

  return url;
}

/**
 * Builds an Apple Maps direction link for iOS / macOS devices.
 */
export function buildAppleMapsUrl(stops = [], tripTitle = '') {
  const validStops = stops.filter(s => s && (s.name || (typeof s.lat === 'number' && typeof s.lng === 'number')));
  if (validStops.length === 0) return 'https://maps.apple.com';

  if (validStops.length === 1) {
    const single = validStops[0];
    return `https://maps.apple.com/?q=${formatStopForMaps(single, tripTitle)}`;
  }

  const origin = formatStopForMaps(validStops[0], tripTitle);
  const dest = formatStopForMaps(validStops[validStops.length - 1], tripTitle);
  return `https://maps.apple.com/?saddr=${origin}&daddr=${dest}`;
}

/**
 * Builds a Google Maps search link for a single place.
 */
export function buildSinglePlaceGoogleMapsUrl(stop, tripTitle = '') {
  if (!stop) return 'https://www.google.com/maps';
  const query = formatStopForMaps(stop, tripTitle);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

/**
 * Generates GPX (GPS Exchange Format) XML string for the entire trip.
 */
export function generateGPX(trip, homestays = [], selectedHomestaysByDay = {}, selectedHomestayId = null, includeHotels = true) {
  const title = (trip?.title || 'Wanderloop Itinerary').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const stops = getAllStopsFromTrip(trip, homestays, selectedHomestaysByDay, selectedHomestayId, includeHotels);

  let waypointsXml = '';
  let trackXml = '';

  stops.forEach((stop) => {
    const name = `Day ${stop.dayNumber}: ${stop.name || 'Stop'}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const desc = `${stop.timeEstimate || ''} - ${stop.rationale || ''}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    waypointsXml += `  <wpt lat="${stop.lat}" lon="${stop.lng}">
    <name>${name}</name>
    <desc>${desc}</desc>
    <sym>Flag</sym>
  </wpt>\n`;

    trackXml += `      <trkpt lat="${stop.lat}" lon="${stop.lng}">
        <name>${name}</name>
      </trkpt>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Wanderloop Travel Planner - https://wanderloop.app" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${title}</name>
    <desc>Complete itinerary exported from Wanderloop</desc>
  </metadata>
${waypointsXml}  <trk>
    <name>${title} Route</name>
    <trkseg>
${trackXml}    </trkseg>
  </trk>
</gpx>`;
}

/**
 * Generates KML (Keyhole Markup Language) XML string for Google Earth / My Maps.
 */
export function generateKML(trip, homestays = [], selectedHomestaysByDay = {}, selectedHomestayId = null, includeHotels = true) {
  const title = (trip?.title || 'Wanderloop Itinerary').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const stops = getAllStopsFromTrip(trip, homestays, selectedHomestaysByDay, selectedHomestayId, includeHotels);

  let placemarksXml = '';
  stops.forEach(stop => {
    const name = `Day ${stop.dayNumber}: ${stop.name || 'Stop'}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const desc = `${stop.timeEstimate || ''} | ${stop.rationale || ''}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    placemarksXml += `    <Placemark>
      <name>${name}</name>
      <description>${desc}</description>
      <Point>
        <coordinates>${stop.lng},${stop.lat},0</coordinates>
      </Point>
    </Placemark>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${title}</name>
    <description>Exported multi-day itinerary from Wanderloop</description>
${placemarksXml}  </Document>
</kml>`;
}

/**
 * Triggers a browser file download.
 */
export function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to copy text to clipboard with fallback.
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  }
}
