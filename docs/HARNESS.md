# HARNESS.md — absorbido

> **Este documento fue absorbido y reemplazado.** Describía el arnés multi-agente
> del modelo **pre-pivot** (anterior a la Fase 2/3). Ya no es fuente de verdad.

El arnés vigente vive ahora en:

- **[docs/harness-design.md](harness-design.md)** — diseño validado pieza por pieza:
  15 invariantes (R1–R15) + 4 convention rules · 9 skills · 12 agentes (6 deptos) ·
  11 piezas de enforcement (E1–E11), con pipeline de contenido, mapa de
  departamentos y orden de implementación de RQ.
- **[.cursor/rules/](../.cursor/rules/)** — rules (CR1–CR4) que el motor carga.
- **[.claude/skills/](../.claude/skills/)** · **[.claude/agents/](../.claude/agents/)**
  · **[.claude/commands/](../.claude/commands/)** · **scripts/** — skills, agentes,
  slash commands y enforcement materializados (Fase 4).
- **[CLAUDE.md](../CLAUDE.md)** — ancla del arnés.

Orden de autoridad (D0): `docs/empresa/decisiones.md` > resto de `docs/empresa/` >
`docs/requerimientos.md` (v2) > rules/`CLAUDE.md` > código.
