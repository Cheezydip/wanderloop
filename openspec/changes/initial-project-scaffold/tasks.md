## 1. Project Scaffold (Phase 0)

- [x] 1.1 Initialize Vite + React + TypeScript project in the workspace root using `npx create-vite`
- [x] 1.2 Install core dependencies: `react`, `react-dom`, `mapbox-gl`
- [x] 1.3 Install dev dependencies: `tailwindcss`, `@tailwindcss/vite`, `eslint`, `prettier`, `@types/react`, `@types/react-dom`
- [x] 1.4 Configure Tailwind CSS v4 via Vite plugin with `@theme` design tokens (colors, fonts, spacing from UI_DESIGN.md)
- [x] 1.5 Create `.env.example` with `VITE_MAPBOX_TOKEN=` and add `.env` to `.gitignore`
- [x] 1.6 Configure ESLint and Prettier; add `lint` and `format` scripts to `package.json`
- [x] 1.7 Load Google Fonts (Inter, JetBrains Mono) in `index.html`

## 2. Design System & Global Styles

- [x] 2.1 Define CSS custom properties in the main stylesheet: `--bg`, `--panel`, `--text`, `--muted`, `--accent`, `--day-1` through `--day-5`
- [x] 2.2 Configure Tailwind `@theme` to expose custom properties as utility classes (e.g., `bg-panel`, `text-accent`)
- [x] 2.3 Set global body styles: `--bg` background, `--text` foreground, Inter font family, no page-level scroll
- [x] 2.4 Create a reusable `Surface` component (rounded-xl, `--panel` bg, soft shadow, generous padding)

## 3. Domain Model & State

- [x] 3.1 Create `src/models/types.ts` with TypeScript interfaces: `Trip`, `Day`, `Stop`, `Homestay`, `Message`
- [x] 3.2 Create `src/context/TripContext.tsx` with React Context + `useReducer` holding `Trip` state
- [x] 3.3 Define reducer actions: `SET_TRIP`, `ADD_STOP`, `REMOVE_STOP`, `MOVE_STOP`, `ADD_MESSAGE`
- [x] 3.4 Create a `src/data/mockTrip.ts` with sample 3-day Japan trip data (stops with lat/lng, costs, rationale) for first-view rendering

## 4. Three-Panel Layout

- [x] 4.1 Create `src/App.tsx` with CSS Grid layout: three columns (`320px 1fr 360px`), full viewport height below top bar
- [x] 4.2 Build `TopBar` component: Wanderloop logo, trip title, Budget dropdown placeholder, Save button
- [x] 4.3 Implement responsive breakpoint at `< 768px`: collapse grid to single column with a tab bar (Chat | Map | Plan)
- [x] 4.4 Create `MobileTabBar` component with active tab state management

## 5. Chat Panel

- [x] 5.1 Create `ChatPanel` component with scrollable message list and input area at the bottom
- [x] 5.2 Build `ChatBubble` component: AI messages (left-aligned, panel bg) and user messages (right-aligned, accent tint)
- [x] 5.3 Build `QuickReplyChips` component for AI suggestion chips (e.g., `Relaxed` · `Packed`)
- [x] 5.4 Add a text input with send button (+ mic icon placeholder for future voice)
- [x] 5.5 Render mock conversation from the sample trip data to populate the first view

## 6. Map Panel

- [x] 6.1 Create `MapPanel` component with `useRef` + `useEffect` pattern for Mapbox GL JS initialization
- [x] 6.2 Use `mapbox://styles/mapbox/dark-v11` style; read token from `import.meta.env.VITE_MAPBOX_TOKEN`
- [x] 6.3 Add graceful fallback: if token is missing/invalid, render a styled placeholder message instead of crashing
- [x] 6.4 Add zoom controls (NavigationControl) positioned top-right
- [x] 6.5 Add placeholder "Fit Trip" button in top-right controls area
- [x] 6.6 Render mock stop markers on the map using the sample trip data (color-coded per day)
- [x] 6.7 Draw day-colored polyline routes connecting stops within each day

## 7. Itinerary Panel

- [x] 7.1 Create `ItineraryPanel` component with scrollable list of day cards
- [x] 7.2 Build `DayCard` component: collapsible, color-bar on left edge matching `--day-{n}`, day number header
- [x] 7.3 Build `StopRow` component: time badge · stop name · cost badge · drag handle placeholder · delete button placeholder
- [x] 7.4 Add card footer with day totals (total time, total spend) in JetBrains Mono
- [x] 7.5 Render mock itinerary from the sample trip data to populate the first view

## 8. Integration & Polish

- [x] 8.1 Wrap `App` in `TripProvider` and pass mock trip data as initial state
- [x] 8.2 Verify all three panels render simultaneously on desktop with correct proportions
- [x] 8.3 Verify mobile tab switching works at `< 768px`
- [x] 8.4 Verify map renders with markers and routes when a valid Mapbox token is provided
- [x] 8.5 Run `npm run lint` and fix any errors
- [x] 8.6 Run `npm run dev` and confirm the app loads without errors
