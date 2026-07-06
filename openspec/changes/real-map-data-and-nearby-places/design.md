## Context

Wanderloop is structured as a React client and Express backend. The map is a central component that visualizes stops and routes. Currently, map rendering is done via a static SVG mock layout when a Mapbox token is absent, or by initializing a basic Mapbox GL map without rendering any markers or routes. 

To make this application production-ready, we need to replace the SVG mockup with a live vector map engine. Because Mapbox requires credit card registration and carries billing overage risks, we will use **MapLibre GL JS** paired with **OpenFreeMap's Dark Style** to render premium dark maps with detailed street layouts completely free. We will also integrate **OpenRouteService** for geocoding, directions, and nearby points of interest (POIs).

## Goals / Non-Goals

**Goals:**
- Replace the mock SVG canvas with a fully interactive MapLibre GL JS map using the OpenFreeMap dark style.
- Draw color-coded route lines connecting itinerary stops using GeoJSON sources.
- Draw custom HTML-based stop markers (numbered and matching the day's hue) and homestay house pins.
- Implement a backend service that proxies and caches OpenRouteService Directions and Geocoding API requests to secure credentials and avoid rate limits.
- Allow users and the AI agent to search addresses and view/select nearby places (POIs) directly on the map.
- Maintain coordination between the three panels (Chat, Map, Itinerary) via context dispatch actions.

**Non-Goals:**
- No commercial tile hosting (e.g. Mapbox, MapTiler, Stadia) requiring credit card registration.
- No client-side exposure of the OpenRouteService API keys.
- No offline map caching beyond standard browser cache and backend endpoint cache.

## Decisions

### 1. MapLibre GL JS with OpenFreeMap Dark Style
- **Choice:** MapLibre GL JS as the map engine and `https://tiles.openfreemap.org/styles/dark` as the style source.
- **Rationale:** MapLibre GL JS is open-source and performs exactly like Mapbox GL JS (it was forked from Mapbox GL v1). OpenFreeMap provides hosted vector tiles that display streets, parks, and building footprints in a clean dark theme, completely free and without requiring API keys.
- **Alternatives Considered:** 
  - *Mapbox GL JS v3*: Requires credit card registration and charges beyond the free limit.
  - *OpenStreetMap Raster Tiles*: Free, but raster tiles do not support rotation/zooming smoothly and cannot be styled to match the dark obsidian theme of Wanderloop.

### 2. Backend Proxy and Cache for OpenRouteService
- **Choice:** Run all Directions, Geocoding, and POI requests through the Node/Express backend (`/api/route`, `/api/geocode`, `/api/poi`) and cache results in-memory.
- **Rationale:** OpenRouteService's free tier is limited to 40 requests/minute and 2,000 requests/day. Caching responses on the backend using hashed coordinate queries prevents hitting rate limits during dev/testing and keeps the ORS API key hidden from the client.
- **Alternatives Considered:** 
  - *Direct client calls*: Exposes the API key in client-side code and makes caching across sessions impossible.

### 3. Custom HTML Markers via MapLibre DOM Integration
- **Choice:** Create markers using custom HTML divs injected via `new maplibregl.Marker({ element: el })`, styled using Tailwind CSS (following the `mapcn` component design principles).
- **Rationale:** Allows stops to match the custom day hues (`teal`, `amber`, etc.) and the brand font (Sora), supporting custom animations (pulse glow) and interactive click handlers.
- **Alternatives Considered:** 
  - *MapLibre Icon Layers*: Drawing markers inside the canvas layer is faster for thousands of pins, but makes custom CSS styling, Tailwind compatibility, and React state binding complex.

### 4. Interactive Nearby Places (POIs) Layer
- **Choice:** Query POIs near stops via the OpenRouteService Points of Interest API, displaying them as category-coded pins on the map (e.g. food, tourism).
- **Rationale:** Fits the requirement to show nearby places. Users can click any POI pin to view details and add it directly to their itinerary.

## Risks / Trade-offs

- **[ORS Rate Limits]** → The ORS free tier is limited. Mitigation: Implement backend caching and debounce geocoding search inputs to avoid triggering multiple rapid requests.
- **[OpenFreeMap Availability]** → OpenFreeMap is a community-supported project. Mitigation: Keep the mock SVG canvas in the code as a graceful error fallback if the MapLibre map initialization fails.
