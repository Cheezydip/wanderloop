## ADDED Requirements

### Requirement: MapLibre GL JS Initialization with OpenFreeMap Dark Style
The system SHALL initialize a MapLibre GL JS map instance inside the map panel, loading OpenFreeMap's dark street styles without requiring any API keys.

#### Scenario: Successful initialization
- **WHEN** the MapPanel component is rendered
- **THEN** an interactive MapLibre map is initialized using the style URL `https://tiles.openfreemap.org/styles/dark`

### Requirement: Render Day-Specific Route Polylines
The system SHALL draw travel routes for each day of the active trip on the map canvas as solid line layers using MapLibre GL JS GeoJSON sources.

#### Scenario: Render trip routes
- **WHEN** the trip data is loaded with multiple stops per day
- **THEN** the map renders line layers matching the day-specific color hue (Teal, Amber, Violet, Rose, or Lime) connecting the stops in sequence

### Requirement: Render Numbered Stop Markers
The system SHALL place custom HTML markers on the map at the coordinates of each itinerary stop, styled with the corresponding day's color hue and displaying the stop's sequence number.

#### Scenario: Render stop pins
- **WHEN** the stop coordinates are loaded
- **THEN** custom DOM element markers appear on the map with the day's color and the stop's sequence number

### Requirement: Render Homestay House Markers
The system SHALL display custom markers with house icons for each available homestay option on the map when the map layer is set to "homestays".

#### Scenario: Render homestay pins
- **WHEN** the map layer is switched to "homestays"
- **THEN** homestay locations display custom house-icon pins on the map

### Requirement: Commute Line Visualization
The system SHALL draw visual commute connection lines on the map from a hovered or selected homestay marker to all stops of the active day, showing travel durations.

#### Scenario: Hover homestay marker
- **WHEN** the user hovers over a homestay pin on the map
- **THEN** dotted route lines are dynamically added between that homestay and all itinerary stops of the active day, with commute times labeled on the map
