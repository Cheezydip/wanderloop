# Graph Report - .  (2026-07-04)

## Corpus Check
- Corpus is ~25,120 words - fits in a single context window. You may not need a graph.

## Summary
- 22 nodes · 30 edges · 4 communities
- Extraction: 63% EXTRACTED · 37% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.86)
- Token cost: 1,000 input · 500 output

## Community Hubs (Navigation)
- [[_COMMUNITY_AI Interview & Trip State Engine|AI Interview & Trip State Engine]]
- [[_COMMUNITY_OpenSpec Change Management|OpenSpec Change Management]]
- [[_COMMUNITY_UI Layout & Interactions|UI Layout & Interactions]]
- [[_COMMUNITY_Route-Aware Lodging & Tech Stack|Route-Aware Lodging & Tech Stack]]

## God Nodes (most connected - your core abstractions)
1. `Shared Trip State` - 7 edges
2. `Three-Panel Coordinated Layout` - 5 edges
3. `OpenSpec Specification-Driven Change Framework` - 5 edges
4. `Map Panel (Hero)` - 4 edges
5. `Route-Aware Lodging Pipeline` - 4 edges
6. `Itinerary Sidebar` - 3 edges
7. `Signature UX Interactions` - 3 edges
8. `OpenSpec Apply Workflow` - 3 edges
9. `OpenSpec Propose Workflow` - 3 edges
10. `OpenSpec Sync Specs Workflow` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Frontend Tech Stack` --references--> `Three-Panel Coordinated Layout`  [INFERRED]
  CLAUDE.md → ARCHITECTURE.md
- `AI Chat Panel` --implements--> `Three-Panel Coordinated Layout`  [EXTRACTED]
  UI_DESIGN.md → ARCHITECTURE.md
- `Directions & Routing API` --conceptually_related_to--> `Map Panel (Hero)`  [INFERRED]
  CLAUDE.md → UI_DESIGN.md
- `Signature UX Interactions` --references--> `Shared Trip State`  [INFERRED]
  UI_DESIGN.md → ARCHITECTURE.md
- `Budget Tracker` --references--> `Shared Trip State`  [INFERRED]
  UI_DESIGN.md → ARCHITECTURE.md

## Import Cycles
- None detected.

## Communities (4 total, 0 thin omitted)

### Community 0 - "AI Interview & Trip State Engine"
Cohesion: 0.33
Nodes (6): AI Interview Tool Loop, AI Chat Panel, Directions & Routing API, Core Domain Models, Shared Trip State, Budget Tracker

### Community 1 - "OpenSpec Change Management"
Cohesion: 0.60
Nodes (6): OpenSpec Apply Workflow, OpenSpec Archive Workflow, OpenSpec Specification-Driven Change Framework, OpenSpec Explore Workflow, OpenSpec Propose Workflow, OpenSpec Sync Specs Workflow

### Community 2 - "UI Layout & Interactions"
Cohesion: 0.60
Nodes (5): Itinerary Sidebar, Map Panel (Hero), Three-Panel Coordinated Layout, Signature UX Interactions, Per-Day Color Identity

### Community 3 - "Route-Aware Lodging & Tech Stack"
Cohesion: 0.40
Nodes (5): Lodging Blended Scoring, Route-Aware Lodging Pipeline, Stay Zones Clustering, Open Architectural Decisions, Frontend Tech Stack

## Knowledge Gaps
- **4 isolated node(s):** `Core Domain Models`, `Stay Zones Clustering`, `Lodging Blended Scoring`, `Budget Tracker`
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Shared Trip State` connect `AI Interview & Trip State Engine` to `UI Layout & Interactions`, `Route-Aware Lodging & Tech Stack`?**
  _High betweenness centrality (0.299) - this node is a cross-community bridge._
- **Why does `Route-Aware Lodging Pipeline` connect `Route-Aware Lodging & Tech Stack` to `AI Interview & Trip State Engine`?**
  _High betweenness centrality (0.157) - this node is a cross-community bridge._
- **Why does `Three-Panel Coordinated Layout` connect `UI Layout & Interactions` to `AI Interview & Trip State Engine`, `Route-Aware Lodging & Tech Stack`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Shared Trip State` (e.g. with `Signature UX Interactions` and `Budget Tracker`) actually correct?**
  _`Shared Trip State` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Core Domain Models`, `Stay Zones Clustering`, `Lodging Blended Scoring` to the rest of the system?**
  _4 weakly-connected nodes found - possible documentation gaps or missing edges._