## ADDED Requirements

### Requirement: Trip type is defined
The system SHALL define a `Trip` TypeScript interface containing an `id`, `title`, `days` array, `budget` (optional), and `messages` array.

#### Scenario: Trip type is importable
- **WHEN** a component imports the `Trip` type from the models module
- **THEN** TypeScript compiles without errors and the type includes `id`, `title`, `days`, `budget`, and `messages` fields

### Requirement: Day type is defined
The system SHALL define a `Day` TypeScript interface containing an `id`, `dayNumber`, `colorHue` (from the day palette), and `stops` array.

#### Scenario: Day type includes color assignment
- **WHEN** a `Day` object is created
- **THEN** it has a `colorHue` field that maps to one of the five palette colors (teal, amber, violet, rose, lime)

### Requirement: Stop type is defined
The system SHALL define a `Stop` TypeScript interface containing `id`, `name`, `lat`, `lng`, `timeEstimate`, `costEstimate`, `rationale` (AI reasoning), and `order` (position within a day).

#### Scenario: Stop carries rationale
- **WHEN** a `Stop` object is created
- **THEN** it includes a `rationale` string field for displaying "why picked" reasoning

### Requirement: Homestay type is defined
The system SHALL define a `Homestay` TypeScript interface containing `id`, `name`, `lat`, `lng`, `pricePerNight`, `rating`, `reviewCount`, `amenities` array, `avgCommuteMinutes`, and `rationale`.

#### Scenario: Homestay includes scoring fields
- **WHEN** a `Homestay` object is created
- **THEN** it includes `rating`, `reviewCount`, `pricePerNight`, and `avgCommuteMinutes` for blended scoring

### Requirement: Message type is defined
The system SHALL define a `Message` TypeScript interface containing `id`, `role` (user or assistant), `content`, and `timestamp`.

#### Scenario: Message distinguishes sender
- **WHEN** a `Message` object is created
- **THEN** its `role` field is either `"user"` or `"assistant"`

### Requirement: Shared state context is provided
The system SHALL provide a React Context (`TripContext`) with a `useReducer`-based state management pattern that holds the current `Trip` and exposes dispatch for domain actions.

#### Scenario: Components access trip state
- **WHEN** a component calls `useTripContext()`
- **THEN** it receives the current `Trip` state and a `dispatch` function for state mutations
