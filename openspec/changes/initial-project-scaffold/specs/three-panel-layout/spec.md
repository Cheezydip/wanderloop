## ADDED Requirements

### Requirement: Three-panel layout renders correctly
The system SHALL display three coordinated panels in a horizontal layout: Chat (left, ≈320px fixed), Map (center, flex/fill), and Itinerary (right, ≈360px fixed).

#### Scenario: Desktop layout proportions
- **WHEN** the application renders on a viewport ≥ 768px wide
- **THEN** the Chat panel is ≈320px wide on the left, the Map panel fills remaining space in the center, and the Itinerary panel is ≈360px wide on the right

### Requirement: Responsive collapse to tabs on mobile
The system SHALL collapse the three-panel layout into a single-panel tabbed view on screens narrower than 768px, with tabs labeled "Chat", "Map", and "Plan".

#### Scenario: Mobile tab navigation
- **WHEN** the viewport is less than 768px wide
- **THEN** only one panel is visible at a time, with a tab bar at the top allowing the user to switch between Chat, Map, and Plan views

### Requirement: Top bar displays trip context
The system SHALL render a top bar containing the Wanderloop logo/name, the current trip title, and action buttons (Budget dropdown, Save).

#### Scenario: Top bar renders
- **WHEN** the application loads
- **THEN** the top bar is visible at the top of the viewport showing the app name, trip title, and action buttons

### Requirement: Panels occupy full viewport height
The system SHALL ensure the three panels (or the active tab on mobile) fill the available viewport height below the top bar, with no page-level scrolling.

#### Scenario: Full height layout
- **WHEN** the application renders
- **THEN** the panel area stretches from below the top bar to the bottom of the viewport
