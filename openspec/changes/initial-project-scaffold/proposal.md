## Why

Wanderloop is currently a pre-code repository containing only planning and specification documents. To move from vision to a working product, we need to scaffold the project foundation (Phase 0) and build the core three-panel layout shell (Phase 1). This establishes the runnable application, the design system, and the shared state model that every future feature—AI interview, itinerary generation, homestay ranking—will build on top of.

## What Changes

- Scaffold a new **Vite + React + TypeScript** project with Tailwind CSS.
- Integrate **Mapbox GL JS** for the map panel.
- Implement the signature **three-panel layout**: Chat (left, ≈320px) · Map (center, flex hero) · Itinerary (right, ≈360px), with responsive tab-based collapse on small screens.
- Build the **design system** from the UI spec tokens: dark theme (`#0f1115` bg, `#171a21` panels), brand teal accent, per-day color palette, Inter + JetBrains Mono typography, rounded-xl surfaces.
- Create the **core domain model** types: `Trip`, `Day`, `Stop`, `Homestay`, `Message`.
- Build placeholder UI components for each panel (chat input, map view, itinerary cards) so the user sees a complete, styled first view of the app.
- Set up `.env` for API keys (Mapbox token) and configure ESLint + Prettier.

## Capabilities

### New Capabilities
- `project-scaffold`: Vite + React + TypeScript project setup with Tailwind CSS, ESLint, Prettier, and environment configuration.
- `design-system`: Dark-theme design tokens, color palette (including per-day hues), typography (Inter, JetBrains Mono), and reusable UI primitives (surfaces, badges, buttons).
- `three-panel-layout`: The core Chat · Map · Itinerary three-panel layout with responsive collapse to tabs on mobile.
- `map-integration`: Mapbox GL JS integration in the center panel with dark style, zoom controls, and placeholder for routes/pins.
- `domain-model`: TypeScript types and shared state structure for Trip, Day, Stop, Homestay, and Message entities.

### Modified Capabilities
_(none — this is a greenfield project)_

## Impact

- **New files**: Entire project structure under the workspace root (`package.json`, `src/`, `public/`, config files).
- **Dependencies**: `react`, `react-dom`, `mapbox-gl`, `tailwindcss`, `eslint`, `prettier`, and their TypeScript type packages.
- **Environment**: Requires a `VITE_MAPBOX_TOKEN` environment variable for the map to render tiles.
- **No backend yet**: This change is frontend-only. The AI interview loop and lodging engine are deferred to later changes.
