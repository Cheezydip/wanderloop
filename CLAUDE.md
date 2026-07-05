# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Status

This repo is **pre-code**: it currently contains only planning/spec documents. No
application has been scaffolded yet. The source of truth for what to build is:

- `TODO.md` — phased build plan and the open architectural decisions.
- `UI_DESIGN.md` — full visual spec (layout, color, components, interactions, states).
- `SKILL.md` — condensed UI conventions (the `wanderloop-ui` skill); read before
  building or styling any frontend component.

There is no build/lint/test tooling yet. When scaffolding (Phase 0 in `TODO.md`),
the intended stack is **Vite + React + TypeScript + Tailwind CSS**, with
**Mapbox GL JS** (recommended over Google Maps) for the map. Add the standard
`dev` / `build` / `lint` / `test` scripts to `package.json` and document them here
once they exist.

## What Wanderloop is

An AI-powered, **map-anchored** travel itinerary planner. The AI interviews the
user, generates a day-by-day plan rendered live on a map, supports conversational
editing, and recommends **route-aware homestays** (lodging ranked by how well it
fits each day's stops, plus price/reviews), all tracked against a budget.

## Architecture (intended)

The defining constraint is **three coordinated panels that stay in sync** — Chat
(left), Map (center, the hero), Itinerary (right). Any change in one panel updates
the others. Design state and data flow around this:

- **Core domain model** (build first, Phase 1): `Trip`, `Day`, `Stop`, `Homestay`,
  `Message`. Map markers/routes, itinerary cards, and chat all render from this
  shared state — there is one source of truth, three views.
- **Per-day color identity:** each day owns ONE hue (`teal → amber → violet →
  rose → lime`) shared by its map route polyline AND its sidebar card. Never reuse
  a day's hue within a trip. This linkage is what makes the panels feel coordinated.
- **AI loop:** a Claude tool-calling loop (backend — Node/Express or Python/FastAPI,
  undecided) drives the interview (clarifying questions one or two at a time) and
  returns a **structured itinerary JSON** (stops with lat/lng, time, cost). The
  frontend renders that JSON; the AI never draws the UI directly.
- **Route-aware lodging (Phase 5):** compute each day's center of gravity → cluster
  consecutive days into "stay zones" → query a lodging API per zone midpoint →
  blended score (route fit + price + reviews + amenities + host quality). This
  geographic-clustering logic is the app's hardest/most distinctive piece.
- **Travel-time awareness:** routes and travel times come from a Directions API and
  must **recompute on edit** (e.g. dragging a stop re-optimizes that day).

## Non-negotiable UX behaviors

These are the product's signature; preserve them when touching relevant code
(full detail in `UI_DESIGN.md`):

- Hover a homestay → its commute to that day's stops draws live on the map.
- Drag/delete a stop → routes and travel times recompute instantly.
- Scoped edits ("cheaper near day 3") re-rank only the affected zone/day.
- Every AI pick can reveal its reasoning ("why picked") on tap — this builds trust
  and should be carried through the data model (stops/homestays keep a rationale).
- Handle all five states explicitly: empty/first-prompt · interviewing · generated ·
  editing/re-optimizing · error/no-results.

## Open decisions (see `TODO.md`)

Map provider, lodging data source (Booking.com vs Hostelworld — Airbnb has no public
API), and backend language are not yet settled. Confirm with the user before locking
these in.
