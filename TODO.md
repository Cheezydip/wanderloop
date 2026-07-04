# Wanderloop — TODO

AI-powered, map-anchored travel itinerary planner. The AI interviews the user,
builds a day-by-day plan rendered on a map, and recommends route-aware homestays
with prices and reviews.

## Legend
- [ ] not started
- [~] in progress
- [x] done

---

## Phase 0 — Project setup
- [ ] Scaffold Vite + React + TypeScript
- [ ] Add Tailwind CSS
- [ ] Add Mapbox GL JS (or Google Maps JS)
- [ ] Set up `.env` for API keys (Mapbox token, Claude API key)
- [ ] ESLint + Prettier
- [ ] Git init + first commit

## Phase 1 — Core layout (MVP shell)
- [ ] Three-panel layout: Chat (left) · Map (center) · Itinerary (right)
- [ ] Responsive collapse for small screens
- [ ] App state model: `Trip`, `Day`, `Stop`, `Homestay`, `Message`

## Phase 2 — AI interview flow
- [ ] Open prompt input ("5 days in Japan, love food...")
- [ ] Claude tool-calling loop (backend)
- [ ] Clarifying questions one/two at a time (dates, pace, budget, party, diet)
- [ ] Persist answered preferences

## Phase 3 — Itinerary generation
- [ ] Claude returns structured itinerary JSON (stops w/ lat/lng, time, cost)
- [ ] Render day routes on map (color-coded per day)
- [ ] Itinerary sidebar: day-by-day cards with reasoning
- [ ] Travel-time awareness (Directions API) + geographic clustering

## Phase 4 — Conversational editing
- [ ] Drag/delete pins → re-optimize
- [ ] Natural-language edits ("too much walking on day 2")
- [ ] Explain-why per stop

## Phase 5 — Route-aware homestays
- [ ] Compute each day's center of gravity
- [ ] Cluster consecutive days into "stay zones"
- [ ] Query lodging API (Booking.com / Hostelworld) per zone midpoint
- [ ] Blended score: route fit + price + reviews + amenities + host quality
- [ ] House-icon pins; hover draws lines to that day's stops
- [ ] Stay-vs-relocate recommendation
- [ ] Lock selection into budget tracker

## Phase 6 — Budget tracker
- [ ] Split: Lodging / Activities / Food / Transit
- [ ] Live running total vs. user budget band

## Phase 7 — Persistence & accounts (post-MVP)
- [ ] Save trips (Postgres)
- [ ] User accounts + saved preferences
- [ ] Share trip via link

## Stretch / later
- [ ] Flight + booking integration
- [ ] Offline / PDF export of itinerary
- [ ] Mobile app

---

## Open decisions
- Map provider: **Mapbox GL** (recommended) vs Google Maps JS
- Lodging data source: Booking.com Affiliate vs Hostelworld (Airbnb has no public API)
- Backend: Node/Express vs Python/FastAPI for the Claude tool-calling loop
