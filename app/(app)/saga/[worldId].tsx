/**
 * WorldSagaScreen — un planeta: despegue, (la primera vez) Elige tu camino y
 * micro-teoría, y después el mapa de niveles en zigzag.
 *
 *   - Lecciones (5 preguntas, sin vidas, errores explicados) en orden.
 *   - Jefe final (10 preguntas 4+3+3, 3 vidas): es lo único que da la maestría
 *     del mundo, con el puntaje real (acertadas a la primera) — R9.
 *
 * Cada práctica pasa por Órbita (XP, Cetis, racha, meta) y termina en el cierre
 * con recompensas; la primera del día celebra la racha.
 *
 * Contenido determinista por estudiante (R7). RQ-ES02, RQ-FN09, RQ-ES06.
 */
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useStudentGrado } from '@features/learning/hooks/useStudentGrado';
import { useClassConfig } from '@features/learning/hooks/useClassConfig';
import { isWorldVisible } from '@features/learning/data/classConfig';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import { useWorldFlow } from '@features/learning/hooks/useWorldFlow';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import MicroteoriaView from '@features/learning/components/MicroteoriaView';
import EligeCaminoView from '@features/learning/components/EligeCaminoView';
import LeccionScreen, { type ResultadoLeccion } from '@features/learning/screens/LeccionScreen';
import MapaPlaneta from '@features/learning/components/galaxia/MapaPlaneta';
import StreakCelebration from '@features/learning/components/StreakCelebration';
import FinLeccion from '@features/orbita/components/FinLeccion';
import AbrirCofre from '@features/orbita/components/cofre/AbrirCofre';
import { useNivelesStore } from '@features/learning/store/useNivelesStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { buildWorldProgress } from '@features/learning/data/worldProgress';
import { worldProgressRepository } from '@features/dashboard/data/worldProgressRepository';
import { ganaCofre, nodosMapa, type NodoMapa, type TipoNivel } from '@features/orbita/domain/niveles';
import type { RecompensaPractica } from '@features/orbita/domain/orbita';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { refrescarAvisos } from '@features/orbita/hooks/useOrbita';
import { eventos } from '@features/orbita/data/eventos';
import type { QuizItem, WorldId } from '@features/learning/data/quiz.types';
import Despegue from '@features/learning/components/galaxia/Despegue';
import { planetaDeMundo } from '@features/learning/data/planetas';

// ─── World metadata (mirrors WorldQuizScreen) ─────────────────────────────────

const WORLD_META: Record<string, { name: string; color: string }> = {
  world_1: { name: 'Planeta Origen', color: '#FF8A1F' },
  world_2: { name: 'Luna del Presupuesto', color: '#F7C95F' },
  world_3: { name: 'Estrella del Ahorro', color: '#58C88C' },
  world_4: { name: 'Nebulosa del Crédito', color: '#A884FF' },
  world_5: { name: 'Agujero Negro de las Deudas', color: '#5B9EF5' },
};

/** Cofre recién ganado (primera lección o jefe): guarda los Cetis del nivel. */
interface Cofre {
  tipo: TipoNivel;
  nivel: number;
  cetis: number;
}

/** Duración mínima del despegue (ms). */
const DESPEGUE_MS = 2000;

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorldSagaScreen() {
  const { worldId } = useLocalSearchParams<{ worldId: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();

  const firebaseUid = useAuthStore((s) => s.firebaseUid);
  const localProfileId = useUserStore((s) => s.id);
  const uid = firebaseUid ?? localProfileId ?? 'demo';
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const grado = useStudentGrado();

  // Soft-exit guard (D-ORQ, RQ-PR10 CA4). The class config is live: if the
  // professor removes/defocuses THIS world while the student is inside, the
  // student may finish the activity already on screen (never kicked mid-
  // question) but cannot re-enter; a fresh entry into a hidden world bounces.
  const { config: classConfig, loaded: classConfigLoaded } = useClassConfig();
  const visible = !classConfigLoaded || isWorldVisible(classConfig, worldId ?? '');
  const wasVisibleRef = useRef(false);
  useEffect(() => {
    // Reset the latch if the runtime ever reuses this instance for another world.
    wasVisibleRef.current = false;
  }, [worldId]);
  useEffect(() => {
    if (classConfigLoaded && isWorldVisible(classConfig, worldId ?? '')) {
      wasVisibleRef.current = true;
    }
  }, [classConfigLoaded, classConfig, worldId]);
  useEffect(() => {
    // Entry guard: never was visible during this visit → not a soft exit, bounce.
    if (classConfigLoaded && !visible && !wasVisibleRef.current) {
      router.replace('/saga' as never);
    }
  }, [classConfigLoaded, visible, worldId, router]);
  const softExited = classConfigLoaded && !visible && wasVisibleRef.current;

  // Course content overrides (RQ-PR11) for THIS world, from the live config.
  const courseContent =
    colegioId && cursoId && worldId
      ? {
          colegioId,
          cursoId,
          overrides: classConfig?.overrides?.[worldId],
          version: classConfig?.version ?? 0,
        }
      : null;

  const { phase, situacion, microteoriaBank, handleECFinish, handleMTFinish } = useWorldFlow(
    uid,
    grado,
    worldId,
    courseContent
  );

  const configEntry = classConfig?.mundos?.find((m) => m.worldId === worldId);
  const disp = displayWorldDef(worldId ?? '', configEntry);
  const fallback = WORLD_META[worldId ?? ''] ?? { name: 'Mundo', color: '#FF8A1F' };
  const meta = { name: disp?.name ?? fallback.name, color: disp?.color ?? fallback.color };
  const posicion = Math.max(0, classConfig?.mundos?.findIndex((m) => m.worldId === worldId) ?? 0);
  const planeta = planetaDeMundo(worldId ?? '', posicion);

  // El despegue dura al menos DESPEGUE_MS a propósito, para que se alcance a leer (aunque cargue antes).
  const [despegueListo, setDespegueListo] = useState(false);
  useEffect(() => {
    setDespegueListo(false);
    const id = setTimeout(() => setDespegueListo(true), DESPEGUE_MS);
    return () => clearTimeout(id);
  }, [worldId]);

  // ── Niveles del planeta ───────────────────────────────────────────────────
  const role = useAuthStore((s) => s.role);
  const cargarNiveles = useNivelesStore((s) => s.cargar);
  const carga = useNivelesStore((s) => (worldId ? s.porMundo[worldId] : undefined));
  useEffect(() => {
    if (!grado || !worldId) return;
    void cargarNiveles(grado, worldId, uid, courseContent);
    // courseContent es un objeto nuevo en cada render; su versión es la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grado, worldId, uid, classConfig?.version, cargarNiveles]);
  // Los últimos niveles buenos, aunque esté recargando: una actualización remota
  // nunca desmonta el mapa ni la lección.
  const niveles = carga?.niveles;
  const hechas = useOrbitaStore((s) => s.porUid[uid]?.niveles[worldId ?? ''] ?? 0);
  // Suscripción a respuestas y progreso remoto para que "conquistado" se recalcule.
  useQuestionBankStore((s) => s.answers);
  useQuestionBankStore((s) => s.remoteProgress);
  const isWorldComplete = useQuestionBankStore((s) => s.isWorldComplete);
  const conquistado = !!worldId && isWorldComplete(uid, worldId as WorldId);
  const totalLecciones = niveles?.lecciones.length ?? 0;
  const nodos = niveles ? nodosMapa(totalLecciones, hechas, conquistado) : [];

  // La lección en curso guarda SUS preguntas: si los niveles se recargan por una
  // actualización remota (config de la clase, grado), la lección no se reinicia.
  const [jugando, setJugando] = useState<{
    tipo: TipoNivel;
    nivel: number;
    items: QuizItem[];
  } | null>(null);
  // Una vez dentro del planeta (mapa o lección), el despegue y las fases de
  // entrada ya no vuelven aunque grado/config/flujo pasen por "cargando".
  const yaEntro = useRef(false);
  const [fin, setFin] = useState<{
    recompensa: RecompensaPractica;
    resultado: ResultadoLeccion;
    tipo: TipoNivel;
    conquistado: boolean;
    cofre: Cofre | null;
  } | null>(null);
  // El cofre (primera lección o jefe), que se entrega después del cierre la primera vez que se gana.
  const [cofre, setCofre] = useState<Cofre | null>(null);
  const [celebracion, setCelebracion] = useState<RecompensaPractica | null>(null);

  const salirDelMundo = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(app)/saga');
  };

  const abrirNodo = (n: NodoMapa) => {
    if (n.estado === 'bloqueado' || !niveles) return;
    const items = n.tipo === 'jefe' ? niveles.jefe : (niveles.lecciones[n.indice] ?? []);
    if (items.length === 0) return;
    setJugando({ tipo: n.tipo, nivel: n.indice, items });
  };

  const alTerminar = (resultado: ResultadoLeccion) => {
    if (!jugando || !worldId) return;
    const { tipo, nivel } = jugando;
    let ganoPlaneta = false;

    if (tipo === 'jefe') {
      // La maestría sale del jefe, con lo acertado a la primera (antes siempre era 10/10).
      const { recordAnswer, getWorldProgress } = useQuestionBankStore.getState();
      const acertadas = new Set(resultado.idsAcertadas);
      for (const q of jugando.items) recordAnswer(uid, q.id, worldId as WorldId, acertadas.has(q.id));
      ganoPlaneta = useQuestionBankStore.getState().isWorldComplete(uid, worldId as WorldId);
      if (role === 'estudiante' && colegioId && cursoId && firebaseUid) {
        const { done, total } = getWorldProgress(uid, worldId as WorldId);
        const progress = buildWorldProgress({
          colegioId,
          cursoId,
          uid: firebaseUid,
          worldId: worldId as WorldId,
          correct: done,
          total,
          competencia: configEntry?.competencia,
          now: Date.now(),
        });
        // Si aún no está activo en el curso las reglas lo niegan: el progreso
        // queda local y se reintenta en la próxima conquista.
        worldProgressRepository
          .upsert(colegioId, cursoId, firebaseUid, worldId, progress)
          .catch(() => undefined);
      }
    }

    const r = useOrbitaStore.getState().completar(uid, {
      tipo,
      worldId,
      nivel: tipo === 'leccion' ? nivel : undefined,
      xpRespuestas: resultado.xpRespuestas,
      perfecta: resultado.perfecta,
    });
    eventos.leccionFin({
      mundo: worldId,
      tipo,
      nivel,
      perfecta: resultado.perfecta,
      xp: r.xp,
      errores: resultado.errores,
    });
    eventos.cetisGanados({ cantidad: r.cetis + r.cetisHito + r.cetisMeta, origen: tipo });
    if (r.primeroHoy) eventos.rachaExtendida({ racha: r.racha, reparada: r.reparada });
    if (r.metaCumplida) eventos.metaCumplida({ meta: r.estado.ajustes.meta, lecciones: r.leccionesHoy });
    if (r.hito) eventos.hitoRacha({ hito: r.hito });
    refrescarAvisos(r.estado);

    const primera = ganaCofre(tipo, nivel, totalLecciones, hechas, conquistado, ganoPlaneta);
    setJugando(null);
    setFin({
      recompensa: r,
      resultado,
      tipo,
      conquistado: ganoPlaneta,
      cofre: primera && r.cetis > 0 ? { tipo, nivel, cetis: r.cetis } : null,
    });
    // Si la lección tocó la racha (primer día, reparación o hito), la racha va
    // primero y el resumen del nivel después.
    if (r.primeroHoy || r.reparada || r.hito) setCelebracion(r);
  };

  const alContinuar = () => {
    if (fin?.cofre) setCofre(fin.cofre);
    setFin(null);
  };

  if (jugando || fin || cofre || (niveles && phase === 'quiz' && grado && despegueListo)) {
    yaEntro.current = true;
  }
  const entrando = !yaEntro.current;

  let content: React.ReactElement;
  if (entrando && (phase === 'loading' || !grado || !despegueListo)) {
    // ── Despegue (carga) ──────────────────────────────────────────────────────
    content = (
      <Despegue
        nombre={meta.name}
        descripcion={disp?.description}
        planeta={planeta}
        duracion={DESPEGUE_MS}
      />
    );
  } else if (entrando && phase === 'eligecamino' && situacion !== null) {
    // ── EligeCamino (solo la primera vez) ────────────────────────────────────
    content = (
      <EligeCaminoView
        situacion={situacion}
        worldName={meta.name}
        accentColor={meta.color}
        onFinish={handleECFinish}
      />
    );
  } else if (entrando && phase === 'microteoria' && microteoriaBank !== null) {
    // ── Micro-teoría (solo la primera vez) ───────────────────────────────────
    content = (
      <MicroteoriaView
        cards={microteoriaBank.cards}
        worldName={meta.name}
        accentColor={meta.color}
        onFinish={handleMTFinish}
      />
    );
  } else if (fin && celebracion) {
    // ── La racha se celebra primero (modal encima); el cierre espera ─────────
    content = <View style={styles.esperaRacha} />;
  } else if (cofre) {
    // ── Entrega del cofre de la zona ─────────────────────────────────────────
    content = (
      <AbrirCofre
        titulo={t('orbita.cofre.titulo')}
        subtitulo={
          cofre.tipo === 'jefe'
            ? t('orbita.cofre.jefe', { mundo: meta.name })
            : t('orbita.cofre.zona', { n: cofre.nivel + 1, mundo: meta.name })
        }
        color={planeta.acento}
        cetis={cofre.cetis}
        onReclamar={() => setCofre(null)}
      />
    );
  } else if (fin) {
    // ── Cierre con recompensas ───────────────────────────────────────────────
    content = (
      <FinLeccion
        recompensa={fin.recompensa}
        modo={fin.tipo}
        titulo={meta.name}
        color={planeta.acento}
        aciertos={fin.resultado.acertadasALaPrimera}
        total={fin.resultado.total}
        conquistado={fin.conquistado}
        cetisEnCofre={fin.cofre?.cetis}
        onContinuar={alContinuar}
      />
    );
  } else if (jugando) {
    // ── Lección o jefe (con sus preguntas fijadas al empezar) ────────────────
    content = (
      <LeccionScreen
        key={`${jugando.tipo}-${jugando.nivel}`}
        items={jugando.items}
        modo={jugando.tipo}
        titulo={
          jugando.tipo === 'jefe'
            ? t('orbita.mapa.jefeDe', { mundo: meta.name })
            : t('orbita.mapa.leccion', { n: jugando.nivel + 1, total: totalLecciones })
        }
        color={meta.color}
        mundo={worldId ?? ''}
        nivel={jugando.nivel}
        onSalir={() => setJugando(null)}
        onTerminar={alTerminar}
      />
    );
  } else if (carga?.estado === 'error' && !niveles) {
    content = (
      <View style={[styles.centro, { backgroundColor: colors.background.base }]}>
        <Ionicons name="cloud-offline" size={48} color={colors.text.quaternary} />
        <Text style={[styles.centroTitulo, { color: colors.text.secondary }]}>{t('quiz.offline')}</Text>
        <Text style={[styles.centroTexto, { color: colors.text.tertiary }]}>{t('quiz.offlineHint')}</Text>
      </View>
    );
  } else if (!niveles) {
    content = (
      <View style={[styles.centro, { backgroundColor: colors.background.base }]}>
        <ActivityIndicator size="large" color={meta.color} />
      </View>
    );
  } else {
    // ── Mapa de niveles ──────────────────────────────────────────────────────
    content = (
      <MapaPlaneta
        nombre={meta.name}
        planeta={planeta}
        nodos={nodos}
        totalLecciones={totalLecciones}
        onNodo={abrirNodo}
        onVolver={salirDelMundo}
        onGuia={() => router.push(`/saga/guia/${worldId}` as never)}
      />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {softExited && (
        <View
          style={[
            styles.classUpdatedBanner,
            { backgroundColor: colors.background.elevated, borderColor: meta.color },
          ]}
          accessibilityRole="alert"
        >
          <Ionicons name="megaphone-outline" size={16} color={meta.color} />
          <Text style={[styles.classUpdatedText, { color: colors.text.primary }]}>
            {t('worlds.classUpdated')}
          </Text>
        </View>
      )}
      {content}
      <StreakCelebration
        racha={celebracion?.racha ?? 0}
        hito={celebracion?.hito}
        reparada={celebracion?.reparada}
        visible={celebracion !== null}
        onClose={() => setCelebracion(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  esperaRacha: { flex: 1, backgroundColor: '#0E0F13' },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  centroTitulo: { ...Typography.headline, textAlign: 'center' },
  centroTexto: { ...Typography.footnote, textAlign: 'center' },
  classUpdatedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  classUpdatedText: {
    ...Typography.footnote,
    fontWeight: '600',
    flex: 1,
  },
});
