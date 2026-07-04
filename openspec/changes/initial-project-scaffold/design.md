## Context

Wanderloop is a greenfield AI-powered travel planner. The repo currently contains only planning documents (`CLAUDE.md`, `TODO.md`, `UI_DESIGN.md`, `ARCHITECTURE.md`) and no application code. This design covers the initial scaffold (Phase 0) and core layout shell (Phase 1) — the foundation every subsequent feature builds on.

The defining UI constraint is a **three-panel layout** (Chat · Map · Itinerary) that shares a single source of truth. The design system uses a dark theme optimized for map readability, with per-day color coding that visually links routes on the map to cards in the sidebar.

## Goals / Non-Goals

**Goals:**
- A runnable Vite + React + TypeScript app with Tailwind CSS and Mapbox GL JS.
- The three-panel layout rendering with correct proportions, responsive collapse to tabs on mobile.
- A complete design system: CSS custom properties for all UI tokens, dark theme, day-color palette, Inter + JetBrains Mono fonts.
- TypeScript domain model types (`Trip`, `Day`, `Stop`, `Homestay`, `Message`) ready for state management.
- Placeholder UI for each panel so the "first view" feels like a real product (not a blank scaffold).
- Dev tooling: ESLint, Prettier, `.env` for `VITE_MAPBOX_TOKEN`.

**Non-Goals:**
- No backend / API server in this change.
- No AI interview flow or Claude API integration.
- No real data fetching, routing, or lodging logic.
- No user authentication or persistence.
- No unit/integration tests (deferred to a follow-up once patterns stabilize).

## Decisions

### 1. Vite over Next.js or CRA
**Choice:** Vite with React + TypeScript template.
**Rationale:** Wanderloop is a client-heavy SPA with a map as the hero. SSR offers no benefit for a map-anchored app. Vite gives instant HMR and simple config. Next.js adds routing, SSR, and server complexity we don't need yet.
**Alternatives considered:** Next.js (overkill for SPA), Create React App (deprecated/slow).

### 2. Tailwind CSS (v4)
**Choice:** Tailwind CSS v4 via the Vite plugin.
**Rationale:** Specified in the project docs. v4's CSS-first configuration and `@theme` directive map naturally to the custom design tokens in `UI_DESIGN.md`. Utility-first keeps component styles co-located and scannable.
**Alternatives considered:** Vanilla CSS (more boilerplate), CSS Modules (less ergonomic for rapid prototyping).

### 3. Mapbox GL JS (not Google Maps)
**Choice:** `mapbox-gl` npm package, dark style (`mapbox://styles/mapbox/dark-v11`).
**Rationale:** Recommended in `TODO.md`. Free tier is generous. Dark map styles complement the app's dark theme natively. `mapbox-gl` has first-class React wrappers (`react-map-gl`) but we'll start with the vanilla JS library in a `useRef` + `useEffect` pattern for maximum control over layers/sources.
**Alternatives considered:** Google Maps JS SDK (more expensive, less stylable dark mode), Leaflet (no vector tiles, less performant for dense routes).

### 4. State management — React Context + useReducer (for now)
**Choice:** A single `TripContext` with `useReducer` holding the `Trip` state tree.
**Rationale:** The domain model is well-defined but small at this stage. Context + reducer keeps things simple and avoids adding Zustand/Redux until we know the access patterns. The reducer actions map to domain events (add stop, move stop, update day, etc.) making a future migration to a dedicated store trivial.
**Alternatives considered:** Zustand (likely upgrade path once complexity grows), Redux Toolkit (heavy for initial scaffold).

### 5. Project structure — feature-based folders
**Choice:**
```
src/
  components/     # Shared UI primitives (Button, Badge, Surface)
  features/
    chat/         # ChatPanel component + related hooks
    map/          # MapPanel component + Mapbox integration
    itinerary/    # ItineraryPanel component + day/stop cards
  models/         # TypeScript types (Trip, Day, Stop, etc.)
  context/        # TripContext provider + reducer
  styles/         # Global CSS, design tokens
  App.tsx         # Root layout (three panels)
  main.tsx        # Vite entry
```
**Rationale:** Feature folders group related code, making it easy to find and extend a panel without touching unrelated files. Shared primitives live in `components/`.

### 6. Responsive strategy — CSS Grid + media query collapse
**Choice:** CSS Grid for the three-panel layout. At `< 768px`, collapse to a tabbed single-panel view (Chat | Map | Plan tabs).
**Rationale:** Grid gives precise column sizing (`320px 1fr 360px`). The tab bar on mobile matches the spec in `UI_DESIGN.md` ("Small screens: panels become tabs").

### 7. Per-day color palette — CSS custom properties
**Choice:** Define `--day-1` through `--day-5` (teal, amber, violet, rose, lime) as CSS custom properties. Components read `var(--day-{n})` dynamically.
**Rationale:** A single source of truth for day colors that both Tailwind utilities and Mapbox layer paint properties can reference.

## Risks / Trade-offs

- **[Mapbox token exposure]** → The token is in a `VITE_` env var, which is bundled into client JS. Mitigation: Use a URL-restricted token in production. Acceptable for dev/MVP.
- **[Context re-renders at scale]** → A single TripContext may cause unnecessary re-renders when the trip grows large. Mitigation: Acceptable for Phase 1; plan to migrate to Zustand or split contexts when performance profiling shows issues.
- **[No tests yet]** → Deferring tests until patterns stabilize. Mitigation: The domain model types provide compile-time safety. Tests will be added in a follow-up change.
- **[Placeholder data only]** → The first view uses hardcoded mock data. Mitigation: This is intentional — the goal is to validate the layout and design system before wiring real data.
