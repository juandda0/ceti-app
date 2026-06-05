# AGENTS.md — absorbido

> **Este documento fue absorbido y reemplazado.** Describía el ecosistema de
> agentes del modelo **pre-pivot** (anterior a la Fase 2/3). Ya no es fuente de
> verdad.

El ecosistema de agentes vigente (12 agentes en 6 departamentos D1–D6, quién
bloquea a quién, gates de merge) vive ahora en:

- **[docs/harness-design.md](docs/harness-design.md)** — diseño del arnés completo
  (departamentos, agentes, rules, skills, enforcement, pipeline de contenido).
- **[.claude/agents/](.claude/agents/)** — los agentes materializados (Fase 4),
  uno por archivo bajo `d{N}-{departamento}/`.
- **[CLAUDE.md](CLAUDE.md)** — ancla del arnés e índice de rules/skills/agentes.

Orden de autoridad (D0): `docs/empresa/decisiones.md` > resto de `docs/empresa/` >
`docs/requerimientos.md` (v2) > rules/`CLAUDE.md` > código.
