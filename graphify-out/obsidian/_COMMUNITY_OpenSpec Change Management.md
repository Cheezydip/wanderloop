---
type: community
cohesion: 0.60
members: 6
---

# OpenSpec Change Management

**Cohesion:** 0.60 - moderately connected
**Members:** 6 nodes

## Members
- [[OpenSpec Apply Workflow]] - document - .agent/workflows/opsx-apply.md
- [[OpenSpec Archive Workflow]] - document - .agent/workflows/opsx-archive.md
- [[OpenSpec Explore Workflow]] - document - .agent/workflows/opsx-explore.md
- [[OpenSpec Propose Workflow]] - document - .agent/workflows/opsx-propose.md
- [[OpenSpec Specification-Driven Change Framework]] - document - openspec/config.yaml
- [[OpenSpec Sync Specs Workflow]] - document - .agent/workflows/opsx-sync.md

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/OpenSpec_Change_Management
SORT file.name ASC
```
