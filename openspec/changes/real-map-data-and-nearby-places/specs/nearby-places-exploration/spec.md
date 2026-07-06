## ADDED Requirements

### Requirement: Query Nearby Points of Interest
The system SHALL query nearby points of interest (POIs) in specified categories (e.g. food, culture, transit) within a designated radius around any selected itinerary stop using the OpenRouteService POI API or a local geography dataset.

#### Scenario: Query nearby places
- **WHEN** the user selects an itinerary stop and clicks the "Show Nearby Places" option
- **THEN** the system fetches and displays points of interest within 500 meters of the stop

### Requirement: Render Nearby Place Markers
The system SHALL render category-coded markers on the map for each returned nearby place, displaying details on click or hover.

#### Scenario: View nearby place details
- **WHEN** nearby places are fetched and shown on the map
- **THEN** category-specific icons appear on the map, and hovering over a pin reveals a card with the place name, rating, and brief review summary

### Requirement: Add Nearby Place to Itinerary
The system SHALL support appending or inserting any selected nearby place as a new stop in the active day's itinerary.

#### Scenario: Insert nearby place as a stop
- **WHEN** the user clicks "Add to Itinerary" on a nearby place's details card
- **THEN** the place is added to the active day's stops list, and the map routes and travel times recompute automatically
