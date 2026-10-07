export function parseCoordinate(val) {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'number' ? val : parseFloat(val);
  return (typeof num === 'number' && !isNaN(num) && isFinite(num) && num !== 0) ? num : null;
}

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

        const hLat = parseCoordinate(hotel.lat);
        const hLng = parseCoordinate(hotel.lng);

        if (shouldInclude && hotel && (hLat !== null || (hotel.name && hotel.name.trim().length > 0))) {
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
            lat: hLat !== null ? hLat : hotel.lat,
            lng: hLng !== null ? hLng : hotel.lng,
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
      if (!stop) return;
      const sLat = parseCoordinate(stop.lat);
      const sLng = parseCoordinate(stop.lng);
      if (sLat !== null || (stop.name && stop.name.trim().length > 0)) {
        allStops.push({
          ...stop,
          lat: sLat !== null ? sLat : stop.lat,
          lng: sLng !== null ? sLng : stop.lng,
          dayNumber: day.dayNumber,
          dayId: day.id
        });
      }
    });
  });

  return allStops;
}

/**
 * Formats a stop into a location string suitable for Google Maps API.
 * Uses place names with destination city context when available,
 * or raw lat,lng as fallback.
 */
export function formatStopForMaps(stop, tripTitle = '', destination = '') {
  if (!stop) return '';

  if (stop.name && typeof stop.name === 'string' && stop.name.trim().length > 0) {
    let cleanName = stop.name.trim().replace(/\s*\(Hotel\)/gi, '').replace(/\(([^)]+)\)/g, '$1');
    const city = destination || (tripTitle ? tripTitle.split(' ')[0] : '');
    if (city && !cleanName.toLowerCase().includes(city.toLowerCase())) {
      cleanName += `, ${city}`;
    }
    return encodeURIComponent(cleanName);
  }

  const lat = parseCoordinate(stop.lat);
  const lng = parseCoordinate(stop.lng);

  if (lat !== null && lng !== null) {
    return `${lat},${lng}`;
  }

  return '';
}

export function buildGoogleMapsUrl(stops = [], travelMode = 'transit', tripTitle = '', destination = '') {
  if (!stops || !Array.isArray(stops) || stops.length === 0) {
    return 'https://www.google.com/maps';
  }

  const validStops = stops.filter(s => s && (s.name || parseCoordinate(s.lat) !== null));
  if (validStops.length === 0) return 'https://www.google.com/maps';

  if (validStops.length === 1) {
    return buildSinglePlaceGoogleMapsUrl(validStops[0], tripTitle, destination);
  }

  const formatRouteStop = (s) => {
    return formatStopForMaps(s, tripTitle, destination);
  };

  const originParam = formatRouteStop(validStops[0]);
  const destParam = formatRouteStop(validStops[validStops.length - 1]);
  const intermediateStops = validStops.slice(1, validStops.length - 1);

  // CRITICAL GOOGLE MAPS API REQUIREMENT:
  // Google Maps Directions URLs ('/dir/?api=1') DO NOT support waypoints when 'travelmode=transit'.
  // If 'travelmode=transit' is passed with waypoints, Google Maps silently discards all intermediate waypoints and shows only origin + destination.
  // For multi-stop routes with intermediate waypoints, we use 'walking' or 'driving' so Google Maps displays ALL stops on the map.
  let effectiveTravelMode = ['walking', 'driving', 'bicycling'].includes(travelMode) ? travelMode : 'driving';
  if (travelMode === 'transit' && intermediateStops.length === 0) {
    effectiveTravelMode = 'transit';
  }

  let url = `https://www.google.com/maps/dir/?api=1&origin=${originParam}&destination=${destParam}&travelmode=${effectiveTravelMode}`;

  if (intermediateStops.length > 0) {
    const cappedWaypoints = intermediateStops.slice(0, 23);
    const waypointsParam = cappedWaypoints.map(formatRouteStop).filter(Boolean).join('%7C');
    if (waypointsParam) {
      url += `&waypoints=${waypointsParam}`;
    }
  }

  return url;
}

/**
 * Builds an Apple Maps direction link for iOS / macOS devices.
 */
export function buildAppleMapsUrl(stops = [], tripTitle = '', destination = '') {
  const validStops = stops.filter(s => s && (s.name || parseCoordinate(s.lat) !== null));
  if (validStops.length === 0) return 'https://maps.apple.com';

  if (validStops.length === 1) {
    const single = validStops[0];
    const lat = parseCoordinate(single.lat);
    const lng = parseCoordinate(single.lng);
    const q = (lat !== null && lng !== null)
      ? `${lat},${lng}`
      : formatStopForMaps(single, tripTitle, destination);
    return `https://maps.apple.com/?q=${q}`;
  }

  const formatAppleStop = (s) => {
    const lat = parseCoordinate(s.lat);
    const lng = parseCoordinate(s.lng);
    if (lat !== null && lng !== null) {
      return `${lat},${lng}`;
    }
    return formatStopForMaps(s, tripTitle, destination);
  };

  const origin = formatAppleStop(validStops[0]);
  const destinationParam = formatAppleStop(validStops[validStops.length - 1]);
  const middleStops = validStops.slice(1, validStops.length - 1);

  if (middleStops.length === 0) {
    return `https://maps.apple.com/?saddr=${origin}&daddr=${destinationParam}`;
  }

  const daddrs = [...middleStops.map(formatAppleStop), destinationParam].join('&daddr=');
  return `https://maps.apple.com/?saddr=${origin}&daddr=${daddrs}`;
}

/**
 * Builds a Google Maps search/place link for a single place with exact pin positioning.
 */
export function buildSinglePlaceGoogleMapsUrl(stop, tripTitle = '', destination = '') {
  if (!stop) return 'https://www.google.com/maps';

  let cleanName = stop.name ? stop.name.trim().replace(/\s*\(Hotel\)/gi, '').replace(/\(([^)]+)\)/g, '$1') : '';
  const city = destination || (tripTitle ? tripTitle.split(' ')[0] : '');

  if (cleanName) {
    let fullQuery = cleanName;
    if (city && !cleanName.toLowerCase().includes(city.toLowerCase())) {
      fullQuery += `, ${city}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullQuery)}`;
  }

  const lat = parseCoordinate(stop.lat);
  const lng = parseCoordinate(stop.lng);
  if (lat !== null && lng !== null) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }

  return 'https://www.google.com/maps';
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
