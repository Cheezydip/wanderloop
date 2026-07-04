## ADDED Requirements

### Requirement: Dark theme tokens are defined
The system SHALL define CSS custom properties for the dark theme as specified in `UI_DESIGN.md`: `--bg: #0f1115`, `--panel: #171a21`, `--text: #e7e9ee`, `--muted: #9aa3b2`, `--accent: #2dd4bf`.

#### Scenario: Panel surfaces use correct dark colors
- **WHEN** a panel component renders
- **THEN** it uses `--panel` as its background and `--text` as its foreground color

### Requirement: Per-day color palette is defined
The system SHALL define a palette of five day colors (teal, amber, violet, rose, lime) as CSS custom properties (`--day-1` through `--day-5`) that are never reused within a single trip.

#### Scenario: Day colors are distinct
- **WHEN** a trip has 5 days
- **THEN** each day's route polyline and itinerary card use a unique hue from the palette

### Requirement: Typography uses Inter and JetBrains Mono
The system SHALL load Inter as the primary UI font and JetBrains Mono as the monospace font for costs, times, and badges.

#### Scenario: Fonts load correctly
- **WHEN** the application loads
- **THEN** body text renders in Inter and cost/time badges render in JetBrains Mono

### Requirement: UI primitives follow design spec
The system SHALL use `rounded-xl` corners, soft shadows, and generous padding on all panel surfaces and cards, matching the visual style described in `UI_DESIGN.md`.

#### Scenario: Surface component styling
- **WHEN** a Surface component renders
- **THEN** it has rounded-xl corners, a soft box-shadow, and the `--panel` background color
