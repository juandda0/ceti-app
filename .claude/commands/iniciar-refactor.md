---
description: Inicia una unidad de refactor del pivot — verifica el tag pre-pivot (E9), carga la skill refactor-pivot (S8) y presenta el plan de diff. La unidad studentId exige aprobación manual.
argument-hint: <unidad> (p. ej. "studentId", "atestacion", "bancos", "retiros")
allowed-tools: Read, Grep, Glob, Bash
---

Vas a iniciar la unidad de refactor: **$ARGUMENTS**.

1. **Punto de retorno (E9).** Corre `node scripts/prePivotTagGuard.mjs`. Si el tag
   `pre-pivot` no existe, DETENTE — no se demuele nada sin punto de retorno.
2. **Carga la skill `refactor-pivot` (S8).** Sitúa la unidad en el mapa
   conflicto→unidad de `docs/empresa/conflictos.md`, su orden y sus gates
   (E4+E7; AR+CP para #1/#4/#6).
3. **Presenta el plan de diff** completo: qué se borra, qué se inertiza, qué se
   conserva (`earlyWarning`/`weaknessReport`/`lifeProjects`/`leaderboard` NO se
   tocan). Identifica qué entradas de `scripts/legacy-baseline.json` elimina esta
   unidad (el baseline es solo-decrecimiento, debe llegar a cero).
4. **Aprobación manual.** Si la unidad toca `studentId` / claims / PII (#1, #4, #6),
   **no ejecutes**: presenta el diff y espera el "ok" humano explícito (D1/D2-matiz).

No levantes ni cambies un invariante por iniciativa (R15) — eso es decisión humana
coordinada (CLAUDE.md + rule).
