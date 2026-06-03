# CLAUDE.md

This file is the entry point that anchors all other guidance for Claude (and any
AI assistant) working in this repository. If a rule, skill, or memory conflicts
with this file, **this file wins**.

## What Ceti is

Ceti is a **B2B2C educational SaaS** sold to private schools in Colombia. The
paying customer is the school (rector/coordinador); what it buys is **curricular
compliance (CONPES 4005) + teacher reporting + saved teacher time**, delivered
through a gamified financial-education experience for students (13+). It is
**not** "a fun app" — every feature must serve that compliance/reporting goal.

- **Multi-tenant with role hierarchy**: `colegio → (sede, optional in MVP) →
curso → estudiante`. Roles: `rector`/`coordinador` (whole school or sede),
  `profesor` (own courses), `estudiante` (own experience). Permissions are
  enforced in `firestore.rules` from custom claims (`role`, `colegioId`) — by
  design from the start, never as a later patch.
- **This is NOT the family model.** The old parent/child financial-guardianship
  model was removed and stays forbidden — no `parent`/`child`/`family` entities,
  routes, or stores, and no acudiente acting as an in-app user with a dashboard.
  The institutional hierarchy (school staff ↔ students) is org-tenancy, not
  guardianship. The acudiente (legal guardian) appears **only** in the Ley 1581
  data-authorization (consent) flow — see `docs/COMPLIANCE.md`.
- **MVP is web responsive** (Expo Web / React Native Web over this same
  codebase — the web shims already exist in `src/shared/lib/*`). Native
  iOS/Android is out of scope for the MVP.
- **No real money, ever.** Savings goals are simulated with virtual currency.
  No gift cards, no real-bank-account linking. No public/global leaderboards
  (class-level collaboration the teacher can toggle is allowed).
- **No generative AI in MVP.** "Where is the course weak?" is computed with
  simple rules, not ML. Generative/adaptive question banks are V3+.
- **PII of minors is minimized** (Banzai model): students are keyed by a
  school-provided pseudonym/ID, not by personal name/email, wherever possible.
- Stack: Expo 54, React Native 0.81, TypeScript strict, Firebase 12 modular,
  Zustand 5, MMKV, Maestro E2E, Jest + RTL.
- Architecture: feature-first (`src/features/{auth,learning,savings,...}`) with
  shared infrastructure under `src/shared/*`.
- Backend: Firestore + `firestore.rules` + `docs/data-model.md` (tenancy
  schema). Cloud Functions (`functions/`) is scaffolded; the pivot's first use
  is setting role/colegio custom claims.

The phased roadmap (MVP → V2 → V3) lives in `docs/data-model.md` and the pivot
plan. Do not build V2/V3 features (LMS roster sync, native app, parents app,
generative AI, full sede dashboard, leaderboards) during the MVP.

## Source-of-truth documents

Read these before changing anything non-trivial. They are kept up to date in
this repo and are authoritative.

- **[AGENTS.md](AGENTS.md)** — the agent ecosystem: who does what, who blocks
  whom, what gates exist before merge or release.
- **[docs/data-model.md](docs/data-model.md)** — multi-tenant Firestore schema
  (`colegio → curso → estudiante`), role custom claims, PII-minimization model,
  and the MVP/V2/V3 roadmap. Authoritative for any data or rules change.
- **[docs/COMPLIANCE.md](docs/COMPLIANCE.md)** — **Ley 1581 / Decreto 1377**
  (data of minors, acudiente authorization) plus COPPA / GDPR-K guidance,
  `MIN_AGE = 13`, PII minimization, analytics minimization, PIN handling.
- **[README.md](README.md)** — how to install, run, build, and what the smoke
  test should validate.

## Active rules

Cursor / Claude rules live in [`.cursor/rules/`](.cursor/rules/). Each rule
states its source in its header. They are loaded automatically by tooling that
supports `.mdc` rules; humans should read them too.

| Rule                                                                       | Scope                                                                             |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| [`ceti-invariants.mdc`](.cursor/rules/ceti-invariants.mdc)                 | Project invariants — highest priority. Forbidden refs, MIN_AGE, removed features. |
| [`expo-rn-typescript.mdc`](.cursor/rules/expo-rn-typescript.mdc)           | Expo 54 + RN 0.81 + TS strict conventions, ESLint/Prettier, EAS, i18n.            |
| [`firebase-modular-client.mdc`](.cursor/rules/firebase-modular-client.mdc) | Firebase modular SDK usage, dual-SDK coexistence, repository pattern.             |
| [`zustand-stores.mdc`](.cursor/rules/zustand-stores.mdc)                   | Store design, selectors, MMKV persistence, testing.                               |

If a rule and `AGENTS.md` disagree on policy, follow `AGENTS.md` for _agent
behavior_ and the rule for _code conventions_.

## Active skills

Skills live in [`.claude/skills/`](.claude/skills/) and formalize patterns that
are already repeated in the codebase. Each skill is invoked by name.

| Skill                                                                          | Use when                                                                                                                           |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| [`add-firestore-repository`](.claude/skills/add-firestore-repository/SKILL.md) | A new entity needs to be persisted (under the tenancy tree in `docs/data-model.md`, or `users/{uid}/...` for account-scoped data). |
| [`add-zustand-mmkv-store`](.claude/skills/add-zustand-mmkv-store/SKILL.md)     | A new piece of shared client-state with MMKV persistence is needed.                                                                |
| [`add-screen`](.claude/skills/add-screen/SKILL.md)                             | A new app page, tab, or onboarding step is needed.                                                                                 |

## Quick conventions reference

- Path aliases: `@/*` (root), `@features/*` (`src/features/*`), `@shared/*` (`src/shared/*`). Never relative-cross-feature imports.
- Firestore paths: always via `src/shared/lib/firebase/paths.ts`, matching the tenancy schema in `docs/data-model.md`. Never inline string literals.
- Firestore writes: always via a `*Repository.ts` with `getFirebaseClients()` null guard + `stripUndefinedValues` + `{ merge: true }` + boolean return.
- Tenancy & roles: every cross-student read (teacher/rector views) is gated by `role`/`colegioId` custom claims in `firestore.rules`. Never read another student's data from the client without a rule that authorizes it by role.
- Student PII: never write a minor's name/email/age outside what the Ley 1581 flow strictly requires; prefer the school-provided pseudonym/`studentId`.
- Store persistence: always `createJSONStorage(() => createZustandMmkvStorage())` — never bare `AsyncStorage`.
- User-visible strings: always `t('...')` with keys in `src/shared/i18n/locales/es.json`.
- Analytics: route through `src/shared/lib/analytics/logEvent.ts`. **Never** put names, emails, ages, or any minor PII into analytics params.

## Tooling commands

| Command                        | Purpose                        |
| ------------------------------ | ------------------------------ |
| `npm start`                    | Metro + Expo dev server        |
| `npm run typecheck`            | `tsc --noEmit` — must pass     |
| `npm run lint`                 | ESLint flat config — must pass |
| `npm test`                     | Jest — must pass               |
| `npm run format`               | Prettier write                 |
| `npm audit --audit-level=high` | Bloqueante en CI               |

CI (`.github/workflows/ci.yml`) runs all four of the above plus `npm audit`.

## Update protocol

When you change project conventions, update this file and the affected rule in
the same change. Rules and skills should never contradict CLAUDE.md silently —
update CLAUDE.md first.
