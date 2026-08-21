# Rediseño de Mundos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar la pantalla móvil `Mundos` como una trayectoria orbital clara y sobria, sin modificar su funcionalidad.

**Architecture:** Mantener `WorldsScreen` y `WorldCard` en el archivo actual porque la tarjeta tiene un solo consumidor. Reutilizar `LightColors`, `Typography`, `Spacing`, `BorderRadius`, `motion` y los componentes existentes; el único cambio compartido será el valor inicial del tema.

**Tech Stack:** Expo 54, React Native 0.81, Expo Router 6, TypeScript estricto, React Native Reanimated 4, Jest.

## Global Constraints

- No agregar dependencias, fuentes, ilustraciones ni componentes compartidos.
- No cambiar rutas, hooks, repositorios, stores de aprendizaje, traducciones ni cálculos de progreso.
- Conservar modo oscuro y preferencias ya persistidas; solo nuevas instalaciones comienzan en modo claro.
- Mantener una columna en móvil y limitar el ancho en web.
- Comunicar bloqueo y dominio mediante icono y texto, no solo mediante color.
- Mantener objetivos táctiles de al menos 44 puntos, foco web y etiquetas accesibles.
- No modificar `Bienvenida` en este ciclo.

---

## Mapa de archivos

- `src/shared/store/useThemeStore.ts`: define el tema inicial para instalaciones sin preferencia persistida.
- `src/features/learning/screens/WorldsScreen.tsx`: contiene composición, trayectoria, tarjeta y estados visuales de la pantalla.
- No se crean archivos de producción ni tests nuevos: ambos cambios son presentacionales o triviales y la lógica existente ya tiene pruebas de comportamiento.

### Task 1: Hacer claro el tema inicial

**Files:**

- Modify: `src/shared/store/useThemeStore.ts:14-22`

**Interfaces:**

- Consumes: persistencia existente `ceti-theme-storage` mediante `createJSONStorage`.
- Produces: `useThemeStore` con `mode: 'light'` solo cuando no existe estado persistido.

- [ ] **Step 1: Confirmar que la persistencia conserva su clave**

Run:

```bash
rg -n "mode:|'ceti-theme-storage'|name:" src/shared/store/useThemeStore.ts
```

Expected: aparecen `mode: 'dark'` y `name: 'ceti-theme-storage'`. La clave no debe cambiar porque eso borraría la preferencia existente.

- [ ] **Step 2: Cambiar solo el valor inicial**

Reemplazar el inicializador por:

```ts
(set) => ({
  mode: 'light',
  toggleTheme: () => set((state) => ({ mode: state.mode === 'light' ? 'dark' : 'light' })),
  setTheme: (mode) => set({ mode }),
}),
```

No cambiar `name`, `storage`, `toggleTheme` ni `setTheme`.

- [ ] **Step 3: Verificar tipos**

Run:

```bash
npm run typecheck
```

Expected: exit code `0`, sin errores TypeScript.

- [ ] **Step 4: Commit**

```bash
git add src/shared/store/useThemeStore.ts
git commit -m "feat(ui): usa tema claro por defecto"
```

### Task 2: Convertir la lista de mundos en trayectoria orbital

**Files:**

- Modify: `src/features/learning/screens/WorldsScreen.tsx:39-470`
- Test: `src/features/learning/data/worldStatus.test.ts`
- Test: `src/features/learning/data/worldProgress.test.ts`
- Test: `src/features/learning/hooks/useWorldFlow.test.ts`

**Interfaces:**

- Consumes: `WorldDef`, `worldStatus`, `ThemeColors`, `motion.enterDown`, `Spacing`, `BorderRadius` y todas las props actuales de `WorldCard`.
- Produces: `WorldCard` añade la prop visual `isLast: boolean`; el export default `WorldsScreen` no cambia.

- [ ] **Step 1: Ejecutar la cobertura funcional antes del cambio**

Run:

```bash
npx jest src/features/learning/data/worldStatus.test.ts src/features/learning/data/worldProgress.test.ts src/features/learning/hooks/useWorldFlow.test.ts --runInBand
```

Expected: las tres suites pasan. Si alguna falla antes del cambio, detenerse y registrar el fallo; no alterar lógica para esconderlo.

- [ ] **Step 2: Añadir el nodo y el conector sin cambiar la interacción**

Dentro del `Animated.View` de `WorldCard`, mantener el `TouchableOpacity` y sus props actuales, pero envolverlo así:

```tsx
<Animated.View entering={motion.enterDown(index * 45)} style={cardSt.row}>
  <View style={cardSt.rail} pointerEvents="none">
    <View
      style={[
        cardSt.railLine,
        {
          top: index === 0 ? Spacing.lg + 12 : 0,
          bottom: isLast ? undefined : 0,
          height: isLast ? Spacing.lg + 12 : undefined,
          backgroundColor: colors.materials.border,
        },
      ]}
    />
    <View
      style={[
        cardSt.node,
        {
          backgroundColor: isUnlocked ? colors.background.primary : colors.background.secondary,
          borderColor: isUnlocked ? world.color : colors.materials.border,
        },
      ]}
    >
      <Ionicons
        name={status === 'dominado' ? 'checkmark' : isUnlocked ? 'ellipse' : 'lock-closed'}
        size={status === 'dominado' ? 14 : isUnlocked ? 8 : 12}
        color={isUnlocked ? world.color : colors.text.quaternary}
      />
    </View>
  </View>

  <TouchableOpacity
    activeOpacity={isUnlocked ? 0.82 : 1}
    onPress={isUnlocked ? onPress : undefined}
    accessibilityRole="button"
    accessibilityLabel={t('worlds.openWorld', { n: world.number })}
    accessibilityState={{ disabled: !isUnlocked }}
    style={[
      cardSt.card,
      {
        backgroundColor: colors.background.primary,
        borderColor: colors.materials.border,
        opacity: isUnlocked ? 1 : 0.62,
      },
    ]}
  ></TouchableOpacity>
</Animated.View>
```

Antes de este reemplazo, añadir `isLast` al destructuring y al tipo local de props:

```ts
function WorldCard({
  world,
  competenciaLabel,
  progress,
  isUnlocked,
  prevWorldName,
  index,
  isLast,
  colors,
  onPress,
  t,
}: {
  world: WorldDef;
  competenciaLabel: string;
  progress: number;
  isUnlocked: boolean;
  prevWorldName?: string;
  index: number;
isLast: boolean;
  colors: ThemeColors;
  onPress: () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}) {
```

El snippet muestra los nuevos límites del `TouchableOpacity`. Mover literalmente
entre esas etiquetas el contenido existente desde `iconWrap` hasta `chevron`; no
cambiar sus condiciones ni textos en este paso. En el `map`, pasar:

```tsx
isLast={index === visibleWorlds.length - 1}
```

- [ ] **Step 3: Ajustar la jerarquía interna de la tarjeta**

Aplicar estas decisiones al contenido existente:

```tsx
<View
  style={[
    cardSt.iconWrap,
    { backgroundColor: isUnlocked ? `${world.color}14` : colors.background.secondary },
  ]}
>
  <Ionicons
    name={isUnlocked ? world.iconName : 'lock-closed'}
    size={24}
    color={isUnlocked ? world.color : colors.text.quaternary}
  />
</View>
```

Mantener `worldNum`, `worldName`, `worldDesc`, `competenciaTag`, `progressRow`, `masteredTag`, `lockedNote` y `chevron`. Eliminar solo el borde coloreado completo: el color del mundo queda reservado para icono, nodo, progreso y estado.

- [ ] **Step 4: Aplicar los estilos exactos de trayectoria y ancho responsive**

Reemplazar o agregar estas reglas en los `StyleSheet` existentes:

```ts
scroll: {
  width: '100%',
  maxWidth: 680,
  alignSelf: 'center',
  paddingHorizontal: Spacing.base,
  paddingBottom: 120,
},
pageTitle: {
  ...Typography.largeTitle,
  fontWeight: '700',
},
pageSubtitle: {
  ...Typography.subheadline,
  marginTop: Spacing.xs,
  marginBottom: Spacing.xl,
},
list: {
  gap: 0,
},
```

```ts
row: {
  minHeight: 132,
  flexDirection: 'row',
  alignItems: 'stretch',
},
rail: {
  width: 34,
  alignItems: 'center',
},
railLine: {
  position: 'absolute',
  width: StyleSheet.hairlineWidth,
},
node: {
  width: 24,
  height: 24,
  marginTop: Spacing.lg,
  borderRadius: BorderRadius.full,
  borderWidth: 2,
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1,
},
card: {
  flex: 1,
  minHeight: 112,
  marginBottom: Spacing.md,
  flexDirection: 'row',
  alignItems: 'center',
  borderRadius: BorderRadius.md,
  borderWidth: StyleSheet.hairlineWidth,
  padding: Spacing.base,
  gap: Spacing.md,
},
iconWrap: {
  width: 48,
  height: 48,
  borderRadius: BorderRadius.full,
  alignItems: 'center',
  justifyContent: 'center',
},
```

Conservar el resto de estilos de contenido y progreso salvo los pesos: `worldName` usa `fontWeight: '700'`, `worldNum` usa `fontWeight: '700'` y `letterSpacing: 0.8`.

- [ ] **Step 5: Mantener carga y vacío dentro del mismo ancho**

No cambiar las ramas. Conservar exactamente:

```tsx
{
  !classConfigLoaded ? (
    <View style={styles.emptyState}>
      <ActivityIndicator size="large" color={colors.text.tertiary} />
    </View>
  ) : visibleWorlds.length === 0 ? (
    <View style={styles.emptyState}>
      <Ionicons name="school-outline" size={40} color={colors.text.quaternary} />
      <Text style={[styles.emptyStateText, { color: colors.text.secondary }]}>
        {t('worlds.emptyClass')}
      </Text>
    </View>
  ) : (
    <View style={styles.list}>{/* map existente sin cambios */}</View>
  );
}
```

- [ ] **Step 6: Verificar tipos, lint y lógica**

Run:

```bash
npm run typecheck
npx eslint src/features/learning/screens/WorldsScreen.tsx src/shared/store/useThemeStore.ts
npx jest src/features/learning/data/worldStatus.test.ts src/features/learning/data/worldProgress.test.ts src/features/learning/hooks/useWorldFlow.test.ts --runInBand
```

Expected: los tres comandos terminan con exit code `0`; tres suites Jest pasan.

- [ ] **Step 7: Verificar manualmente la interfaz**

Run:

```bash
npm run web
```

Expected:

- En ancho de 390 px, la pantalla usa una columna sin scroll horizontal.
- La trayectoria conecta visualmente los mundos en su orden de clase.
- Disponible, dominado y bloqueado se distinguen mediante texto e icono.
- Solo una tarjeta desbloqueada navega a `/saga/<worldId>`.
- Los tres avisos aparecen en el mismo orden y siguen siendo interactivos.
- En web ancho, el contenido queda centrado y no supera 680 px.
- Tema claro y oscuro conservan contraste legible.
- Una instalación limpia inicia clara; una preferencia oscura persistida continúa oscura.

- [ ] **Step 8: Commit**

```bash
git add src/features/learning/screens/WorldsScreen.tsx
git commit -m "feat(ui): rediseña recorrido de mundos"
```

### Task 3: Cierre de verificación

**Files:**

- Modify: none
- Test: proyecto completo

**Interfaces:**

- Consumes: commits de Tasks 1 y 2.
- Produces: evidencia de que el rediseño no rompe los gates del repositorio.

- [ ] **Step 1: Ejecutar los gates completos**

Run:

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
```

Expected: todos terminan con exit code `0`. Si falla una prueba no relacionada, registrar nombre y salida; no borrarla ni marcarla como `skip`.

- [ ] **Step 2: Revisar el diff final**

Run:

```bash
git diff origin/feat/mi-dinero-retos...HEAD -- src/shared/store/useThemeStore.ts src/features/learning/screens/WorldsScreen.tsx
git status --short
```

Expected: solo aparecen el valor inicial del tema y cambios presentacionales de `Mundos`; no hay archivos de producción sin commit.
