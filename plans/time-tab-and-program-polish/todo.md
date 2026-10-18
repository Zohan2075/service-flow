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

- [ ] (Manual) User QA: tipografía en tu dispositivo, pestaña Tiempo, widget flotante (arrastrar con ⠿, redimensionar con el arco hasta 200%, doble-clic para resetear, alerta con teclado cerrado), hora del país con tu ubicación real

### In Progress

### Completed

- [x] Phase 1: Program typography + timer circles <!-- completed: 2026-10-17 --> — circles 48→56px (móvil) / 56→64px (desktop); times +1 step + tabular-nums; headings +1 step; verified 375px + desktop without overflow
- [x] Phase 2: Time tab <!-- completed: 2026-10-17 --> — `timeTools` slice, 4 relojes, detección de país (BigDataCloud + timeapi.io + fallback + selector), pestaña `?tab=time`, i18n EN/ES; verificado en vivo
- [x] Phase 3: Global floating widget <!-- completed: 2026-10-17 --> — pill redimensionable, pausa/reanudar, tap→Tiempo, ocultar, alerta global de cuenta regresiva; bug `widgetVisible` encontrado y corregido
- [x] Phase 4: Move + arco 200% + divisores de pestañas <!-- completed: 2026-10-17 --> — agarre arrastra en cualquier dirección (persistido, doble-clic resetea), arco redimensiona 0.8–2.0, líneas separadoras entre Programa/Comentarios/Tiempo; bug CSS del doble-menos encontrado y corregido; verificado en vivo
- [x] Final verification: type-check + build + puppeteer (persistencia, alerta, resize, hide) <!-- completed: 2026-10-17 -->

### Blocked

## Changelog

### 2026-10-17

- Plan created (typografía Programa + pestaña Tiempo + widget flotante redimensionable)
- Fases 1–3 completadas y verificadas en vivo; QA manual del usuario pendiente
