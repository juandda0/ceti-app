---
name: add-screen
description: Use when the user asks to create a new screen, add a tab, add a route under `app/(app)` or `app/(auth)`, or scaffold a new page. Generates a screen following Ceti's conventions: `ScreenWrapper` + `useThemeColors` + `t()` + i18n keys + route registration. Triggers: "add a screen for X", "new page under savings", "create a tab", "add a route".
---

# Add a screen

Ceti has 10+ screens under `src/features/*/screens/` and `src/features/auth/onboarding/`. All of them share the same scaffolding (verified by grep: `ScreenWrapper` + `useThemeColors` appear in every screen file). This skill formalizes that scaffold so new screens don't drift.

## When to invoke

- A new app page is needed.
- A new tab under `app/(app)/` is requested.
- A new onboarding step is requested.

## Where to put files

- **Screen component** → `src/features/<domain>/screens/<Name>Screen.tsx` (or `src/features/auth/onboarding/<Name>Screen.tsx` for onboarding steps).
- **Route file** → under `app/`. Either:
  - A tab in the main app: `app/(app)/<name>.tsx` (re-export the screen).
  - An onboarding step: `app/(auth)/onboarding/<name>.tsx`.
  - A dynamic route: `app/<segment>/[id].tsx`.

Keep route files thin — they only re-export and (optionally) set screen options. All real code lives under `src/features/`.

## Screen scaffold

```tsx
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import { Spacing } from '@shared/constants/theme';

export default function MyFeatureScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[Typography.h1, { color: colors.text.primary }]}>{t('myFeature.title')}</Text>
        <Text style={[Typography.body, { color: colors.text.secondary }]}>
          {t('myFeature.subtitle')}
        </Text>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
});
```

Required elements:

1. **`ScreenWrapper`** as the outermost layout. It handles safe-area insets, background, status bar.
2. **`useThemeColors()`** from `@shared/hooks/useThemeColors` for all colors. Never hardcode hex values.
3. **`useTranslation()` + `t('...')`** for every user-visible string. No literal Spanish text in JSX.
4. **`Typography`** and **`Spacing`** from `@shared/constants/*` rather than ad-hoc numbers.
5. **Default export** — Expo Router requires the route file to default-export the screen component.

## Route registration

### For a tab under `app/(app)/`

1. Create `app/(app)/<name>.tsx`:
   ```tsx
   import MyFeatureScreen from '@features/<domain>/screens/MyFeatureScreen';
   export default MyFeatureScreen;
   ```
2. Open `app/(app)/_layout.tsx` and add the `Tabs.Screen` entry with icon and label.

### For an onboarding step under `app/(auth)/onboarding/`

1. Create `app/(auth)/onboarding/<name>.tsx` as a re-export.
2. Update the relevant navigation logic in `src/shared/session/*` or `app/(auth)/_layout.tsx` if the step gates further navigation.

### For a dynamic route

Use `app/<segment>/[id].tsx` and read params with `useLocalSearchParams()` from `expo-router`.

## Internationalization

Add the new keys to `src/shared/i18n/locales/es.json`:

```json
{
  "myFeature": {
    "title": "Título",
    "subtitle": "Descripción"
  }
}
```

The catalog is namespaced by feature; nest under the feature name to avoid collisions.

## Theming

- `useThemeColors()` returns the active palette. Common sub-objects: `colors.text.{primary,secondary,tertiary}`, `colors.materials.{base,border}`, `colors.gold.primary`.
- Light/dark switching is handled by `useThemeStore`; never branch on `useColorScheme` directly inside a screen.

## Animations

- Use `react-native-reanimated` (v4) via the `motion` presets in `@shared/constants/motion` (e.g., `motion.enterDown(delay)`).
- Avoid JS-thread animations.

## Tests

For pure logic in the screen (parsers, formatters), extract to `src/shared/utils/*` or `src/features/<domain>/utils/*` and test there with Jest + `useAuthStore.test.ts`-style patterns.

For UI smoke tests, use Maestro — see `e2e/maestro/`. Add a flow if the screen is part of a critical user journey.

## Role-gating

Una pantalla que muestra datos **cross-estudiante** (dashboards de profesor /
institucional / admin) debe gatearse por el claim del usuario antes de leer:

- Deriva el rol/tenant del claim (`role`, `colegioId`, `cursoId`) — nunca de un
  campo de Firestore escribible por el cliente (R2). La regla en `firestore.rules`
  es la barrera real (S4/R12); el gate en la pantalla solo evita renders inútiles.
- **Capa estudiante**: la experiencia (mundos/quiz) exige `estado:'activo'` y
  `cursoId` en el claim (RQ-FN04/FN10). Sin curso → la única pantalla disponible es
  "unirse con código" (D8).
- **Rector** ve solo agregados, nunca datos nominales del menor (R12). No
  construyas una pantalla que liste estudiantes por nombre para el rector.
- **Sede dormante**: ninguna pantalla de runtime requiere ni muestra `sede` (R11).

Checklist de role-gate:

- [ ] Toda string visible vía `t('...')`; cero literales en JSX.
- [ ] Gate de rol declarado explícitamente (qué claim habilita esta pantalla).
- [ ] No muestra PII de menor a roles que no la pueden ver (R4/R12).
- [ ] No referencia `sede` (R11).

## What this skill does NOT do

- It does not create stores. Use `add-zustand-mmkv-store` for that.
- It does not create Firestore writes. Use `add-firestore-repository` for that.
- It does not bypass `firestore.rules` — any new path the screen touches must already be allowed.
