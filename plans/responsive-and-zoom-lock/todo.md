---
type: planning
entity: todo
plan: "responsive-and-zoom-lock"
updated: "2026-09-30"
---

# Todo: responsive-and-zoom-lock

> Tracking [responsive-and-zoom-lock](plan.md)

## Active Phase: — (all phases complete)

### Phase Context

- **Scope**: [Plan](plan.md) — completed
- **Implementation**: inline in phase docs
- **Latest Handover**: N/A
- **Relevant Docs**: N/A

### Pending

- [ ] (Manual) Device QA: confirm Add Entry Save button visible on phone (with keyboard), pinch/zoom lock behavior, map pinch in Interested modal

### In Progress

### Completed

- [x] Phase 1: Modal pinned footers + zoom lock <!-- completed: 2026-09-30 -->
- [x] Phase 2: Visual viewport anchoring (save button regression fix) <!-- completed: 2026-09-30 --> — `ViewportSync` CSS vars, overlay sizing, safe-area calc fix, `interactiveWidget`
- [x] Verification: type-check + build + route smoke + live puppeteer (button visible at 640px and shrunk 380px viewport) <!-- completed: 2026-09-30 -->

### Blocked

## Changelog

### 2026-09-30

- Plan created from user report (save button not visible on some devices; disable zoom mobile + PC)
- Phase 1 completed; static checks + build + smoke green
- User reported save button still absent on device; live-app diagnosis (puppeteer-core) pinpointed layout-viewport anchoring
- Phase 2 completed: visual-viewport anchoring; live verification passed; manual device QA pending
