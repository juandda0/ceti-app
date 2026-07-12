import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import type { WorldId } from '@features/learning/data/quiz.types';
import type { RetoFinancieroTipo } from '@shared/types/tenancy';
import {
  asignacionRepository,
  type AsignacionWithId,
} from '@features/dashboard/data/asignacionRepository';
import { assignmentStatus, daysUntil } from '@features/dashboard/data/assignmentStatus';

const DAY = 24 * 60 * 60 * 1000;
const WORLD_IDS: WorldId[] = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];
// v1: solo los dos tipos menos reveladores del comportamiento (RQ-PR14-CA2). Los
// demás se habilitan tras el visto de compliance-ley1581 (S7) y CP.
const RETO_TIPOS: RetoFinancieroTipo[] = ['registrar_movimientos', 'crear_meta'];
const CANTIDAD_PRESETS = [3, 5, 10];
const DEADLINE_PRESETS = [
  { key: '1w', days: 7 },
  { key: '2w', days: 14 },
  { key: '1m', days: 30 },
] as const;

function worldNumber(worldId: WorldId): number {
  return Number(worldId.replace('world_', ''));
}

/** Teacher panel to create mundo assignments or retos financieros, and list them. */
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
  const [mode, setMode] = useState<'mundo' | 'reto'>('mundo');
  const [world, setWorld] = useState<WorldId>('world_1');
  const [retoTipo, setRetoTipo] = useState<RetoFinancieroTipo>('registrar_movimientos');
  const [cantidad, setCantidad] = useState<number>(5);
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
      const base = {
        target: { tipo: 'curso' as const, cursoId },
        fechaInicio: now,
        deadline: now + days * DAY,
        createdByUid,
        createdAt: now,
      };
      if (mode === 'reto') {
        await asignacionRepository.create(colegioId, {
          kind: 'reto',
          reto: { tipo: retoTipo, cantidad },
          ...base,
        });
      } else {
        await asignacionRepository.create(colegioId, { worldId: world, ...base });
      }
      await reload();
    } catch (e) {
      showMessage(
        t('admin.error'),
        e instanceof Error ? e.message : t('assignments.error'),
        'error'
      );
    } finally {
      setCreating(false);
    }
  }, [colegioId, cursoId, mode, world, retoTipo, cantidad, days, createdByUid, reload, t]);

  const now = Date.now();
  const sorted = useMemo(() => [...items].sort((a, b) => a.deadline - b.deadline), [items]);

  const chipStyle = (selected: boolean) => [
    styles.chip,
    {
      backgroundColor: selected ? colors.brand.primary : colors.background.secondary,
      borderColor: selected ? colors.brand.primary : colors.background.secondary,
    },
  ];
  const chipTextStyle = (selected: boolean) => [
    styles.chipText,
    { color: selected ? '#fff' : colors.text.secondary },
  ];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('assignments.title')}</Text>

      {/* Mundo | Reto */}
      <View style={styles.chipRow}>
        {(['mundo', 'reto'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            onPress={() => setMode(m)}
            style={chipStyle(mode === m)}
            accessibilityRole="button"
          >
            <Text style={chipTextStyle(mode === m)}>{t(`assignments.mode_${m}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'mundo' ? (
        <View style={styles.chipRow}>
          {WORLD_IDS.map((w) => (
            <TouchableOpacity key={w} onPress={() => setWorld(w)} style={chipStyle(w === world)}>
              <Text style={chipTextStyle(w === world)}>
                {t('assignments.world', { n: worldNumber(w) })}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <>
          <View style={styles.chipRow}>
            {RETO_TIPOS.map((tp) => (
              <TouchableOpacity
                key={tp}
                onPress={() => setRetoTipo(tp)}
                style={chipStyle(tp === retoTipo)}
              >
                <Text style={chipTextStyle(tp === retoTipo)}>
                  {t(`assignments.retoTipo_${tp}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.chipRow}>
            {CANTIDAD_PRESETS.map((c) => (
              <TouchableOpacity
                key={c}
                onPress={() => setCantidad(c)}
                style={chipStyle(c === cantidad)}
              >
                <Text style={chipTextStyle(c === cantidad)}>
                  {t('assignments.cantidadN', { n: c })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      {/* Deadline preset (compartido) */}
      <View style={styles.chipRow}>
        {DEADLINE_PRESETS.map((p) => (
          <TouchableOpacity
            key={p.key}
            onPress={() => setDays(p.days)}
            style={chipStyle(p.days === days)}
          >
            <Text style={chipTextStyle(p.days === days)}>{t(`assignments.deadline_${p.key}`)}</Text>
          </TouchableOpacity>
        ))}
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
          const titulo =
            a.kind === 'reto'
              ? t(`assignments.retoItem_${a.reto.tipo}`, { n: a.reto.cantidad })
              : t('assignments.itemTitle', { n: worldNumber(a.worldId as WorldId) });
          return (
            <View key={a.id} style={[styles.itemRow, { borderColor: colors.background.secondary }]}>
              <Ionicons
                name={a.kind === 'reto' ? 'flag-outline' : 'planet-outline'}
                size={16}
                color={colors.text.secondary}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemTitle, { color: colors.text.primary }]}>{titulo}</Text>
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
