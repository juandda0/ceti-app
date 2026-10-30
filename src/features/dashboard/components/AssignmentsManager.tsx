import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { confirmAction, showMessage } from '@shared/lib/dialogs';
import { listExit, listLayout } from '@shared/constants/motion';
import Bounceable from '@shared/components/Bounceable';
import type { AsignacionTarget, RetoFinancieroTipo, WorldProgress } from '@shared/types/tenancy';
import {
  asignacionRepository,
  type AsignacionWithId,
} from '@features/dashboard/data/asignacionRepository';
import { assignmentStatus, daysUntil } from '@features/dashboard/data/assignmentStatus';
import { avanceDeTarea } from '@features/dashboard/data/avanceTarea';
import { sigueEnClase } from '@features/dashboard/data/estadoRoster';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { rosterRepository, type EstudianteWithId } from '@features/dashboard/data/rosterRepository';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { resolveClassWorlds } from '@features/learning/data/classConfig';
import { displayWorldDef } from '@features/learning/data/worldMeta';
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
// v1: solo los dos tipos menos reveladores del comportamiento (RQ-PR14-CA2). Los
// demás se habilitan tras el visto de compliance-ley1581 (S7) y CP.
const RETO_TIPOS: RetoFinancieroTipo[] = ['registrar_movimientos', 'crear_meta'];
const CANTIDAD_PRESETS = [3, 5, 10];
const DEADLINE_PRESETS = [
  { key: '1w', days: 7 },
  { key: '2w', days: 14 },
  { key: '1m', days: 30 },
] as const;

type Progreso = WorldProgress & { worldId: string };

/**
 * Teacher panel for assignments: a world of the class (default or custom) or a
 * reto financiero, for the whole class or one student. The list shows who did
 * each world task, and lets the teacher push the deadline a week or delete it.
 */
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
  const [mundos, setMundos] = useState<{ id: string; nombre: string }[]>([]);
  const [world, setWorld] = useState<string | null>(null);
  const [roster, setRoster] = useState<EstudianteWithId[]>([]);
  const [progreso, setProgreso] = useState<Progreso[]>([]);
  const [para, setPara] = useState<string | null>(null); // null = toda la clase
  const [ocupada, setOcupada] = useState<string | null>(null);
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
    void (async () => {
      const [list, config, lista] = await Promise.all([
        asignacionRepository.listByCurso(colegioId, cursoId),
        classConfigRepository.get(colegioId, cursoId).catch(() => null),
        rosterRepository.getRoster(colegioId, cursoId).catch(() => []),
      ]);
      const enClase = lista.filter((e) => sigueEnClase(e.estado));
      const prog = (
        await Promise.all(
          enClase.map((e) =>
            worldProgressRepository.getStudentProgress(colegioId, cursoId, e.uid).catch(() => [])
          )
        )
      ).flat();
      if (cancelled) return;
      // Los mundos que ve la clase hoy, en su orden, incluidos los propios del profe.
      const entradas = new Map((config?.mundos ?? []).map((m) => [m.worldId, m]));
      const visibles = resolveClassWorlds(config, () => false).worlds.map((w) => ({
        id: w.worldId,
        nombre: displayWorldDef(w.worldId, entradas.get(w.worldId))?.name ?? w.worldId,
      }));
      setItems(list);
      setMundos(visibles);
      setWorld((w) => w ?? visibles[0]?.id ?? null);
      setRoster(enClase);
      setProgreso(prog);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [colegioId, cursoId]);

  const nombreMundo = useCallback(
    (worldId: string) =>
      mundos.find((m) => m.id === worldId)?.nombre ??
      displayWorldDef(worldId)?.name ??
      t('profe.tareaMundoOculto'),
    [mundos, t]
  );
  const nombreEstudiante = useCallback(
    (uid: string) => roster.find((e) => e.uid === uid)?.nombre ?? t('profe.tareaYaNoEsta'),
    [roster, t]
  );

  const onCreate = useCallback(async () => {
    setCreating(true);
    try {
      const now = Date.now();
      const target: AsignacionTarget = para
        ? { tipo: 'estudiante', cursoId, uid: para }
        : { tipo: 'curso', cursoId };
      const base = {
        target,
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
        if (!world) return;
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
  }, [colegioId, cursoId, mode, world, para, retoTipo, cantidad, days, createdByUid, reload, t]);

  const extender = async (a: AsignacionWithId) => {
    setOcupada(a.id);
    try {
      // Una semana más desde hoy si ya venció, o desde la fecha que tenía.
      await asignacionRepository.setDeadline(
        colegioId,
        a.id,
        Math.max(a.deadline, Date.now()) + 7 * DAY
      );
      await reload();
      showMessage(t('profe.tareaExtendida'), undefined, 'success');
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setOcupada(null);
    }
  };

  const borrar = (a: AsignacionWithId) =>
    confirmAction({
      title: t('profe.tareaBorrarTitulo'),
      body: t('profe.tareaBorrarTexto'),
      cancelLabel: t('admin.cancel'),
      confirmLabel: t('profe.tareaBorrar'),
      destructive: true,
      onConfirm: () => {
        void (async () => {
          setOcupada(a.id);
          try {
            await asignacionRepository.remove(colegioId, a.id);
            await reload();
          } catch (e) {
            showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
          } finally {
            setOcupada(null);
          }
        })();
      },
    });

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
                {mundos.map((m) => (
                  <Chip
                    key={m.id}
                    texto={m.nombre}
                    icono="planet"
                    seleccionado={m.id === world}
                    onPress={() => setWorld(m.id)}
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
          {pregunta(t('profe.paraQuien'))}
          <View style={styles.chipRow}>
            <Chip
              texto={t('profe.tareaTodaLaClase')}
              icono="people"
              seleccionado={para === null}
              onPress={() => setPara(null)}
            />
            {roster.map((e) => (
              <Chip
                key={e.uid}
                texto={e.nombre}
                seleccionado={para === e.uid}
                onPress={() => setPara(e.uid)}
              />
            ))}
          </View>
        </View>

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
          deshabilitado={mode === 'mundo' && !world}
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
            const avance = avanceDeTarea(
              a,
              roster.map((e) => e.uid),
              progreso
            );
            const todos = avance !== null && avance.total > 0 && avance.hechas === avance.total;
            const status = assignmentStatus(a, now, todos);
            const d = daysUntil(a.deadline, now);
            const esReto = a.kind === 'reto';
            const tono = paletaTono(colors, esReto ? 'morado' : 'azul');
            const titulo = esReto
              ? t(`assignments.retoItem_${a.reto.tipo}`, { n: a.reto.cantidad })
              : t('profe.tareaMundo', { mundo: nombreMundo(a.worldId) });
            const quien =
              a.target.tipo === 'estudiante'
                ? nombreEstudiante(a.target.uid)
                : t('profe.tareaTodaLaClase');
            return (
              <Animated.View key={a.id} exiting={listExit} layout={listLayout}>
                <Tarjeta style={styles.item}>
                  <View style={[styles.itemIcono, { backgroundColor: tono.fondo }]}>
                    <Ionicons name={esReto ? 'flag' : 'planet'} size={18} color={tono.tinta} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[styles.itemTitle, { color: colors.text.primary }]}>{titulo}</Text>
                    <Text style={[styles.itemDue, { color: colors.text.tertiary }]}>
                      {quien} ·{' '}
                      {t('assignments.due', {
                        date: new Date(a.deadline).toLocaleDateString('es-CO'),
                      })}
                    </Text>
                    {avance ? (
                      <Text style={[styles.itemAvance, { color: colors.text.secondary }]}>
                        {t('profe.tareaAvance', { hechas: avance.hechas, total: avance.total })}
                        {avance.tarde > 0
                          ? ` · ${t('profe.tareaTarde', { count: avance.tarde })}`
                          : ''}
                      </Text>
                    ) : (
                      <Text style={[styles.itemAvance, { color: colors.text.tertiary }]}>
                        {t('profe.tareaRetoPrivado')}
                      </Text>
                    )}
                  </View>
                  <View style={styles.itemLado}>
                    <Pill
                      texto={
                        status === 'done'
                          ? t('profe.tareaCompleta')
                          : status === 'overdue'
                            ? t('assignments.status_overdue')
                            : t('assignments.daysLeft', { n: d })
                      }
                      tono={
                        status === 'done' || status === 'active'
                          ? 'verde'
                          : status === 'overdue'
                            ? 'rojo'
                            : 'neutro'
                      }
                    />
                    <View style={styles.itemAcciones}>
                      <Bounceable
                        onPress={() => void extender(a)}
                        disabled={ocupada !== null}
                        activeScale={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={t('profe.tareaExtender')}
                        style={[styles.itemBoton, { backgroundColor: colors.materials.highlight }]}
                      >
                        <Ionicons name="calendar" size={16} color={colors.text.secondary} />
                        <Text style={[styles.itemBotonTexto, { color: colors.text.secondary }]}>
                          +7
                        </Text>
                      </Bounceable>
                      <Bounceable
                        onPress={() => borrar(a)}
                        disabled={ocupada !== null}
                        activeScale={0.9}
                        accessibilityRole="button"
                        accessibilityLabel={t('profe.tareaBorrar')}
                        style={[styles.itemBoton, { backgroundColor: colors.fill.redSubtle }]}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.system.red} />
                      </Bounceable>
                    </View>
                  </View>
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
  itemAvance: { fontSize: 13, fontWeight: '700' },
  itemLado: { alignItems: 'flex-end', gap: 8 },
  itemAcciones: { flexDirection: 'row', gap: 6 },
  itemBoton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    minWidth: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    justifyContent: 'center',
  },
  itemBotonTexto: { fontSize: 12, fontWeight: '900' },
});
