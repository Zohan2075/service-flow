---
type: planning
entity: plan
plan: "interested-sharing-and-clarity"
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Plan: Interested — Clarity of Card Actions + Per-Person Share/Copy

## Objective

Two user requests on the Interested page:

1. Make the **"mark as completed"** toggle and the **Google Maps** link on person cards much more visible and easier to tap (currently faint icon-only controls).
2. Add a **copy button per person** that copies all saved data in a clean, chat-ready text format (user choice: per person, on card + modal).

## Requirements

### Functional

- [ ] Completed toggle: visible ring/border, bigger tap target (size-9), clear hover; unchanged behavior + check pop animation
- [ ] Maps link: clearly a button (tinted background + border, size-9); i18n title (replace hardcoded "Ver ubicación")
- [ ] Copy button on active + finished cards and in the edit modal header (edit mode only)
- [ ] Copy output = readable formatted text with all stored fields (name+last name, gender+age, status, address, Google Maps link, initial conversation, next visit incl. weekly, completed, comments), skipping empty fields
- [ ] Clipboard API with execCommand fallback; success/error toasts
- [ ] New i18n keys in EN + ES: `interested.viewLocation`, `interested.copyInfo`, `interested.copied`, `interested.copyFailed`
- [ ] Modal "completed" unchecked icon slightly more visible (`text-slate-400 dark:text-slate-500`)

### Non-Functional

- [ ] Behavior/state untouched; no new deps; no layout break at 360–390px width
- [ ] `npm run type-check` + `npm run build` green

## Scope

### In Scope

- `web/src/app/(dashboard)/interested/page.tsx` (card controls)
- `web/src/components/interested/InterestedPersonModal.tsx` (header copy + icon tweak)
- `web/src/lib/share.ts` (NEW — share-text builder)
- `web/src/lib/utils.ts` (`copyTextToClipboard`)
- `web/src/lib/i18n.tsx` (4 keys ×2 languages)

### Out of Scope

- Bulk/list-wide copy (user chose per-person)
- Modal redesign, Leaflet map changes

## Definition of Done

- [ ] Controls visibly larger/tinted with borders; copy button present on cards + modal
- [ ] Live check: copy writes formatted text to clipboard (puppeteer with clipboard permissions)
- [ ] type-check + build + route smoke green
- [ ] Plan/todo updated

## Testing Strategy

- type-check/build; live puppeteer: seed a person via modal → assert styles, click copy → read clipboard contents
- Visual check at 390px (screenshot)

## Phases

| Phase | Title | Scope | Status |
|-------|-------|-------|--------|
| 1 | Card clarity + per-person copy | Controls restyle, share builder, clipboard util, i18n | completed |

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---|---|---|
| Crowding with 3 icon buttons on 320px cards | Low | size-9 buttons, gap-1.5; verify at 360/390px |
| Clipboard API blocked on non-secure LAN HTTP | Low | execCommand textarea fallback + error toast |
| Nested interactive elements inside card `<button>` | Pre-existing | Keep patterns (stopPropagation, same element types) |

## Changelog

### 2026-09-30

- Plan created from user request (card action clarity + per-person copy in chat-friendly format).
- Phase 1 completed: completed-toggle (36px, bordered, aria-label) + maps link (tinted, localized title) restyled; per-person copy button on active/finished cards + edit-modal header; `buildInterestedPersonShareText` + `copyTextToClipboard`; 4 i18n keys (EN/ES). Live verification passed (clipboard content, modal flow, toggle→finished→reactivate). type-check + build green.
