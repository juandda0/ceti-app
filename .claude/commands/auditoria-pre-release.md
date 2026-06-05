---
description: Auditoría pre-release — invoca compliance-privacidad (modo pre-release) + auditor-firestore-rules + invariant-lint (E4) + rules-matrix-tests (E7) + npm audit.
allowed-tools: Read, Grep, Glob, Bash
---

Corre la auditoría pre-release completa. Ningún build de producción procede sin
todo verde (DR está bloqueado por estos gates).

1. **CP — compliance-privacidad (modo pre-release).** Invoca al agente
   `compliance-privacidad` sobre el árbol completo: PII de menores fuera de la lista
   blanca, perfilamiento, PII de acudiente, datos nominales al rector, analytics
   limpio (Ley 1581 / R1,R4,R5,R6,R11). Veredicto `pass|block`.
2. **AR — auditor-firestore-rules.** Invoca al agente `auditor-firestore-rules`
   sobre `firestore.rules`/índices/`paths.ts`+claims: least-privilege por matriz
   §1.3, aislamiento de tenant, default deny, `studentId` retirado. Veredicto
   `pass|block`.
3. **E4 — invariant-lint.** `node scripts/invariantLint.mjs` (sin violaciones nuevas).
4. **E7 — rules-matrix-tests.** `npm run test:rules`.
5. **npm audit.** `npm audit --audit-level=high`.

Resume todos los veredictos. Cualquier `block` o rojo detiene el release.
