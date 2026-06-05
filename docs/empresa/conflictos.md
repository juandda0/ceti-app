# Conflictos — Ceti (auditoría repo vs. decisiones cerradas)

> Inventario de TODO lo que el código/docs existentes contradicen contra las
> decisiones cerradas (ver `decisiones.md`). **No se resuelve nada aquí** — solo
> se levanta. Fases: **F2** = reescritura de requerimientos v2 (especificar el
> cambio); **F3+** = implementación en código. Fecha base: 2026-06-04.

## Tabla maestra

| #   | Conflicto                  | Qué existe hoy (repo)                                                                                                                                                                                                               | Qué lo reemplaza (decisión)                                                                            | Sev.    | Fase   |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------- | ------ |
| 1   | **Llave del estudiante**   | Seudónimo `studentId` como llave primaria, embebido en `firestore.rules`, `paths.ts` (`estudianteDocRef`, `estudianteProgressDocRef`), `tenancy.ts` (claim `studentId`), `functions/src/index.ts` (`setMemberClaims`, `joinByCode`) | **Email = identidad**; se guarda email+nombre; se **retira** el seudónimo como llave (D9)              | CRÍTICA | F2→F3+ |
| 2   | **Perfil del menor**       | `aiProfile` por-usuario (`users/{uid}/aiProfile/state` en `paths.ts`/rules); `aiService.updateProfileWithAnswer()`; `requerimientos.md` R7 exige "perfil financiero del usuario"                                                    | **PROHIBIDO** perfil individual; "Elige tu camino" **agregado por curso** (D4)                         | ALTA    | F2→F3+ |
| 3   | **Sedes**                  | `sedes` en rules, `paths.ts` (`sedeDocRef`), `tenancy.ts` (`Sede`, claim `sedeId`); **dashboard de sede** en `SchoolReportScreen.tsx` + `loadSchoolReport.ts` (scoping coordinador)                                                 | Sedes **dormantes**; jerarquía efectiva `colegio→curso→estudiante` (D2/D10)                            | ALTA    | F2→F3+ |
| 4   | **Rol admin Ceti**         | Solo 4 roles (`ROLES` en `tenancy.ts` y `functions`); "superadmin" es un **flag de claim** por allowlist de email (`isSuperAdmin`), no un rol                                                                                       | **5º rol "admin Ceti"** que registra/asigna roles a todos los adultos (D7)                             | ALTA    | F2→F3+ |
| 5   | **Certificados PDF**       | `learning/data/certificate.ts` (`buildCertificateHtml`) + test; roadmap MVP en `data-model.md`                                                                                                                                      | **EXCLUIDO** (D2) → retirar                                                                            | MEDIA   | F3+    |
| 6   | **Autorización acudiente** | Flujo in-system completo: colección `autorizaciones`, Function `setAuthorizationStatus`, gating `estudianteActivo`, tipo `Autorizacion` con `canalEvidencia`/`acudienteRef`                                                         | Recolección **por fuera**; in-system solo **atestación ligera** (checkbox), sin PII del acudiente (D9) | ALTA    | F2→F3+ |
| 7   | **IA en runtime**          | `services/ai/aiService.ts` (stubs `adaptQuestion`, `getRecommendedPath`, `analyzeWeaknesses`); `adaptiveQuiz.ts` (selección de pregunta en runtime); `aiHints` en `questionBank.types.ts`                                           | IA **solo authoring-time**; runtime **estático** (D5) → retirar stubs y adaptación runtime             | ALTA    | F2→F3+ |
| 8   | **Bancos de contenido**    | `questionBank` **global**, human-curated, read-only; sin `grado`, sin `pendiente_validacion_docente`, sin separación por tipo                                                                                                       | Bancos por **grado×mundo×tipo** + flag `pendiente_validacion_docente`; "Elige tu camino" separado (D5) | CRÍTICA | F2→F3+ |
| 9   | **Tipos de pregunta**      | 4 tipos (`multiple_choice`, `true_false`, `fill_blank`, `calculation`); sin tope explícito de 10; sin banco "Elige tu camino"                                                                                                       | **3 tipos** (MC, V/F, 3º dinámico TBD); **10 preguntas**; banco "Elige tu camino" separado (D2/D3)     | MEDIA   | F2→F3+ |
| 10  | **Narrativa de mundos**    | 5 mundos existen, pero etiquetados como competencias financieras (`competencias.ts`), sin narrativa espacial                                                                                                                        | 5 mundos con **narrativa espacial** (D2) — verificar si es solo capa de naming/i18n                    | MEDIA   | F2→F3+ |
| 11  | **Pre/Post-test**          | **No existe** ningún mecanismo de pre/post-test                                                                                                                                                                                     | Añadir **pre-test y post-test** de impacto (D2)                                                        | BAJA    | F2→F3+ |

## Conflictos de documentación (docs desactualizados)

| Doc                                 | Qué dice (obsoleto)                                                                                 | Acción                                                                     |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `docs/requerimientos.md`            | R7 "perfil financiero del usuario"; modelo previo de mecánicas                                      | **Reescribir** como requerimientos v2 (es el objeto de la F2)              |
| `docs/data-model.md`                | Seudónimo `studentId` como llave; 4 roles; `autorizaciones` in-system; sede; certificado PDF en MVP | Actualizar tras decidir el nuevo modelo (F2)                               |
| `docs/COMPLIANCE.md`                | Modelo seudónimo; flujo in-system de autorización                                                   | Enmendado por `docs/empresa/compliance.md`; sincronizar en F2              |
| `CLAUDE.md`                         | "No generative AI in MVP" (ok en runtime); roles (faltan 5º); features gated                        | Actualizar invariantes (rol admin, IA authoring-time, sede dormante) en F2 |
| `.cursor/rules/ceti-invariants.mdc` | 4 roles; modelo seudónimo PII; features prohibidas                                                  | Actualizar junto a CLAUDE.md (F2)                                          |

## Notas de matiz (no son conflicto duro)

- **Diagnóstico por reglas SÍ se conserva:** `earlyWarning.ts` y el "dónde está
  flojo el curso" por reglas están **alineados** con D2 (capa profesor). Lo que
  se retira es la **adaptación de contenido en runtime** (`adaptiveQuiz.ts`) y los
  **stubs de IA runtime**, no el diagnóstico agregado.
- **"App de padres" NO existe** → ya alineado (D2). Solo hay que mantener la
  prohibición.
- **El grado ya NO se captura al estudiante** (es atributo de `Curso`) → ya
  alineado con la aclaración de D9.
- **Conflicto 1 y 6 tocan `firestore.rules` + claims + Functions a la vez:**
  deben planearse juntos en F2 para no romper tenancy/seguridad.

## Orden sugerido de resolución (propuesta, no decisión)

1. F2: reescribir `requerimientos.md` v2 con el modelo nuevo (resuelve en papel
   #1–#11 y sincroniza data-model/COMPLIANCE/CLAUDE/reglas).
2. F3+: implementar por bloques — (a) identidad/PII + roles (#1, #4), (b)
   autorización ligera (#6), (c) bancos por grado + tipos + 10 preguntas (#8, #9),
   (d) retiro de IA runtime + perfil + certificados + sede dormante (#2, #5, #7,
   #3), (e) pre/post-test + narrativa espacial (#10, #11).
