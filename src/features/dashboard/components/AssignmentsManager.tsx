import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { listExit, listLayout } from '@shared/constants/motion';
import type { WorldId } from '@features/learning/data/quiz.types';
import type { RetoFinancieroTipo } from '@shared/types/tenancy';
import {
  asignacionRepository,
  type AsignacionWithId,
} from '@features/dashboard/data/asignacionRepository';
import { assignmentStatus, daysUntil } from '@features/dashboard/data/assignmentStatus';
import Segmented from '@features/savings/components/Segmented';
import { FadeIn } from '@features/savings/charts/ChartParts';
import {
  BotonChunky,
  Chip,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  paletaTono,
} from '@features/dashboard/components/profe/kit';

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
      showMessage(t('profe.tareaCreada'), undefined, 'success');
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
  const modos = useMemo(
    () => (['mundo', 'reto'] as const).map((m) => ({ key: m, label: t(`assignments.mode_${m}`) })),
    [t]
  );

  const pregunta = (texto: string) => (
    <Text style={[styles.pregunta, { color: colors.text.secondary }]}>{texto}</Text>
  );

  return (
    <View style={styles.wrap}>
      <Tarjeta style={{ gap: 14 }}>
        <View style={styles.cabeza}>
          <View style={[styles.cabezaIcono, { backgroundColor: colors.fill.brandSubtle }]}>
            <Ionicons name="add-circle" size={20} color={colors.brand.primary} />
          </View>
          <Text style={[styles.titulo, { color: colors.text.primary }]}>
            {t('profe.nuevaTarea')}
          </Text>
        </View>

        <Segmented options={modos} value={mode} onChange={setMode} />

        <FadeIn key={mode}>
          {mode === 'mundo' ? (
            <View style={styles.bloque}>
              {pregunta(t('profe.queMundo'))}
              <View style={styles.chipRow}>
                {WORLD_IDS.map((w) => (
                  <Chip
                    key={w}
                    texto={t('assignments.world', { n: worldNumber(w) })}
                    icono="planet"
                    seleccionado={w === world}
                    onPress={() => setWorld(w)}
                  />
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.bloque}>
              {pregunta(t('profe.queReto'))}
              <View style={styles.chipRow}>
                {RETO_TIPOS.map((tp) => (
                  <Chip
                    key={tp}
                    texto={t(`assignments.retoTipo_${tp}`)}
                    seleccionado={tp === retoTipo}
                    onPress={() => setRetoTipo(tp)}
                  />
                ))}
              </View>
              {pregunta(t('profe.cuantasVeces'))}
              <View style={styles.chipRow}>
                {CANTIDAD_PRESETS.map((c) => (
                  <Chip
                    key={c}
                    grande
                    texto={t('assignments.cantidadN', { n: c })}
                    seleccionado={c === cantidad}
                    onPress={() => setCantidad(c)}
                  />
                ))}
              </View>
            </View>
          )}
        </FadeIn>

        <View style={styles.bloque}>
          {pregunta(t('profe.paraCuando'))}
          <View style={styles.chipRow}>
            {DEADLINE_PRESETS.map((p) => (
              <Chip
                key={p.key}
                icono="calendar-outline"
                texto={t(`assignments.deadline_${p.key}`)}
                seleccionado={p.days === days}
                onPress={() => setDays(p.days)}
              />
            ))}
          </View>
        </View>

        <BotonChunky
          texto={t('assignments.create')}
          icono="paper-plane"
          cargando={creating}
          onPress={() => void onCreate()}
        />
      </Tarjeta>

      <Seccion texto={t('profe.tareasAsignadas', { count: sorted.length })} />

      {loading ? (
        <Esqueleto filas={2} alto={64} />
      ) : sorted.length === 0 ? (
        <Text style={[styles.none, { color: colors.text.tertiary }]}>{t('assignments.none')}</Text>
      ) : (
        <View style={{ gap: 10 }}>
          {sorted.map((a) => {
            const status = assignmentStatus(a, now, false);
            const d = daysUntil(a.deadline, now);
            const esReto = a.kind === 'reto';
            const tono = paletaTono(colors, esReto ? 'morado' : 'azul');
            const titulo = esReto
              ? t(`assignments.retoItem_${a.reto.tipo}`, { n: a.reto.cantidad })
              : t('assignments.itemTitle', { n: worldNumber(a.worldId as WorldId) });
            return (
              <Animated.View key={a.id} exiting={listExit} layout={listLayout}>
                <Tarjeta style={styles.item}>
                  <View style={[styles.itemIcono, { backgroundColor: tono.fondo }]}>
                    <Ionicons name={esReto ? 'flag' : 'planet'} size={18} color={tono.tinta} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.itemTitle, { color: colors.text.primary }]}>{titulo}</Text>
                    <Text style={[styles.itemDue, { color: colors.text.tertiary }]}>
                      {t('assignments.due', {
                        date: new Date(a.deadline).toLocaleDateString('es-CO'),
                      })}
                    </Text>
                  </View>
                  <Pill
                    texto={
                      status === 'overdue'
                        ? t('assignments.status_overdue')
                        : t('assignments.daysLeft', { n: d })
                    }
                    tono={status === 'overdue' ? 'rojo' : status === 'active' ? 'verde' : 'neutro'}
                  />
                </Tarjeta>
              </Animated.View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cabezaIcono: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { fontSize: 18, fontWeight: '900' },
  bloque: { gap: 10 },
  pregunta: { fontSize: 14, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  none: { fontSize: 14, fontWeight: '600', textAlign: 'center', paddingVertical: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  itemIcono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTitle: { fontSize: 15, fontWeight: '800' },
  itemDue: { fontSize: 13, fontWeight: '600' },
});
