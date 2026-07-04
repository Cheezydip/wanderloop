---
type: community
cohesion: 0.33
members: 6
---

# AI Interview & Trip State Engine

**Cohesion:** 0.33 - loosely connected
**Members:** 6 nodes

## Members
- [[AI Chat Panel]] - document - UI_DESIGN.md
- [[AI Interview Tool Loop]] - document - ARCHITECTURE.md
- [[Budget Tracker]] - document - UI_DESIGN.md
- [[Core Domain Models]] - document - CLAUDE.md
- [[Directions & Routing API]] - document - CLAUDE.md
- [[Shared Trip State]] - document - ARCHITECTURE.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/AI_Interview__Trip_State_Engine
SORT file.name ASC
```

## Connections to other communities
- 4 edges to [[_COMMUNITY_UI Layout & Interactions]]
- 1 edge to [[_COMMUNITY_Route-Aware Lodging & Tech Stack]]

## Top bridge nodes
- [[Shared Trip State]] - degree 7, connects to 2 communities
- [[AI Chat Panel]] - degree 2, connects to 1 community
- [[Directions & Routing API]] - degree 2, connects to 1 community