---
description: Abre un bloque de trabajo a partir de un RQ-id — verifica que existe, lo descompone, descubre skills/rules de la fase y abre el ciclo plan→build→review.
argument-hint: <RQ-id> (p. ej. RQ-FN02)
allowed-tools: Read, Grep, Glob
---

Vas a iniciar el bloque de trabajo para **$ARGUMENTS**.

1. **Verifica el RQ.** Busca `$ARGUMENTS` en `docs/requerimientos.md`. Si no existe
   como `RQ-id` válido, DETENTE: no hay trabajo que abrir (R13) — escala como
   cambio de spec (agente `producto-scope`). Si existe, resume sus criterios de
   aceptación.
2. **Sitúa el bloque.** Cruza con `docs/harness-design.md` → "Tabla 1 — RQ → piezas"
   y "Orden de implementación recomendado": qué construye, qué rule lo guarda, qué
   enforcement lo verifica, y de qué bloque depende.
3. **Descubre skills/rules de la fase.** Lista las skills (S*) y rules (R*)
   relevantes para este RQ y los agentes (por código) que lo construyen/verifican.
4. **Plan → build → review.** Propón el plan (qué archivos, qué gates aplican: E1,
   E4, E7, E2/E3 si es contenido; vetos D4 si toca rules/PII). No construyas sobre
   identidad/roles/rules inestables (sigue el orden recomendado).

Recuerda: orden de autoridad `docs/empresa/decisiones.md` > resto > `requerimientos.md`

> rules/CLAUDE.md > código. Todo trabajo cita su `RQ-id` en el commit (E8).
