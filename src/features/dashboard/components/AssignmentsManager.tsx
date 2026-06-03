import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import type { WorldId } from '@features/learning/data/questionBank.types';
import {
  asignacionRepository,
  type AsignacionWithId,
} from '@features/dashboard/data/asignacionRepository';
import { assignmentStatus, daysUntil } from '@features/dashboard/data/assignmentStatus';

const DAY = 24 * 60 * 60 * 1000;
const WORLD_IDS: WorldId[] = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];
const DEADLINE_PRESETS = [
  { key: '1w', days: 7 },
  { key: '2w', days: 14 },
  { key: '1m', days: 30 },
] as const;

function worldNumber(worldId: WorldId): number {
  return Number(worldId.replace('world_', ''));
}

/** Teacher panel to create simple "complete World X before date Y" assignments and list them. */
export default function AssignmentsManager({
  colegioId,
  cursoId,
  createdByUid,
}: {
  colegioId: string;
  cursoId: string;
  createdByUid: string;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  const [items, setItems] = useState<AsignacionWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [world, setWorld] = useState<WorldId>('world_1');
  const [days, setDays] = useState<number>(7);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await asignacionRepository.listByCurso(colegioId, cursoId);
    setItems(list);
    setLoading(false);
  }, [colegioId, cursoId]);

  useEffect(() => {
    let cancelled = false;
    void asignacionRepository.listByCurso(colegioId, cursoId).then((list) => {
      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [colegioId, cursoId]);

  const onCreate = useCallback(async () => {
    setCreating(true);
    try {
      const now = Date.now();
      await asignacionRepository.create(colegioId, {
        worldId: world,
        target: { tipo: 'curso', cursoId },
        fechaInicio: now,
        deadline: now + days * DAY,
        createdByUid,
        createdAt: now,
      });
      await reload();
    } catch (e) {
      Alert.alert(t('admin.error'), e instanceof Error ? e.message : t('assignments.error'));
    } finally {
      setCreating(false);
    }
  }, [colegioId, cursoId, world, days, createdByUid, reload, t]);

  const now = Date.now();
  const sorted = useMemo(() => [...items].sort((a, b) => a.deadline - b.deadline), [items]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('assignments.title')}</Text>

      {/* World picker */}
      <View style={styles.chipRow}>
        {WORLD_IDS.map((w) => {
          const selected = w === world;
          return (
            <TouchableOpacity
              key={w}
              onPress={() => setWorld(w)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.brand.primary : colors.background.secondary,
                  borderColor: selected ? colors.brand.primary : colors.background.secondary,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text.secondary }]}>
                {t('assignments.world', { n: worldNumber(w) })}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Deadline preset */}
      <View style={styles.chipRow}>
        {DEADLINE_PRESETS.map((p) => {
          const selected = p.days === days;
          return (
            <TouchableOpacity
              key={p.key}
              onPress={() => setDays(p.days)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.brand.primary : colors.background.secondary,
                  borderColor: selected ? colors.brand.primary : colors.background.secondary,
                },
              ]}
            >
              <Text style={[styles.chipText, { color: selected ? '#fff' : colors.text.secondary }]}>
                {t(`assignments.deadline_${p.key}`)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.createBtn,
          { backgroundColor: colors.brand.primary, opacity: creating ? 0.6 : 1 },
        ]}
        onPress={() => void onCreate()}
        disabled={creating}
        accessibilityRole="button"
      >
        <Ionicons name="add-circle-outline" size={18} color="#fff" />
        <Text style={styles.createText}>{t('assignments.create')}</Text>
      </TouchableOpacity>

      {/* List */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 8 }} color={colors.brand.primary} />
      ) : sorted.length === 0 ? (
        <Text style={[styles.none, { color: colors.text.tertiary }]}>{t('assignments.none')}</Text>
      ) : (
        sorted.map((a) => {
          const status = assignmentStatus(a, now, false);
          const d = daysUntil(a.deadline, now);
          const statusColor =
            status === 'overdue'
              ? colors.system.red
              : status === 'active'
                ? colors.system.green
                : colors.text.tertiary;
          return (
            <View key={a.id} style={[styles.itemRow, { borderColor: colors.background.secondary }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.text.primary }]}>
                  {t('assignments.itemTitle', { n: worldNumber(a.worldId as WorldId) })}
                </Text>
                <Text style={[styles.itemDue, { color: colors.text.tertiary }]}>
                  {t('assignments.due', { date: new Date(a.deadline).toLocaleDateString('es-CO') })}
                </Text>
              </View>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status === 'overdue'
                  ? t('assignments.status_overdue')
                  : t('assignments.daysLeft', { n: d })}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipText: { fontSize: 13, fontWeight: '600' },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
  },
  createText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  none: { fontSize: 13, marginTop: 4 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  itemTitle: { fontSize: 14, fontWeight: '600' },
  itemDue: { fontSize: 12 },
  statusText: { fontSize: 13, fontWeight: '700' },
});
