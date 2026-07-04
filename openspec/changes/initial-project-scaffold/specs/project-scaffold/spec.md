## ADDED Requirements

### Requirement: Vite React TypeScript project initializes
The system SHALL scaffold a Vite application using the React + TypeScript template with all required dependencies installed and dev/build/lint scripts configured in `package.json`.

#### Scenario: Fresh project scaffold
- **WHEN** a developer clones the repo and runs `npm install` followed by `npm run dev`
- **THEN** the Vite dev server starts without errors and serves the application on localhost

### Requirement: Tailwind CSS is configured
The system SHALL include Tailwind CSS v4 integrated via the Vite plugin, with the project's custom design tokens defined using the `@theme` directive.

#### Scenario: Tailwind utilities render correctly
- **WHEN** a component uses Tailwind utility classes (e.g., `bg-panel`, `text-muted`)
- **THEN** the correct CSS custom property values from the design system are applied

### Requirement: Environment variables are configured
The system SHALL use a `.env` file (gitignored) and a `.env.example` file to manage API keys, with `VITE_MAPBOX_TOKEN` as the required variable.

#### Scenario: Missing env var shows guidance
- **WHEN** the Mapbox token environment variable is not set
- **THEN** the map panel displays a helpful message indicating the token is required, rather than crashing

### Requirement: ESLint and Prettier are configured
The system SHALL include ESLint and Prettier configurations with `lint` and `format` scripts in `package.json`.

#### Scenario: Lint runs without errors on scaffold
- **WHEN** a developer runs `npm run lint` on the freshly scaffolded project
- **THEN** no linting errors are reported
