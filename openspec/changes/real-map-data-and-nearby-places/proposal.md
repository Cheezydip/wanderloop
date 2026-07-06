## Why

Wanderloop requires a production-ready, interactive mapping system that operates on real-world data rather than mock static SVG overlays. Since Mapbox requires a credit card and has potential billing risks, migrating to a free, open-source stack using MapLibre GL JS and OpenFreeMap's Dark Style provides street-level details while remaining keyless. Furthermore, integrating live routing/geocoding (via OpenRouteService) and adding nearby places exploration is necessary to deliver the production travel-planning experience users expect.

## What Changes

- **Core Map Engine Migration**: Swap the mock SVG layout and Mapbox GL library for a production-ready MapLibre GL JS engine.
- **Visual Style Integration**: Integrate OpenFreeMap's dark street style tiles, aligning with the website's dark/teal premium theme.
- **Interactive mapcn Components**: Deploy custom, copy-paste React components styled with Tailwind CSS (inspired by `mapcn` and `shadcn/ui`) for zoom, reset, layer toggle, stop markers, and homestay house pins.
- **Real-World API Routing**: Replace static route mocks with the OpenRouteService Directions API to show real routes, driving/walking times, and dynamic travel badges.
- **Geocoding & Location Search**: Connect the AI search/chat panel to the OpenRouteService Geocoding API to resolve address strings into live coordinates.
- **Nearby Places Search**: Allow the map or AI to query and display points of interest (restaurants, cafes, attractions) near the itinerary stops, showing reviews and ratings.

## Capabilities

### New Capabilities
- `maplibre-openfreemap-integration`: A fully interactive MapLibre map engine utilizing OpenFreeMap's dark styles with custom React controls, custom day-colored stop markers, and homestay house pins.
- `real-world-routing-and-geocoding`: Backend and frontend API integrations with OpenRouteService for live route generation, travel-time calculations, and address/place geocoding.
- `nearby-places-exploration`: Interactive points-of-interest (POI) query and visualization on the map near selected itinerary stops, allowing users to browse ratings/reviews and add places.

### Modified Capabilities

## Impact

- **Frontend (`@wanderloop/frontend`)**:
  - `package.json`: Remove `mapbox-gl`, install `maplibre-gl`.
  - `MapPanel.jsx`: Complete rewrite from SVG/mock to MapLibre GL JS live canvas with custom markers and line layers.
  - Chat panel and TopBar: Enable real address searches and coordinate resolution.
- **Backend (`@wanderloop/backend`)**:
  - Integrate OpenRouteService API client handlers for routing and geocoding.
  - Cache routes and geocode results to respect ORS daily/per-minute rate limits.
- **Environment**:
  - Deprecate `VITE_MAPBOX_TOKEN`.
  - Add `ORS_API_KEY` to `.env` for backend routing/geocoding requests.
