# Estado del proyecto — Ceti

> Bitácora de avance por fases. La fuente de verdad permanente vive en
> `docs/empresa/`.

## Fase 1 — completa ✅

Construido `docs/empresa/` como cerebro/fuente de verdad de la empresa,
integrando documentos de estudio + decisiones cerradas. Solo documentación
(no se tocó código).

Entregables creados:

- `docs/empresa/vision.md`
- `docs/empresa/modelo-negocio.md`
- `docs/empresa/producto.md`
- `docs/empresa/compliance.md`
- `docs/empresa/competencia.md`
- `docs/empresa/decisiones.md` (bitácora de máxima autoridad)
- `docs/empresa/conflictos.md` (auditoría repo vs. decisiones)

## Fase 2 — completa ✅

Reescrito `docs/requerimientos.md` como **especificación completa v2** (definición
de "terminado"): Fundación (modelo de datos, auth OAuth + unión por código, matriz
de permisos rol×acción validada), capa estudiante (5 mundos espaciales, micro-teoría,
quiz de 10 preguntas en 3 tipos —3º = ordenar/secuenciar—, XP/badges por mastery,
"Elige tu camino" agregado, feedback de alto refuerzo, simulador, colaborativo de
aula), capa profesor, capa institucional (rector lectura / coordinador operación),
capa admin Ceti, pre/post-test de impacto, y pipeline de contenido authoring-time.
Cada RQ con criterios de aceptación verificables y trazabilidad conflicto→RQ
(§8): los 11 conflictos de `conflictos.md` quedan resueltos en papel, ninguno
huérfano.

Decisiones tomadas en esta fase (no estaban en `decisiones.md`):

- rector = solo lectura agregada; coordinador = operación del colegio.
- admin Ceti crea toda la estructura (colegios, cursos, vínculos profesor↔curso).
- Atestación/activación del estudiante: profesor + coordinador + rector + admin.
- Pre/post-test a nivel programa (pre antes del Mundo 1, post tras los 5 mundos,
  mismo set de ítems, agregado, sin XP).
- 3º tipo de quiz = ordenar/secuenciar; mezcla 4 MC + 3 V/F + 3 ordenar.
- "Elige tu camino": 30% de probabilidad al entrar a un mundo.

Neutralizados (banner de fuente de verdad + mapa de obsolescencia + tags
`[OBSOLETO]`, sin reescritura profunda): `docs/data-model.md`,
`docs/COMPLIANCE.md`, `CLAUDE.md`, `.cursor/rules/ceti-invariants.mdc`.

Solo documentación (no se tocó código de la app).

## Fase 3 — completa ✅

Diseño del arnés completo validado pieza por pieza en
`docs/harness-design.md`: **15 invariantes (R1–R15) + 4 convention rules
(CR1–CR4) · 9 skills (S1–S9) · 12 agentes en 6 departamentos · 11
enforcement (E1–E11)**. Tres tablas de cobertura sin huérfanos (RQ,
falencias del equipo, conflictos de `conflictos.md`); el conflicto crítico
#1 (`studentId`) cubierto por el trío RF + AR + E4 + aprobación manual.
Incluye pipeline de contenido (diagrama mermaid), mapa de departamentos,
plan de demolición del arnés/código viejo y orden de implementación de los
RQ (fundación §1 primero). `harness-design.md` absorbe `HARNESS.md` y
`AGENTS.md`. Solo documentación (no se tocó código del arnés ni de la app).

## Fase 4 — completa ✅

Materializado el arnés diseñado en `docs/harness-design.md`, capa por capa, sin
tocar código de la app (solo infra del arnés). Paso 0: tag git `pre-pivot`
(punto de retorno, E9).

- **Capa 1 — Rules:** `CLAUDE.md` (ancla v2, R1–R15 + baseline) y
  `.cursor/rules/*.mdc` reescritos/ajustados (CR1 reescrito con R1–R15 verbatim;
  CR2/CR3/CR4 según veredicto). Neutralización de Fase 2 reemplazada.
- **Capa 2 — Skills:** 9 skills en `.claude/skills/` (S1 reescrito; S2/S3
  reusados+nota; S4–S9 nuevos: rules-matrix, content-schemas, authoring-pipeline,
  compliance-ley1581, refactor-pivot, cloud-function-claims).
- **Capa 3 — Agentes:** 12 agentes en `.claude/agents/d{1..6}-*/` con frontmatter
  (tools de mínimo privilegio + model tier) y system prompt que referencia
  rules/skills por nombre.
- **Capa 4 — Enforcement (E1–E11):** hook `PostToolUse` (`.claude/settings.json`),
  husky `pre-commit`+`commit-msg`, scripts `.mjs` cross-platform (invariant-lint
  con `legacy-baseline.json` de 80 entradas solo-decrecimiento, content gate
  E2/E3, eval E6, rq-citation E8, pre-pivot guard E9, free-port E7), 5 slash
  commands, CI extendido (E10). Smoke-test verde en Windows pieza por pieza.
- **Capa 5 — Demolición documental:** `HARNESS.md` y `AGENTS.md` reducidos a
  punteros (absorbidos por `harness-design.md`).

Desviaciones registradas (auto-auditoría): E2 sin librería `zod` (validadores
dependency-free equivalentes a S5); E7 solo hardening del runner (la reescritura
de escenarios a la matriz §1.3 va acoplada al refactor de `firestore.rules` en
Fase 6); E10 tocó `.github/ci.yml` (infra del arnés, fuera de la lista literal);
E1 typecheck por-edición opt-in; `lint` completo en CI, no en pre-commit.

## Siguiente: Fase 5 y Fase 6 (intercalables)

**Arnés operativo.** Fase 5 = pipeline de contenido (llenar el set dorado de E6,
generar bancos con GC → VC → E3, constantes `economia-CO.<año>.json`). Fase 6 =
implementación por RQ siguiendo el orden recomendado de `harness-design.md`
(fundación §1 primero: migración atómica `studentId` con aprobación manual,
roles, atestación; luego contenido, retiros, capa estudiante, impacto, staff).
El `legacy-baseline.json` debe decrecer hasta cero a lo largo de Fase 6.
