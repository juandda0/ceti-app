---
name: compliance-ley1581
description: Use when reviewing a feature for PII / profiling compliance under Colombia's Ley 1581 / Decreto 1377 (data of minors) — analytics, Cloud Functions, auth, rules, or copy that touches student data. Provides the allowed-PII whitelist, the forbidden-per-minor list, the attestation model, and a feature-review procedure. Used by the compliance-privacidad agent; mirrors E4. Triggers: "privacy review", "PII check", "Ley 1581", "is this profiling", "compliance audit".
---

# Compliance Ley 1581 / Decreto 1377 (datos de menores)

Checklist + procedimiento de revisión de privacidad. Lo usa **CP**
(`compliance-privacidad`) y espejea `E4 invariant-lint`. La _norma_ vive en
R1/R4/R5/R6/R11; aquí está el _cómo revisar_.

## PII permitida en `estudiantes/{uid}` (lista blanca — nada más)

```
email, nombre, estado, atestado, atestadoPor, atestadoAt,
politicaVersion, joinedAt, uidVinculado
```

Cualquier campo fuera de esta lista en el doc del estudiante = **veto** (salvo R15).

## Prohibido por-menor (en cualquier capa)

- Datos personales extra: `edad`, `fechaNacimiento`, `documento`, `telefono`,
  `direccion`, **`grado`** (el grado vive en `curso.grado`, no en el menor) — R4.
- `studentId` como llave/campo/claim — R1.
- `aiProfile` o cualquier perfil/rasgo/etiqueta individual derivado del
  comportamiento — R5.
- Decisión **individual** de Elige-camino persistida (solo agregados por curso) — R5.
- PII de acudiente: `canalEvidencia`, `acudienteRef`, colección `autorizaciones` — R6.

## Atestación (R6)

- In-system **solo** un booleano `atestado` + quién (`atestadoPor`) + cuándo
  (`atestadoAt`) + `politicaVersion`.
- La autorización del acudiente se recolecta **fuera del sistema**; el acudiente
  **no** tiene cuenta ni pantalla.
- Gating: mientras `estado != 'activo'`, las reglas impiden escribir
  progreso/impactTest (`estudianteActivo`).

## Analytics

- `logEvent` nunca recibe `name/email/age/nombre/edad` ni nada que mapee a una
  persona/menor. Ruta única: `src/shared/lib/analytics/logEvent.ts`.

## Procedimiento de revisión de un feature

Para cada feature (analytics / functions / auth / rules / copy), pregunta en orden:

1. **¿Escribe datos?** ¿Dónde (qué path)?
2. **¿Agrega un campo por-menor fuera de la lista blanca?** → veto.
3. **¿Perfila?** ¿Construye/persiste algo individual derivado del comportamiento? → veto.
4. **¿Expone datos nominales del menor al rector** (que solo puede ver agregados)? → veto.
5. **¿Pasa PII a analytics o a texto libre** (logs, copy, mensajes)? → veto.
6. **¿Reaparece login/dashboard de acudiente o PII de acudiente?** → veto.

Cualquier "sí" en 2–6 → **block**. Output: hallazgos + `pass | block`.
