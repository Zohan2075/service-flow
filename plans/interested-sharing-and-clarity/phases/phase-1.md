---
type: planning
entity: phase
plan: "interested-sharing-and-clarity"
phase: 1
status: completed
created: "2026-09-30"
updated: "2026-09-30"
---

# Phase 1: Card Clarity + Per-Person Copy

> Part of [interested-sharing-and-clarity](../plan.md)

## Objective

Restyle the completed toggle and Google Maps link on person cards for visibility/tappability; add a per-person "copy info" button (cards + edit modal) that copies all saved data as readable chat text.

## Scope

### Includes

**A. Card controls** — `web/src/app/(dashboard)/interested/page.tsx`

Active card (~lines 332–392):
- Completed toggle (span role=button): `size-7` → `size-9`; classes:
  - base: `inline-flex items-center justify-center size-9 rounded-full border-2 transition-colors cursor-pointer`
  - completed: `border-green-500 bg-green-500 text-white`
  - not completed: `border-slate-300 dark:border-slate-600 text-slate-400 dark:text-slate-500 hover:border-green-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20`
  - keep `title`, pop animation, keyboard handler; add `aria-label` = same title text.
- Maps link: `size-8 rounded-lg text-blue-500 …` → `size-9 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-600 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-300 hover:bg-blue-500/20 transition-colors`; title → `{t("interested.viewLocation")}`.
- NEW copy button (after maps, same row) calling the shared copy handler:
  `size-9 rounded-lg border border-slate-300/60 dark:border-slate-600/60 bg-slate-500/5 text-slate-500 hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-colors`, icon `content_copy`, title/aria `{t("interested.copyInfo")}`, `stopPropagation`.

Finished card (~lines 268–283): add same copy button (before delete), same classes/handler.

Shared in page.tsx: a `handleCopyPerson(person, statusInfo)` that builds text via the share builder (status name from `statusInfo.name`, `t`, `settings.language`), calls `copyTextToClipboard`, then `toast.success(t("interested.copied"))` / `toast.error(t("interested.copyFailed"))`.

**B. Modal** — `web/src/components/interested/InterestedPersonModal.tsx`

- Header: wrap the close button in a `flex items-center gap-1` group and add a copy icon button (only when `isEditing && person`) with the same copy handler (person's status name from the statuses list). Icon `content_copy`; classes like the close button but clearly tappable: `text-slate-400 hover:text-primary p-2 rounded-lg hover:bg-primary/10`.
- Completed checkbox icon when unchecked: `text-slate-300 dark:text-slate-600` → `text-slate-400 dark:text-slate-500` (line ~608).

**C. Share builder** — NEW `web/src/lib/share.ts`

`buildInterestedPersonShareText({ person, statusName, language, t })` returning chat-ready text. Include only non-empty fields, in this order:

```
👤 {name} {last_name}
{♂|♀|⚬} {t("interested.male|female|unspecified")}[ · {t("interested.age")}: {age}]
📌 {statusName}
📍 {t("interested.address")}: {address}
🗺️ {t("interested.location")}: https://www.google.com/maps?q={lat},{lng}
💬 {t("interested.initialConversation")}: {dateTimeString(initial_conversation_date)}
📅 {t("interested.nextVisit")}: {weekly ? weekdayName [time] : dateTimeString(next_visit_date)}
✅ {t("interested.completed")}          (only when completed)
📝 {t("interested.comments")}: {comments}
```

- Types: reuse `TranslationKey` + `dateTimeString` (+ `Language` if exported) from `@/lib/i18n`; `InterestedPerson` from `@/types/data`.
- Weekly day name via `Intl.DateTimeFormat(language, { weekday: "long" })` on a reference Sunday + index (0=Sun), capitalized; optional time from `next_visit_date` (`toLocaleTimeString`, 2-digit hour/minute) — mirror the card's weekly rendering.

**D. Clipboard util** — `web/src/lib/utils.ts`

`export async function copyTextToClipboard(text: string): Promise<boolean>` — try `navigator.clipboard.writeText` (secure contexts); on failure fall back to a hidden `<textarea>` + `document.execCommand("copy")`; return success boolean; never throw.

**E. i18n** — `web/src/lib/i18n.tsx` (EN block ~line 366 / ES block ~line 733)

Add (only if missing): `interested.viewLocation`, `interested.copyInfo`, `interested.copied`, `interested.copyFailed` — EN: "View location" / "Copy info" / "Copied to clipboard" / "Couldn't copy"; ES: "Ver ubicación" / "Copiar información" / "Copiado al portapapeles" / "No se pudo copiar".

## Excludes

- List-wide copy; modal redesign; map/Leaflet changes; behavior/state changes.

## Deliverables

- [ ] Restyled completed toggle + maps link (active card)
- [ ] Copy button on active + finished cards and modal header
- [ ] `share.ts` + `copyTextToClipboard` + 4×2 i18n keys

## Acceptance Criteria

- [x] Toggle and maps links visibly bordered/tinted with 36px targets; titles localized
- [x] Copy from card or modal writes formatted text (verified via clipboard read in live test)
- [x] No handler/state regressions; cards still open the modal on tap
- [x] type-check passes

## Completion Evidence (2026-09-30, live puppeteer 390×640, production build)

```
CARD: toggle 36px/2px border/slate-500, maps tinted+bordered, copy present
CARD COPY: "👤 Carlos Pérez" + gender/status/Google-Maps lines (empty fields omitted)
OPENED FROM CARD -> { modalOpen: true, headerCopy: true }
MODAL COPY MATCHES CARD COPY: true
TOGGLE -> card leaves active list (to Finished), no accidental modal open
FINISHED TAB: card present with undo + copy
REACTIVATED BACK IN ACTIVE: true
```

Screenshots: active card + finished card (dark mode) visually confirm the new controls.
Note: with 3 icon controls, long names truncate slightly earlier at ≤390px (acceptable; adjustable on request).

## Notes

- Keep nested-interactive pattern (stopPropagation); do not change card element types.
