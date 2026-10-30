/**
 * ClassWorldsManager — "Mundos de la clase" (D-ORQ, RQ-PR10).
 *
 * The professor curates their class here: show/hide worlds and reorder them
 * (drag: long-press and move up/down). Every interaction saves immediately (no
 * "save" button — least friction) and reaches students in real time via their
 * onSnapshot on the same doc. "Restaurar configuración" deletes the doc, which
 * IS the defaults, so it is always safe.
 *
 * Cada fila muestra el mismo planeta que ve el estudiante en Tu Galaxia. Tocar el
 * mundo abre su editor; en los mundos propios (`cw_*`) el botón "más" abre una
 * hoja con duplicar y eliminar.
 *
 * Plan: configurar la lista es `configurarMundos`, abrir el editor
 * `editarContenido` y crear o duplicar mundos propios `mundosPropios`; sin el
 * plan se abre el muro y nada cambia. `soloLectura` (clase que pasó del límite
 * al bajar de plan) muestra la lista sin acciones.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, ActivityIndicator, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import ReorderableList from '@shared/components/ReorderableList';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import Bounceable from '@shared/components/Bounceable';
import { CetiAnimation } from '@features/animations';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { buildCuratedConfig } from '@features/learning/data/classConfig';
import RequisitosMundoHoja from '@features/educadores/requisitos/RequisitosMundoHoja';
import type { RequisitosMundo } from '@/functions/src/educadores/dominio';
import { WORLD_DEFS, displayWorldDef, isCustomWorldId } from '@features/learning/data/worldMeta';
import { planetaDeMundo } from '@features/learning/data/planetas';
import { Chip, Esqueleto, Pill } from '@features/dashboard/components/profe/kit';
import { useMuro } from '@features/educadores/components/MuroPlan';
import type { CursoConfigMundoEntry, CursoConfigMundos } from '@shared/types/tenancy';

const ROW_HEIGHT = 84;

export default function ClassWorldsManager({
  colegioId,
  cursoId,
  soloLectura = false,
}: {
  colegioId: string;
  cursoId: string;
  soloLectura?: boolean;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const [config, setConfig] = useState<CursoConfigMundos | null>(null);
  const [loaded, setLoaded] = useState(false);
  const muro = useMuro();
  // Si un arrastre no se guarda (sin plan o solo lectura), la lista se vuelve a montar
  // para que las filas regresen a su lugar.
  const [listaKey, setListaKey] = useState(0);
  const puedeConfigurar = () => !soloLectura && muro.exigir('configurarMundos');
  // Fase 9: requisitos para abrir un mundo (fecha, mundo anterior, nota mínima).
  const [requisitosDe, setRequisitosDe] = useState<CursoConfigMundoEntry | null>(null);

  useEffect(
    () =>
      classConfigRepository.subscribe(colegioId, cursoId, (c) => {
        setConfig(c);
        setLoaded(true);
      }),
    [colegioId, cursoId]
  );

  const entries: CursoConfigMundoEntry[] = useMemo(
    () =>
      config?.mundos?.length
        ? [
            ...config.mundos,
            // Un mundo de Ceti que llegó después de armar la clase (el 6 en la
            // Fase 7) aparece apagado al final, para que el profe lo encienda.
            ...WORLD_DEFS.filter((d) => !config.mundos.some((e) => e.worldId === d.id)).map((d) => ({
              worldId: d.id as string,
              activo: false,
            })),
          ]
        : WORLD_DEFS.map((d) => ({ worldId: d.id as string, activo: true })),
    [config]
  );
  const save = (mundos: CursoConfigMundoEntry[]) => {
    if (!firebaseUid) return;
    // buildCuratedConfig preserva `overrides` (fuente de verdad del contenido
    // copy-on-write): perderlos revertía las ediciones del profesor.
    void classConfigRepository.upsert(
      colegioId,
      cursoId,
      buildCuratedConfig(config, mundos, firebaseUid, Date.now())
    );
  };

  const guardarRequisitos = (worldId: string, requisitos: RequisitosMundo | null) => {
    setRequisitosDe(null);
    if (!puedeConfigurar()) return;
    save(
      entries.map((e) => {
        if (e.worldId !== worldId) return e;
        const { requisitos: _viejos, ...resto } = e;
        return requisitos ? { ...resto, requisitos } : resto;
      })
    );
    showMessage(t(requisitos ? 'requisitos.guardados' : 'requisitos.quitados'), undefined, 'success');
  };

  const onToggle = async (worldId: string) => {
    if (!puedeConfigurar()) return;
    const entry = entries.find((e) => e.worldId === worldId);
    // Activation gate for custom worlds (RQ-PR12 CA1): never expose an empty
    // world — it must cover the quiz minimums + 1 theory card first.
    if (entry && !entry.activo && isCustomWorldId(worldId)) {
      const { ready, faltan } = await courseContentRepository.checkCustomWorldReady(
        colegioId,
        cursoId,
        worldId
      );
      if (!ready) {
        showMessage(
          t('classWorlds.notReadyTitle'),
          t('classWorlds.notReadyBody', {
            faltan: faltan.map((p) => t(`contentEditor.tab_${p}`)).join(', '),
          })
        );
        return;
      }
    }
    const next = entries.map((e) => (e.worldId === worldId ? { ...e, activo: !e.activo } : e));
    save(next);
  };

  const onDeleteCustom = (worldId: string, name: string) =>
    confirmAction({
      title: t('classWorlds.deleteConfirmTitle', { name }),
      body: t('classWorlds.deleteConfirmBody'),
      confirmLabel: t('classWorlds.deleteConfirm'),
      cancelLabel: t('admin.cancel'),
      destructive: true,
      onConfirm: () =>
        void courseContentRepository.deleteCustomWorld({
          colegioId,
          cursoId,
          uid: firebaseUid ?? '',
          config,
          worldId,
        }),
    });

  // Hoja de acciones de un mundo propio (personalizar · duplicar · eliminar).
  const [menuFor, setMenuFor] = useState<{ worldId: string; name: string } | null>(null);

  // Duplicate-to-course: opens a sheet listing the professor's OTHER courses.
  const [duplicateFor, setDuplicateFor] = useState<{ worldId: string; name: string } | null>(null);
  const [targetCursos, setTargetCursos] = useState<{ id: string; nombre: string }[] | null>(null);
  const onDuplicate = async (worldId: string, name: string) => {
    if (!muro.exigir('mundosPropios')) return;
    setDuplicateFor({ worldId, name });
    if (targetCursos === null && firebaseUid) {
      const cursos = await rosterRepository.getCursosByProfesor(colegioId, firebaseUid);
      setTargetCursos(
        cursos.filter((c) => c.id !== cursoId).map((c) => ({ id: c.id, nombre: c.nombre }))
      );
    }
  };
  const onDuplicateTo = async (toCursoId: string) => {
    const worldId = duplicateFor?.worldId;
    setDuplicateFor(null);
    if (!worldId) return;
    const ok = await courseContentRepository.duplicateCustomWorld({
      colegioId,
      fromCursoId: cursoId,
      toCursoId,
      uid: firebaseUid ?? '',
      worldId,
    });
    showMessage(
      ok ? t('classWorlds.duplicated') : t('classWorlds.duplicateFailed'),
      undefined,
      ok ? 'success' : 'error'
    );
  };

  const onReorder = (orderedIds: string[]) => {
    if (!puedeConfigurar()) {
      setListaKey((k) => k + 1);
      return;
    }
    const byId = new Map(entries.map((e) => [e.worldId, e]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((e): e is CursoConfigMundoEntry => !!e);
    save(next);
  };

  const confirmReset = () =>
    puedeConfigurar() &&
    confirmAction({
      title: t('classWorlds.resetConfirmTitle'),
      body: t('classWorlds.resetConfirmBody'),
      confirmLabel: t('classWorlds.resetConfirm'),
      cancelLabel: t('admin.cancel'),
      onConfirm: () => void classConfigRepository.reset(colegioId, cursoId),
    });

  const abrirEditor = (worldId: string) => {
    if (soloLectura || !muro.exigir('editarContenido')) return;
    router.push(`/(staff)/contenido/${cursoId}/${worldId}` as never);
  };
  const crearMundo = () => {
    if (!muro.exigir('mundosPropios')) return;
    router.push(`/(staff)/crear-mundo/${cursoId}` as never);
  };

  if (!loaded) return <Esqueleto filas={4} alto={ROW_HEIGHT - 10} />;

  // Mismo planeta que ve el estudiante: los propios rotan por su lugar entre los visibles.
  const visibles = entries.filter((e) => e.activo).map((e) => e.worldId);
  const planetaDe = (worldId: string) => {
    const i = visibles.indexOf(worldId);
    return planetaDeMundo(worldId, i >= 0 ? i : entries.findIndex((e) => e.worldId === worldId));
  };

  const renderRow = (entry: CursoConfigMundoEntry) => {
    const def = displayWorldDef(entry.worldId, entry);
    if (!def) return null;
    const esCustom = isCustomWorldId(entry.worldId);
    const planeta = planetaDe(entry.worldId);
    return (
      <View style={styles.rowSlot}>
        <View
          style={[
            styles.row,
            {
              borderColor: colors.materials.border,
              backgroundColor: colors.materials.base,
            },
          ]}
        >
          <Ionicons name="reorder-three" size={22} color={colors.text.quaternary} />
          <Pressable
            onPress={() => abrirEditor(entry.worldId)}
            accessibilityRole="button"
            accessibilityLabel={t('classWorlds.customize', { name: def.name })}
            style={styles.mundo}
          >
            <View style={[styles.planeta, { opacity: entry.activo ? 1 : 0.35 }]}>
              <CetiAnimation id={planeta.animacion} size={50} autoPlay={false} />
            </View>
            <View style={styles.nameCol}>
              <Text
                style={[
                  styles.rowName,
                  { color: entry.activo ? colors.text.primary : colors.text.tertiary },
                ]}
                numberOfLines={1}
              >
                {def.name}
              </Text>
              {entry.activo && entry.requisitos ? (
                <Pill texto={t('requisitos.conRequisitos')} icono="lock-closed" tono="naranja" />
              ) : entry.activo ? (
                <Text style={[styles.rowSub, { color: colors.text.tertiary }]} numberOfLines={1}>
                  {esCustom ? t('profe.mundoPropio') : def.subtitle}
                </Text>
              ) : (
                <Pill texto={t('classWorlds.worldHidden')} icono="eye-off" />
              )}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.text.quaternary} />
          </Pressable>
          {entry.activo && !soloLectura ? (
            <Bounceable
              onPress={() => setRequisitosDe(entry)}
              activeScale={0.9}
              accessibilityRole="button"
              accessibilityLabel={t('requisitos.abrir', { nombre: def.name })}
              style={[styles.iconBtn, { backgroundColor: colors.materials.highlight }]}
            >
              <Ionicons
                name={entry.requisitos ? 'lock-closed' : 'lock-open-outline'}
                size={17}
                color={entry.requisitos ? colors.brand.primary : colors.text.secondary}
              />
            </Bounceable>
          ) : null}
          {esCustom && !soloLectura ? (
            <Bounceable
              onPress={() => setMenuFor({ worldId: entry.worldId, name: def.name })}
              activeScale={0.9}
              accessibilityRole="button"
              accessibilityLabel={t('profe.masAcciones', { name: def.name })}
              style={[styles.iconBtn, { backgroundColor: colors.materials.highlight }]}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.text.secondary} />
            </Bounceable>
          ) : null}
          <Switch
            value={entry.activo}
            onValueChange={() => void onToggle(entry.worldId)}
            disabled={soloLectura}
            trackColor={{ true: colors.brand.primary, false: colors.materials.border }}
            thumbColor="#FFFFFF"
            {...({ activeThumbColor: '#FFFFFF' } as object)}
            accessibilityLabel={t('classWorlds.toggleWorld', { name: def.name })}
          />
        </View>
      </View>
    );
  };

  const accion = (
    icono: keyof typeof Ionicons.glyphMap,
    texto: string,
    onPress: () => void,
    peligro = false
  ) => (
    <Bounceable
      onPress={onPress}
      activeScale={0.98}
      accessibilityRole="button"
      style={[
        styles.accion,
        { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
      ]}
    >
      <View
        style={[
          styles.accionIcono,
          { backgroundColor: peligro ? colors.fill.redSubtle : colors.materials.highlight },
        ]}
      >
        <Ionicons
          name={icono}
          size={18}
          color={peligro ? colors.system.red : colors.text.primary}
        />
      </View>
      <Text
        style={[styles.accionTexto, { color: peligro ? colors.system.red : colors.text.primary }]}
      >
        {texto}
      </Text>
    </Bounceable>
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: colors.text.secondary }]}>{t('classWorlds.hint')}</Text>
      {soloLectura ? null : (
        <View style={styles.dragRow}>
          <Ionicons name="hand-left-outline" size={14} color={colors.text.tertiary} />
          <Text style={[styles.dragHint, { color: colors.text.tertiary }]}>
            {t('classWorlds.dragHint')}
          </Text>
        </View>
      )}

      <ReorderableList
        key={listaKey}
        data={entries}
        keyExtractor={(e) => e.worldId}
        rowHeight={ROW_HEIGHT}
        onReorder={onReorder}
        renderItem={renderRow}
      />

      {soloLectura ? null : (
        <Bounceable
          onPress={crearMundo}
          activeScale={0.98}
          accessibilityRole="button"
          accessibilityLabel={t('classWorlds.createWorld')}
          style={[styles.crear, { borderColor: colors.brand.primary }]}
        >
          <View style={[styles.crearIcono, { backgroundColor: colors.fill.brandSubtle }]}>
            <Ionicons name="rocket" size={20} color={colors.brand.primary} />
          </View>
          <Text style={[styles.crearTexto, { color: colors.brand.primary }]}>
            {t('classWorlds.createWorld')}
          </Text>
        </Bounceable>
      )}

      {config && !soloLectura ? (
        <Pressable onPress={confirmReset} accessibilityRole="button" style={styles.resetBtn}>
          <Ionicons name="refresh" size={15} color={colors.text.tertiary} />
          <Text style={[styles.resetText, { color: colors.text.tertiary }]}>
            {t('classWorlds.reset')}
          </Text>
        </Pressable>
      ) : null}

      <CetiBottomSheet
        visible={!!menuFor}
        onClose={() => setMenuFor(null)}
        closeOnBackdropPress
        title={menuFor?.name ?? ''}
      >
        {menuFor ? (
          <View style={{ gap: 10 }}>
            {accion('pencil', t('contentEditor.customize'), () => {
              const id = menuFor.worldId;
              setMenuFor(null);
              abrirEditor(id);
            })}
            {accion('copy', t('profe.duplicarAOtro'), () => {
              const m = menuFor;
              setMenuFor(null);
              void onDuplicate(m.worldId, m.name);
            })}
            {accion(
              'trash',
              t('classWorlds.deleteConfirm'),
              () => {
                const m = menuFor;
                setMenuFor(null);
                onDeleteCustom(m.worldId, m.name);
              },
              true
            )}
          </View>
        ) : null}
      </CetiBottomSheet>

      <CetiBottomSheet
        visible={!!duplicateFor}
        onClose={() => setDuplicateFor(null)}
        closeOnBackdropPress
        title={t('classWorlds.duplicateSheetTitle', { name: duplicateFor?.name ?? '' })}
        subtitle={t('classWorlds.duplicateSheetSubtitle')}
      >
        {targetCursos === null ? (
          <ActivityIndicator color={colors.brand.primary} />
        ) : targetCursos.length === 0 ? (
          <Text style={[styles.rowSub, { color: colors.text.tertiary }]}>
            {t('classWorlds.noOtherCourses')}
          </Text>
        ) : (
          <View style={styles.targetsRow}>
            {targetCursos.map((c) => (
              <Chip
                key={c.id}
                texto={c.nombre}
                icono="people"
                seleccionado={false}
                onPress={() => void onDuplicateTo(c.id)}
              />
            ))}
          </View>
        )}
      </CetiBottomSheet>
      <RequisitosMundoHoja
        mundo={
          requisitosDe
            ? {
                worldId: requisitosDe.worldId,
                nombre: displayWorldDef(requisitosDe.worldId, requisitosDe)?.name ?? requisitosDe.worldId,
                requisitos: requisitosDe.requisitos,
              }
            : null
        }
        otros={entries
          .filter((e) => e.activo && e.worldId !== requisitosDe?.worldId)
          .map((e) => ({ worldId: e.worldId, nombre: displayWorldDef(e.worldId, e)?.name ?? e.worldId }))}
        onGuardar={(r) => requisitosDe && guardarRequisitos(requisitosDe.worldId, r)}
        onCerrar={() => setRequisitosDe(null)}
      />
      {muro.hoja}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  hint: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
  dragRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dragHint: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  rowSlot: { height: '100%', paddingBottom: 10 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
  },
  mundo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  planeta: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center' },
  nameCol: { flex: 1, gap: 3 },
  rowName: { fontSize: 16, fontWeight: '900' },
  rowSub: { fontSize: 13, fontWeight: '600' },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 20,
    padding: 14,
  },
  crearIcono: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crearTexto: { flex: 1, fontSize: 16, fontWeight: '900' },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: 6,
  },
  resetText: { fontSize: 14, fontWeight: '700' },
  accion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 16,
    padding: 12,
  },
  accionIcono: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accionTexto: { fontSize: 16, fontWeight: '800' },
  targetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
