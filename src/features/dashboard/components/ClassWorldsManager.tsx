/**
 * ClassWorldsManager — "Mundos de la clase" (D-ORQ, RQ-PR10).
 *
 * The professor curates their class here: show/hide worlds and reorder them
 * (drag: long-press and move up/down). Every interaction saves immediately (no
 * "save" button — least friction) and reaches students in real time via their
 * polling of the same config. "Restaurar configuración" deletes the doc, which
 * IS the defaults, so it is always safe.
 */
import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import ReorderableList from '@shared/components/ReorderableList';
import CetiBottomSheet from '@shared/components/CetiBottomSheet';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { courseContentRepository } from '@features/dashboard/data/courseContentRepository';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { buildCuratedConfig } from '@features/learning/data/classConfig';
import { WORLD_DEFS, displayWorldDef, isCustomWorldId } from '@features/learning/data/worldMeta';
import type { CursoConfigMundoEntry, CursoConfigMundos } from '@shared/types/tenancy';

const ROW_HEIGHT = 58;

export default function ClassWorldsManager({
  colegioId,
  cursoId,
}: {
  colegioId: string;
  cursoId: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const authUid = useAuthStore((s) => s.uid);
  const [config, setConfig] = useState<CursoConfigMundos | null>(null);
  const [loaded, setLoaded] = useState(false);

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
        ? config.mundos
        : WORLD_DEFS.map((d) => ({ worldId: d.id as string, activo: true })),
    [config]
  );
  const save = (mundos: CursoConfigMundoEntry[]) => {
    if (!authUid) return;
    // buildCuratedConfig preserva `overrides` (fuente de verdad del contenido
    // copy-on-write): perderlos revertía las ediciones del profesor.
    void classConfigRepository.upsert(
      colegioId,
      cursoId,
      buildCuratedConfig(config, mundos, authUid, Date.now())
    );
  };

  const onToggle = async (worldId: string) => {
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
          uid: authUid ?? '',
          config,
          worldId,
        }),
    });

  // Duplicate-to-course: opens a sheet listing the professor's OTHER courses.
  const [duplicateFor, setDuplicateFor] = useState<{ worldId: string; name: string } | null>(null);
  const [targetCursos, setTargetCursos] = useState<{ id: string; nombre: string }[] | null>(null);
  const onDuplicate = async (worldId: string, name: string) => {
    setDuplicateFor({ worldId, name });
    if (targetCursos === null && authUid) {
      const cursos = await rosterRepository.getCursosByProfesor(colegioId);
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
      uid: authUid ?? '',
      worldId,
    });
    showMessage(
      ok ? t('classWorlds.duplicated') : t('classWorlds.duplicateFailed'),
      undefined,
      ok ? 'success' : 'error'
    );
  };

  const onReorder = (orderedIds: string[]) => {
    const byId = new Map(entries.map((e) => [e.worldId, e]));
    const next = orderedIds
      .map((id) => byId.get(id))
      .filter((e): e is CursoConfigMundoEntry => !!e);
    save(next);
  };

  const confirmReset = () =>
    confirmAction({
      title: t('classWorlds.resetConfirmTitle'),
      body: t('classWorlds.resetConfirmBody'),
      confirmLabel: t('classWorlds.resetConfirm'),
      cancelLabel: t('admin.cancel'),
      onConfirm: () => void classConfigRepository.reset(colegioId, cursoId),
    });

  if (!loaded) return null;

  const renderRow = (entry: CursoConfigMundoEntry) => {
    const def = displayWorldDef(entry.worldId, entry);
    if (!def) return null;
    const esCustom = isCustomWorldId(entry.worldId);
    return (
      <View style={styles.rowSlot}>
        <View
          style={[
            styles.row,
            {
              borderColor: colors.materials.border,
              backgroundColor: colors.background.elevated,
            },
          ]}
        >
          <Ionicons name="reorder-three" size={20} color={colors.text.quaternary} />
          <View
            style={[
              styles.dot,
              { backgroundColor: entry.activo ? def.color : colors.text.quaternary },
            ]}
          />
          <View style={styles.nameRow}>
            <Text
              style={[
                styles.rowName,
                { color: entry.activo ? colors.text.primary : colors.text.quaternary },
              ]}
              numberOfLines={1}
            >
              {def.name}
            </Text>
            {!entry.activo && (
              <Text
                style={[styles.hiddenBadge, { color: colors.text.quaternary }]}
                numberOfLines={1}
              >
                {t('classWorlds.worldHidden')}
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/(staff)/contenido/${cursoId}/${entry.worldId}` as never)}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('classWorlds.customize', { name: def.name })}
          >
            <Ionicons name="pencil-outline" size={16} color={colors.text.secondary} />
          </TouchableOpacity>
          {esCustom && (
            <>
              <TouchableOpacity
                onPress={() => void onDuplicate(entry.worldId, def.name)}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('classWorlds.duplicate', { name: def.name })}
              >
                <Ionicons name="copy-outline" size={16} color={colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onDeleteCustom(entry.worldId, def.name)}
                style={styles.iconBtn}
                accessibilityRole="button"
                accessibilityLabel={t('classWorlds.delete', { name: def.name })}
              >
                <Ionicons name="trash-outline" size={16} color={colors.system.red} />
              </TouchableOpacity>
            </>
          )}
          <Switch
            value={entry.activo}
            onValueChange={() => void onToggle(entry.worldId)}
            accessibilityLabel={t('classWorlds.toggleWorld', { name: def.name })}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background.secondary }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('classWorlds.title')}</Text>
      <Text style={[styles.hint, { color: colors.text.tertiary }]}>{t('classWorlds.hint')}</Text>
      <Text style={[styles.dragHint, { color: colors.text.quaternary }]}>
        {t('classWorlds.dragHint')}
      </Text>

      <ReorderableList
        data={entries}
        keyExtractor={(e) => e.worldId}
        rowHeight={ROW_HEIGHT}
        onReorder={onReorder}
        renderItem={renderRow}
      />

      <TouchableOpacity
        onPress={() => router.push(`/(staff)/crear-mundo/${cursoId}` as never)}
        accessibilityRole="button"
        style={[styles.createBtn, { borderColor: colors.brand.primary }]}
      >
        <Ionicons name="add" size={16} color={colors.brand.primary} />
        <Text style={[styles.createBtnText, { color: colors.brand.primary }]}>
          {t('classWorlds.createWorld')}
        </Text>
      </TouchableOpacity>

      {config && (
        <TouchableOpacity onPress={confirmReset} accessibilityRole="button" style={styles.resetBtn}>
          <Ionicons name="refresh-outline" size={15} color={colors.text.tertiary} />
          <Text style={[styles.resetText, { color: colors.text.tertiary }]}>
            {t('classWorlds.reset')}
          </Text>
        </TouchableOpacity>
      )}

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
              <TouchableOpacity
                key={c.id}
                onPress={() => void onDuplicateTo(c.id)}
                accessibilityRole="button"
                style={[styles.targetChip, { borderColor: colors.brand.primary }]}
              >
                <Text style={[styles.targetChipText, { color: colors.brand.primary }]}>
                  {c.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </CetiBottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, padding: 16, gap: 10, marginTop: 4 },
  title: { fontSize: 16, fontWeight: '800' },
  hint: { fontSize: 12, lineHeight: 16 },
  dragHint: { fontSize: 11, lineHeight: 15, fontStyle: 'italic' },
  rowSlot: { height: '100%', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  nameRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 14, fontWeight: '600', flexShrink: 1 },
  hiddenBadge: { fontSize: 11, fontWeight: '600' },
  rowSub: { fontSize: 11, fontWeight: '600' },
  iconBtn: { padding: 4 },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  resetText: { fontSize: 12, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 10,
  },
  createBtnText: { fontSize: 13, fontWeight: '700' },
  targetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  targetChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  targetChipText: { fontSize: 13, fontWeight: '700' },
});
