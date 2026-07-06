## 1. Setup and Package Migration

- [x] 1.1 Uninstall mapbox-gl and install maplibre-gl in frontend workspace
- [x] 1.2 Add ORS_API_KEY to .env and configure .env.example with the new variable

## 2. Backend OpenRouteService Integration & Cache

- [x] 2.1 Set up OpenRouteService Directions proxy router with in-memory caching
- [x] 2.2 Set up Geocoding proxy router for address resolution
- [x] 2.3 Set up POI (Points of Interest) proxy router for nearby places search
- [x] 2.4 Mount the routing, geocoding, and POI routers under backend /api path

## 3. MapLibre GL JS & OpenFreeMap Core Map Integration

- [x] 3.1 Initialize MapLibre GL JS with OpenFreeMap Dark style in MapPanel.jsx
- [x] 3.2 Add MapLibre layers and sources to render dynamic day-colored routes
- [x] 3.3 Create and draw custom styled numbered stop markers on the map
- [x] 3.4 Create and draw custom house-icon markers for homestay locations
- [x] 3.5 Draw interactive hover dotted commute lines between homestays and stops

## 4. Location Search & Directions Integration

- [x] 4.1 Update ChatPanel input to call geocoding API for address searches
- [x] 4.2 Recompute day routes via backend Directions API when stops are edited or reordered
- [x] 4.3 Center and auto-fit map bounds around stops on change

## 5. Nearby Places Exploration

- [x] 5.1 Implement "Show Nearby" option on stop details card to query nearby POIs
- [x] 5.2 Render category-coded markers on the map for nearby POIs
- [x] 5.3 Show hover/click popup for POI pins displaying ratings, reviews, and address
- [x] 5.4 Bind "Add to Itinerary" action on POI popups to insert the stop and recompute routes

## 6. Build & End-to-End Verification

- [x] 6.1 Verify frontend and backend lint and type check succeed
- [x] 6.2 Test live geocoding, directions, and nearby places addition in the dev browser
