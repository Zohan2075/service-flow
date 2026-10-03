---
type: planning
entity: todo
plan: "responsive-and-zoom-lock"
updated: "2026-09-30"
---

# Todo: responsive-and-zoom-lock

> Tracking [responsive-and-zoom-lock](plan.md)

## Active Phase: — (complete)

### Phase Context

- **Scope**: [Plan](plan.md) — completed
- **Implementation**: inline in phase doc
- **Latest Handover**: N/A
- **Relevant Docs**: N/A

### Pending

- [ ] (Manual) Device QA: iOS Safari + Android Chrome pinch, desktop Ctrl+wheel/Ctrl±, map pinch in Interested modal, 320×568 footer visibility

### In Progress

### Completed

- [x] AddEntryModal pinned submit footer <!-- completed: 2026-09-30 -->
- [x] InterestedPersonModal pinned save footer <!-- completed: 2026-09-30 -->
- [x] ZoomLock (viewport + CSS + JS) preserving Leaflet pinch-zoom <!-- completed: 2026-09-30 -->
- [x] Verification: `npm run type-check` + `npm run build` + route smoke (6 routes 200) <!-- completed: 2026-09-30 -->

### Blocked

## Changelog

### 2026-09-30

- Plan created from user report (save button not visible on some devices; disable zoom mobile + PC)
- Phase 1 completed; static checks + build + smoke green; manual device QA pending
