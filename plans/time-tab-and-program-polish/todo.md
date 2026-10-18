---
type: planning
entity: todo
plan: "time-tab-and-program-polish"
updated: "2026-10-17"
---

# Todo: time-tab-and-program-polish

> Tracking [time-tab-and-program-polish](plan.md)

## Active Phase: — (all phases complete)

### Phase Context

- **Scope**: [Plan](plan.md) — completed
- **Implementation**: inline in phase docs
- **Latest Handover**: N/A
- **Relevant Docs**: N/A

### Pending

- [ ] (Manual) User QA: tipografía en tu dispositivo, pestaña Tiempo, widget flotante (resize/arrastre, alerta con teclado cerrado), hora del país con tu ubicación real

### In Progress

### Completed

- [x] Phase 1: Program typography + timer circles <!-- completed: 2026-10-17 --> — circles 48→56px (móvil) / 56→64px (desktop); times +1 step + tabular-nums; headings +1 step; verified 375px + desktop without overflow
- [x] Phase 2: Time tab <!-- completed: 2026-10-17 --> — `timeTools` slice, 4 relojes, detección de país (BigDataCloud + timeapi.io + fallback + selector), pestaña `?tab=time`, i18n EN/ES; verificado en vivo
- [x] Phase 3: Global floating widget <!-- completed: 2026-10-17 --> — pill redimensionable (0.8–1.6 persistida), pausa/reanudar, tap→Tiempo, ocultar, alerta global de cuenta regresiva; bug `widgetVisible` encontrado y corregido; verificado en vivo (persistencia entre recargas)
- [x] Final verification: type-check + build + puppeteer (persistencia, alerta, resize, hide) <!-- completed: 2026-10-17 -->

### Blocked

## Changelog

### 2026-10-17

- Plan created (typografía Programa + pestaña Tiempo + widget flotante redimensionable)
- Fases 1–3 completadas y verificadas en vivo; QA manual del usuario pendiente
