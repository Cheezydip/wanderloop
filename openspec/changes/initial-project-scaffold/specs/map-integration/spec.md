## ADDED Requirements

### Requirement: Mapbox GL JS initializes in the map panel
The system SHALL render a Mapbox GL JS map instance inside the center panel using the `dark-v11` style and the token from `VITE_MAPBOX_TOKEN`.

#### Scenario: Map renders with dark style
- **WHEN** the application loads with a valid Mapbox token
- **THEN** a full-size interactive map renders in the center panel using the `mapbox://styles/mapbox/dark-v11` style

### Requirement: Map includes basic controls
The system SHALL display zoom controls and a "fit trip" button in the top-right corner of the map panel.

#### Scenario: Zoom controls are visible
- **WHEN** the map renders
- **THEN** zoom in/out controls and a fit-trip button are visible in the top-right area of the map

### Requirement: Map handles missing token gracefully
The system SHALL display a placeholder message in the map panel if the Mapbox token is missing or invalid, rather than crashing.

#### Scenario: No token fallback
- **WHEN** `VITE_MAPBOX_TOKEN` is not set or is invalid
- **THEN** the map panel shows a styled placeholder message explaining that a Mapbox token is needed
