## ADDED Requirements

### Requirement: Fetch Real-world Route and Directions
The system SHALL query the OpenRouteService Directions API on the backend to retrieve actual driving, walking, or transit routing paths and travel times between consecutive stops.

#### Scenario: Route calculation between stops
- **WHEN** a stop is added, deleted, or reordered in the itinerary
- **THEN** the system requests route coordinates and durations from OpenRouteService and updates the day's total travel time and map polyline coordinates

### Requirement: Resolve Address Search Queries
The system SHALL query the OpenRouteService Geocoding API to resolve unstructured search strings entered by the user or AI agent into geographic coordinates.

#### Scenario: User searches for address
- **WHEN** the user submits a location query in the search bar
- **THEN** the geocoding service resolves it into latitude and longitude coordinates, and the map centers on that location

### Requirement: Backend API Request Caching
The backend API server SHALL cache OpenRouteService routing and geocoding responses to minimize network requests, speed up UI rendering, and prevent rate limit exhaustion.

#### Scenario: Re-fetching an identical route request
- **WHEN** a routing request matches the coordinates of a previously cached request
- **THEN** the system returns the cached routing JSON response without calling the OpenRouteService API
