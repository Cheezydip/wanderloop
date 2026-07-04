# Wanderloop — UI Design

The interface is **map-anchored**: everything the AI does is reflected on a live
map. Three coordinated panels keep chat, map, and plan always in sync.

---

## 1. Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ▣ Wanderloop          Trip: Japan · 5 days        [Budget ▾] [Save]  │  ← Top bar
├───────────────┬─────────────────────────────────┬───────────────────┤
│               │                                 │                   │
│   AI CHAT      │            MAP                  │   ITINERARY       │
│   (interview   │   (routes, stop pins,          │   (day-by-day     │
│    + edits)    │    homestay house-icons)        │    cards)         │
│               │                                 │                   │
│  ┌─────────┐  │     ●──●──●   Day 1 (teal)      │   Day 1  ▸        │
│  │ chat... │  │      ╲                          │   Day 2  ▸        │
│  └─────────┘  │       ●──●    Day 2 (amber)     │   Day 3  ▸        │
│  [ type... ]  │   ⌂ homestay options            │                   │
└───────────────┴─────────────────────────────────┴───────────────────┘
```

- **Left — AI Chat (≈320px):** interview questions, user replies, edit commands.
- **Center — Map (flex):** the hero. Routes per day, stop pins, homestay pins.
- **Right — Itinerary (≈360px):** day cards; click a card to focus its route.

Small screens: panels become tabs (Chat / Map / Plan).

---

## 2. Color & type

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0f1115` | App background (dark, map-friendly) |
| `--panel` | `#171a21` | Panel surfaces |
| `--text` | `#e7e9ee` | Primary text |
| `--muted` | `#9aa3b2` | Secondary text |
| `--accent` | `#2dd4bf` | Brand teal — primary actions |
| Day palette | teal / amber / violet / rose / lime | One hue per day, shared by route + cards |

- Font: Inter (UI), JetBrains Mono (costs/times badges).
- Rounded `xl` corners, soft shadows, generous padding.

---

## 3. Key components

### AI Chat panel
- Message bubbles: AI left (panel bg), user right (accent tint).
- **Quick-reply chips** under AI questions (e.g. `Relaxed` · `Packed`).
- Typing indicator while AI plans.
- Input with send + mic (future voice).

### Map
- Day routes as colored polylines; pins numbered per stop.
- **Stop popover:** photo, hours, est. time, est. cost, "why picked".
- **Homestay pins:** house icon; on hover, faint lines to that day's stops with travel-time labels.
- Top-right map controls: zoom, "fit trip", layer toggle (stops / homestays).

### Itinerary sidebar
- Collapsible **Day cards**, color-matched to the route.
- Each stop row: time · name · cost · drag handle · delete.
- Card footer: day totals (walk time, spend).
- "Add stop" and "Re-optimize day" buttons.

### Homestay card (in a zone)
```
⌂  Sakura Stay                        ★ 4.7 (320)
   9 min avg to Day 1–2 stops
   ₹2,800 / night   ·   ₹600 under budget
   [ Kitchen ] [ Wifi ] [ AC ]
   ───────────────────────────────────
   [ View on map ]            [ Choose ]
```

### Budget tracker (top-bar dropdown)
- Stacked bar: Lodging / Activities / Food / Transit.
- Running total vs. budget band; turns amber/rose when over.

---

## 4. Signature interactions
- **Hover a homestay → see its commute** drawn live on the map.
- **Drag a stop → routes + travel times recompute** instantly.
- **Type "cheaper near day 3" → that zone re-ranks** without touching the rest.
- **Every AI pick shows its reasoning** on tap (builds trust).

---

## 5. States to design
- Empty / first-prompt (big centered input + example prompts).
- Interviewing (chat active, map dimmed).
- Generated (full three-panel live).
- Editing / re-optimizing (skeleton shimmer on affected day).
- Error / no-results (lodging zone with no matches → suggest widening filters).
