---
name: wanderloop-ui
description: UI design conventions for the Wanderloop travel-planning web app. Use when building, styling, or reviewing any Wanderloop frontend component (chat panel, map, itinerary sidebar, homestay cards, budget tracker) so the look and behavior stay consistent. Full spec lives in UI_DESIGN.md.
---

# Wanderloop UI

Apply these conventions to every Wanderloop component. The full visual spec —
ASCII layout, component anatomy, and interaction states — is in
[`UI_DESIGN.md`](./UI_DESIGN.md). Read it before building a new screen.

## Core principle
**Map-anchored.** Every AI action is reflected on a live map. The three panels
— Chat, Map, Itinerary — stay in sync; changing one updates the others.

## Layout
- Three panels: **Chat** (left, ~320px) · **Map** (center, flex, the hero) ·
  **Itinerary** (right, ~360px).
- Small screens collapse the panels into tabs: Chat / Map / Plan.

## Theme tokens
| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0f1115` | app background |
| `--panel` | `#171a21` | panel surfaces |
| `--text` | `#e7e9ee` | primary text |
| `--muted` | `#9aa3b2` | secondary text |
| `--accent` | `#2dd4bf` | brand teal, primary actions |

- Fonts: **Inter** (UI), **JetBrains Mono** (cost/time badges).
- Rounded `xl` corners, soft shadows, generous padding.

## Per-day color palette
Each itinerary day gets ONE hue, shared by its map route AND its sidebar card:
`teal → amber → violet → rose → lime`. Never reuse a day's color for another day
within the same trip.

## Component rules
- **Chat:** AI bubbles left (panel bg), user right (accent tint); offer
  quick-reply chips under AI questions; show a typing indicator while planning.
- **Map:** day routes as colored polylines, numbered stop pins; stop popover
  shows photo, hours, est. time, est. cost, and "why picked". Homestays use a
  house icon; on hover, draw faint lines to that day's stops with travel times.
- **Itinerary:** collapsible day cards color-matched to the route; each stop row
  has time · name · cost · drag handle · delete; card footer shows day totals.
- **Homestay card:** name, ★ rating (count), "X min avg to Day N stops",
  price/night + over/under budget, amenity chips, `View on map` + `Choose`.
- **Budget tracker:** stacked bar split Lodging / Activities / Food / Transit;
  running total vs. budget band; turns amber then rose when over.

## Signature interactions (preserve these)
- Hover a homestay → its commute draws live on the map.
- Drag a stop → routes and travel times recompute instantly.
- "cheaper near day 3" → only that zone re-ranks.
- Every AI pick can reveal its reasoning on tap.

## States to handle
Empty/first-prompt · interviewing · generated · editing/re-optimizing ·
error/no-results.
