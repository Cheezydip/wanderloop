# Wanderloop — Architecture Diagram

Derived from `CLAUDE.md`, `TODO.md`, and `UI_DESIGN.md`. Reflects the **intended**
architecture (repo is pre-code). Open decisions are marked `?`.

## System overview

```mermaid
flowchart TB
    subgraph Client["🖥️ Frontend — Vite + React + TS + Tailwind"]
        direction TB
        subgraph Panels["Three coordinated panels (always in sync)"]
            direction LR
            Chat["💬 Chat panel<br/>interview + edits<br/>≈320px"]
            Map["🗺️ Map panel — HERO<br/>Mapbox GL JS ?<br/>routes · stop pins · homestay pins"]
            Itin["📋 Itinerary panel<br/>day-by-day cards<br/>≈360px"]
        end

        Store["⭐ Shared trip state<br/>(one source of truth, three views)<br/>Trip · Day · Stop · Homestay · Message"]

        Chat --> Store
        Itin --> Store
        Store --> Chat
        Store --> Map
        Store --> Itin
        Map -. "drag / delete stop" .-> Store
    end

    subgraph Backend["⚙️ Backend — Node/Express or Python/FastAPI ?"]
        direction TB
        AILoop["🤖 Claude tool-calling loop<br/>interview → structured itinerary JSON"]
        Cluster["📍 Route-aware lodging engine<br/>center-of-gravity → stay zones → blended score"]
    end

    subgraph External["☁️ External services"]
        direction TB
        Claude["Claude API<br/>(Anthropic)"]
        Directions["Directions API<br/>(travel times / routes)"]
        Lodging["Lodging API<br/>Booking.com or Hostelworld ?"]
        MapTiles["Map tiles<br/>Mapbox ?"]
    end

    Chat -- "user prompt / replies / NL edits" --> AILoop
    AILoop -- "itinerary JSON (stops: lat/lng, time, cost, rationale)" --> Store
    AILoop <--> Claude

    Store -- "stops per day" --> Cluster
    Cluster <--> Lodging
    Cluster -- "ranked homestays + rationale" --> Store

    Store -- "stops to route / recompute on edit" --> Directions
    Directions -- "polylines + travel times" --> Store

    Map <--> MapTiles
```

## AI interview → generation → edit loop

```mermaid
sequenceDiagram
    participant U as User
    participant C as Chat panel
    participant AI as Claude tool-loop (backend)
    participant S as Shared trip state
    participant M as Map + Itinerary

    U->>C: "5 days in Japan, love food..."
    C->>AI: prompt
    loop Interview (1–2 questions at a time)
        AI->>C: clarifying Q (dates, pace, budget, party, diet)
        C->>U: question + quick-reply chips
        U->>C: answer
        C->>AI: persisted preference
    end
    AI->>S: structured itinerary JSON (stops w/ lat/lng, time, cost, "why")
    S->>M: render color-coded day routes + cards
    Note over M: Directions API computes travel times

    U->>M: drag / delete a stop
    M->>S: mutate stop
    S->>M: recompute affected day's route + travel time
    U->>C: "cheaper near day 3"
    C->>AI: scoped edit
    AI->>S: re-rank only day-3 zone
```

## Route-aware lodging pipeline (Phase 5 — the hard part)

```mermaid
flowchart LR
    A["Day's stops"] --> B["Center of gravity<br/>per day"]
    B --> C["Cluster consecutive<br/>days → stay zones"]
    C --> D["Query lodging API<br/>per zone midpoint"]
    D --> E["Blended score<br/>route fit + price + reviews<br/>+ amenities + host quality"]
    E --> F["Ranked homestays<br/>(carry rationale)"]
    F --> G["House-icon pins;<br/>hover → commute lines"]
    F --> H["Stay-vs-relocate<br/>recommendation"]
    F --> I["Lock into<br/>budget tracker"]
```

## Per-day color identity

Each day owns **one hue** (`teal → amber → violet → rose → lime`), shared by its map
route polyline **and** its sidebar card — never reused within a trip. This linkage is
what makes the three panels read as coordinated.

## Open decisions (`?` above)

| Decision | Options |
|---|---|
| Map provider | **Mapbox GL** (recommended) vs Google Maps JS |
| Lodging source | Booking.com Affiliate vs Hostelworld (Airbnb has no public API) |
| Backend language | Node/Express vs Python/FastAPI |
