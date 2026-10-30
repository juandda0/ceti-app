/**
 * Fase 8a — clase en vivo, lado del profe: es la pantalla que se proyecta.
 * Prepara la sesión (mundo, cuántas preguntas, segundos), espera a la clase,
 * muestra cada pregunta con su cuenta regresiva, la revela sola al acabar el
 * tiempo o cuando todos respondieron, y cierra con el podio. Cualquier profe de
 * la clase (co-docentes) la opera; todo pasa por `operarClaseVivo`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import { useMuro } from '@features/educadores/components/MuroPlan';
import { motivoDeError } from '@features/educadores/data/planUi';
import AvisoSoloCalifica from '@features/educadores/permisos/AvisoSoloCalifica';
import { usePermisoClase } from '@features/educadores/permisos/usePermisoClase';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { classConfigRepository } from '@features/dashboard/data/classConfigRepository';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import { questionBankRepository } from '@features/learning/data/QuestionBankRepository';
import { WORLD_ORDER } from '@features/learning/data/competencias';
import { displayWorldDef } from '@features/learning/data/worldMeta';
import type { Grado } from '@features/learning/data/quiz.types';
import { GrowBar } from '@features/savings/charts/ChartParts';
import {
  BotonChunky,
  Chip,
  Cifra,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
} from '@features/dashboard/components/profe/kit';
import {
  MAX_PREGUNTAS_VIVO,
  SEGUNDOS_VIVO,
  elegirPreguntasVivo,
  rankingVivo,
  type ItemBancoVivo,
  type SesionVivo,
} from '@/functions/src/educadores/dominio';
import { vivoRepository } from '../data/vivoRepository';
import { useFactoresTiempo } from '../hooks/useFactoresTiempo';
import { COLORES_OPCION, LETRAS } from '../components/opciones';

const CANTIDADES = [5, 10, MAX_PREGUNTAS_VIVO] as const;

interface MundoClase {
  worldId: string;
  nombre: string;
}

export default function ClaseVivoProfeScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ancho = width >= 900;
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId ?? '';
  const nombreCurso = useNombreCurso(cursoId, params.nombre);
  const colegioId = useAuthStore((s) => s.colegioId);
  const { plan, limites, cargando: planCargando } = useMiPlan();
  const muro = useMuro();
  const { puede: puedeEnClase } = usePermisoClase(cursoId);

  const [sesion, setSesion] = useState<SesionVivo | null | undefined>(undefined);
  const [nombres, setNombres] = useState<Record<string, string>>({});
  const [presentes, setPresentes] = useState<string[]>([]);
  const [respondieron, setRespondieron] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [ahora, setAhora] = useState(Date.now());

  // Preparación
  const [mundos, setMundos] = useState<MundoClase[]>([]);
  const [grado, setGrado] = useState<Grado | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Record<string, boolean>> | undefined>(undefined);
  const [worldId, setWorldId] = useState<string | null>(null);
  const [cantidad, setCantidad] = useState<number>(10);
  const [segundos, setSegundos] = useState<number>(20);

  useEffect(() => {
    if (!colegioId || !cursoId) return;
    return vivoRepository.escuchar(colegioId, cursoId, setSesion, () => setSesion(null));
  }, [colegioId, cursoId]);

  useEffect(() => {
    if (!colegioId || !cursoId) return;
    let cancelado = false;
    void (async () => {
      try {
        const [roster, config, g] = await Promise.all([
          rosterRepository.getRoster(colegioId, cursoId),
          classConfigRepository.get(colegioId, cursoId),
          rosterRepository.getCursoGrado(colegioId, cursoId),
        ]);
        if (cancelado) return;
        setNombres(Object.fromEntries(roster.filter((e) => e.estado === 'activo').map((e) => [e.uid, e.nombre || e.email])));
        const entradas: { worldId: string; activo: boolean; nombre?: string }[] = config?.mundos?.length
          ? config.mundos
          : WORLD_ORDER.map((w) => ({ worldId: w, activo: true }));
        const lista = entradas
          .filter((m) => m.activo)
          .map((m) => ({ worldId: m.worldId, nombre: displayWorldDef(m.worldId, m)?.name ?? m.worldId }));
        setMundos(lista);
        setWorldId((w) => w ?? lista[0]?.worldId ?? null);
        setOverrides(config?.overrides);
        setGrado((g ?? '9') as Grado);
      } catch {
        if (!cancelado) setMundos([]);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [colegioId, cursoId]);

  const sesionId = sesion?.id;
  useEffect(() => {
    if (!colegioId || !cursoId || !sesionId) return setPresentes([]);
    return vivoRepository.escucharPresentes(colegioId, cursoId, sesionId, setPresentes);
  }, [colegioId, cursoId, sesionId]);

  const n = sesion?.estado === 'pregunta' ? sesion.pregunta?.n : undefined;
  useEffect(() => {
    if (!colegioId || !cursoId || n === undefined) return setRespondieron([]);
    return vivoRepository.escucharRespuestas(colegioId, cursoId, n, setRespondieron);
  }, [colegioId, cursoId, n]);

  // Reloj de la cuenta regresiva (solo con una pregunta abierta).
  useEffect(() => {
    if (sesion?.estado !== 'pregunta') return;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [sesion?.estado]);

  // Quien tiene «más tiempo» alarga la pregunta para todos (Fase 8c).
  const factor = useFactoresTiempo(colegioId, cursoId, presentes);
  const restanteMs =
    sesion?.estado === 'pregunta' && sesion.pregunta
      ? Math.max(0, sesion.pregunta.abiertaAt + sesion.pregunta.segundos * 1000 * factor - ahora)
      : 0;

  const operar = useCallback(
    async (accion: 'siguiente' | 'revelar' | 'terminar' | 'cerrar') => {
      if (ocupado) return;
      setOcupado(true);
      try {
        await vivoRepository.operar(cursoId, accion);
      } catch (e) {
        showMessage(t('diferenciales.vivo.error'), e instanceof Error ? e.message : undefined, 'error');
      } finally {
        setOcupado(false);
      }
    },
    [cursoId, ocupado, t]
  );

  // Se revela sola: al acabar el tiempo o cuando respondieron todos los que entraron.
  const reveladaN = useRef<number | null>(null);
  useEffect(() => {
    if (sesion?.estado !== 'pregunta' || n === undefined || reveladaN.current === n) return;
    const todos = presentes.length > 0 && respondieron.length >= presentes.length;
    if (restanteMs <= 0 || todos) {
      reveladaN.current = n;
      void operar('revelar');
    }
  }, [sesion?.estado, n, restanteMs, presentes.length, respondieron.length, operar]);

  const abrir = async () => {
    if (!worldId || !grado || !colegioId) return;
    setOcupado(true);
    try {
      const pool = await questionBankRepository.fetchPool(grado, worldId, {
        colegioId,
        cursoId,
        overrides: overrides?.[worldId],
        version: 0,
      });
      const items = [...(pool?.mc ?? []), ...(pool?.vf ?? [])] as unknown as ItemBancoVivo[];
      const preguntas = elegirPreguntasVivo(items, cantidad, `${cursoId}:${Date.now()}`);
      const titulo = mundos.find((m) => m.worldId === worldId)?.nombre ?? '';
      await vivoRepository.crear(cursoId, { worldId, titulo, segundos, preguntas });
    } catch (e) {
      // F9: al pasar el cupo del mes, el muro con los planes en vez del mensaje.
      const motivo = motivoDeError(e);
      if (motivo) muro.abrir(motivo);
      else showMessage(t('diferenciales.vivo.error'), e instanceof Error ? e.message : undefined, 'error');
    } finally {
      setOcupado(false);
    }
  };

  const ranking = useMemo(() => rankingVivo(sesion?.puntajes ?? {}), [sesion?.puntajes]);
  const quedan = Number.isFinite(limites.clasesVivoMes) ? limites.clasesVivoMes : null;

  const encabezado = (
    <Encabezado
      atras={`/(staff)/curso/${cursoId}`}
      sobretitulo={t('diferenciales.vivo.sobre')}
      titulo={nombreCurso}
      derecha={sesion && sesion.estado !== 'terminada' ? <Pill texto={t('diferenciales.vivo.enVivo')} tono="rojo" icono="radio" /> : null}
    />
  );

  return (
    <ScreenWrapper>
      <ContextScrollView contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]} showsVerticalScrollIndicator={false}>
        {encabezado}
        <AvisoSoloCalifica cursoId={cursoId} />

        {sesion === undefined ? <Esqueleto filas={3} alto={80} /> : null}

        {sesion === null && puedeEnClase('claseVivo') ? (
          <>
            <Tarjeta style={{ gap: 12 }}>
              <Text style={[st.cuerpo, { color: colors.text.secondary }]}>{t('diferenciales.vivo.intro')}</Text>
              <Seccion texto={t('diferenciales.vivo.mundo')} />
              {mundos.length === 0 ? <Esqueleto filas={1} alto={40} /> : null}
              <View style={st.chips}>
                {mundos.map((m) => (
                  <Chip key={m.worldId} texto={m.nombre} seleccionado={worldId === m.worldId} onPress={() => setWorldId(m.worldId)} />
                ))}
              </View>
              <Seccion texto={t('diferenciales.vivo.cuantas')} />
              <View style={st.chips}>
                {CANTIDADES.map((c) => (
                  <Chip key={c} texto={String(c)} seleccionado={cantidad === c} onPress={() => setCantidad(c)} />
                ))}
              </View>
              <Seccion texto={t('diferenciales.vivo.tiempo')} />
              <View style={st.chips}>
                {SEGUNDOS_VIVO.map((s) => (
                  <Chip key={s} texto={t('diferenciales.vivo.segundos', { count: s })} seleccionado={segundos === s} onPress={() => setSegundos(s)} />
                ))}
              </View>
              <BotonChunky
                texto={t('diferenciales.vivo.abrir')}
                icono="radio"
                cargando={ocupado}
                deshabilitado={!worldId || planCargando}
                onPress={() => void abrir()}
              />
              {!planCargando && plan === 'cadete' && quedan !== null ? (
                <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.vivo.cupoCadete', { count: quedan })}</Text>
              ) : null}
            </Tarjeta>
            <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.vivo.nota')}</Text>
          </>
        ) : null}

        {sesion?.estado === 'lobby' ? (
          <Proyector>
            <Text style={st.pTitulo}>{t('diferenciales.vivo.lobbyTitulo', { mundo: sesion.titulo })}</Text>
            <Text style={st.pTexto}>{t('diferenciales.vivo.lobbyTexto')}</Text>
            <Text style={st.pGrande}>{t('diferenciales.vivo.entraron', { count: presentes.length })}</Text>
            <View style={st.nombres}>
              {presentes.map((u) => (
                <View key={u} style={st.nombreChip}>
                  <Text style={st.nombreTxt}>{nombres[u] ?? '…'}</Text>
                </View>
              ))}
            </View>
            <BotonChunky texto={t('diferenciales.vivo.empezar')} icono="play" cargando={ocupado} onPress={() => void operar('siguiente')} />
          </Proyector>
        ) : null}

        {sesion?.estado === 'pregunta' && sesion.pregunta ? (
          <Proyector>
            <View style={st.pFila}>
              <Text style={st.pMeta}>
                {t('diferenciales.vivo.progreso', { n: sesion.pregunta.n + 1, total: sesion.total })}
              </Text>
              <Text style={st.pMeta}>{t('diferenciales.vivo.respondieron', { n: respondieron.length, total: presentes.length })}</Text>
              <View style={[st.reloj, { borderColor: colors.brand.primary }]}>
                <Text style={st.relojTxt}>{Math.ceil(restanteMs / 1000)}</Text>
              </View>
            </View>
            <Text style={[st.pPregunta, ancho && { fontSize: 34, lineHeight: 42 }]}>{sesion.pregunta.enunciado}</Text>
            <View style={[st.tiles, ancho && st.tilesAncho]}>
              {sesion.pregunta.opciones.map((o, i) => (
                <View key={i} style={[st.tile, ancho && st.tileAncho, { backgroundColor: COLORES_OPCION[i % COLORES_OPCION.length] }]}>
                  <Text style={st.tileLetra}>{LETRAS[i]}</Text>
                  <Text style={st.tileTxt}>{o}</Text>
                </View>
              ))}
            </View>
            <BotonChunky texto={t('diferenciales.vivo.revelar')} icono="eye" variante="secundario" cargando={ocupado} onPress={() => void operar('revelar')} />
          </Proyector>
        ) : null}

        {sesion?.estado === 'revelada' && sesion.revelada ? (
          <Proyector>
            <View style={st.pFila}>
              <Text style={st.pMeta}>
                {t('diferenciales.vivo.correcta', { letra: LETRAS[sesion.revelada.correcta] })}
              </Text>
              <Text style={st.pMeta}>
                {t('diferenciales.vivo.acertaron', { n: sesion.revelada.aciertos, total: sesion.revelada.respondieron })}
              </Text>
            </View>
            <View style={[st.split, ancho && { flexDirection: 'row' }]}>
              <View style={{ flex: 1.2, gap: 10 }}>
                {sesion.revelada.conteo.map((c, i) => {
                  const pct = sesion.revelada?.respondieron ? Math.round((c / sesion.revelada.respondieron) * 100) : 0;
                  const ok = i === sesion.revelada?.correcta;
                  return (
                    <View key={i} style={st.barra}>
                      <Text style={[st.barraLetra, { opacity: ok ? 1 : 0.6 }]}>{ok ? '✓' : LETRAS[i]}</Text>
                      <View style={{ flex: 1 }}>
                        <GrowBar pct={pct} color={COLORES_OPCION[i % COLORES_OPCION.length]} trackColor="#ffffff1f" height={18} />
                      </View>
                      <Text style={st.barraNum}>{c}</Text>
                    </View>
                  );
                })}
                {sesion.revelada.explicacion ? <Text style={st.pTexto}>{sesion.revelada.explicacion}</Text> : null}
              </View>
              <Podio ranking={ranking.slice(0, 5)} grupos={sesion.grupos} titulo={t('diferenciales.vivo.top')} tituloGrupos={t('diferenciales.vivo.grupos')} />
            </View>
            {sesion.actual + 1 < sesion.total ? (
              <BotonChunky texto={t('diferenciales.vivo.siguiente')} icono="arrow-forward" cargando={ocupado} onPress={() => void operar('siguiente')} />
            ) : (
              <BotonChunky texto={t('diferenciales.vivo.terminar')} icono="trophy" cargando={ocupado} onPress={() => void operar('terminar')} />
            )}
          </Proyector>
        ) : null}

        {sesion?.estado === 'terminada' ? (
          <>
            <Proyector>
              <Text style={st.pTitulo}>{t('diferenciales.vivo.finTitulo')}</Text>
              <View style={st.podio}>
                {[1, 0, 2].map((i) =>
                  ranking[i] ? (
                    <View key={i} style={[st.escalon, { height: [150, 110, 80][i] }]}>
                      <Text style={st.escalonPuesto}>{i + 1}°</Text>
                      <Text style={st.escalonNombre} numberOfLines={1}>{ranking[i].nombre}</Text>
                      <Text style={st.escalonPts}>{ranking[i].puntos.toLocaleString('es-CO')}</Text>
                    </View>
                  ) : null
                )}
              </View>
              {sesion.grupos.length ? <Podio ranking={[]} grupos={sesion.grupos} titulo="" tituloGrupos={t('diferenciales.vivo.grupos')} /> : null}
            </Proyector>
            <View style={st.cifras}>
              <Cifra icono="people" valor={String(ranking.length)} etiqueta={t('diferenciales.vivo.participaron')} />
              <Cifra icono="checkmark-circle" tono="verde" valor={`${pctClase(sesion)} %`} etiqueta={t('diferenciales.vivo.aciertosClase')} />
            </View>
            <Text style={[st.nota, { color: colors.text.tertiary }]}>{t('diferenciales.vivo.quedaRegistro')}</Text>
            <BotonChunky texto={t('diferenciales.vivo.cerrar')} icono="close" variante="secundario" cargando={ocupado} onPress={() => void operar('cerrar')} />
          </>
        ) : null}

        {sesion && sesion.estado !== 'terminada' ? (
          <BotonChunky texto={t('diferenciales.vivo.terminarYa')} icono="stop" variante="peligro" compacto cargando={ocupado} onPress={() => void operar('terminar')} />
        ) : null}
        {sesion === null && mundos.length === 0 && grado ? (
          <Vacio icono="planet-outline" titulo={t('diferenciales.vivo.sinMundos')} />
        ) : null}
      </ContextScrollView>
      {muro.hoja}
    </ScreenWrapper>
  );
}

function pctClase(s: SesionVivo): number {
  const v = Object.values(s.puntajes);
  const respondidas = v.reduce((a, p) => a + p.respondidas, 0);
  const aciertos = v.reduce((a, p) => a + p.aciertos, 0);
  return respondidas ? Math.round((aciertos / respondidas) * 100) : 0;
}

function Proyector({ children }: { children: React.ReactNode }) {
  return <View style={st.proyector}>{children}</View>;
}

function Podio({
  ranking,
  grupos,
  titulo,
  tituloGrupos,
}: {
  ranking: { uid: string; nombre: string; puntos: number; puesto: number }[];
  grupos: SesionVivo['grupos'];
  titulo: string;
  tituloGrupos: string;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      {ranking.length ? <Text style={st.pMeta}>{titulo}</Text> : null}
      {ranking.map((r) => (
        <View key={r.uid} style={st.fila}>
          <Text style={st.filaTxt}>{`${r.puesto} · ${r.nombre}`}</Text>
          <Text style={st.filaPts}>{r.puntos.toLocaleString('es-CO')}</Text>
        </View>
      ))}
      {grupos.length ? <Text style={[st.pMeta, { marginTop: 6 }]}>{tituloGrupos}</Text> : null}
      {grupos.map((g) => (
        <View key={g.id} style={st.fila}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
            <View style={[st.punto, { backgroundColor: g.color }]} />
            <Text style={st.filaTxt}>{g.nombre}</Text>
          </View>
          <Text style={st.filaPts}>{g.puntos.toLocaleString('es-CO')}</Text>
        </View>
      ))}
    </View>
  );
}

const NOCHE = '#141418';
const TINTA = '#F2F2F4';

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 16 },
  cuerpo: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  nota: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cifras: { flexDirection: 'row', gap: 12 },
  proyector: { backgroundColor: NOCHE, borderRadius: 24, padding: 20, gap: 16 },
  pTitulo: { color: TINTA, fontSize: 26, lineHeight: 32, fontWeight: '900' },
  pTexto: { color: TINTA, opacity: 0.85, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  pGrande: { color: TINTA, fontSize: 40, fontWeight: '900' },
  pFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  pMeta: { color: TINTA, opacity: 0.8, fontSize: 14, fontWeight: '800' },
  pPregunta: { color: TINTA, fontSize: 24, lineHeight: 31, fontWeight: '900' },
  reloj: { width: 58, height: 58, borderRadius: 29, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  relojTxt: { color: TINTA, fontSize: 22, fontWeight: '900' },
  tiles: { gap: 10 },
  tilesAncho: { flexDirection: 'row', flexWrap: 'wrap' },
  tile: { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 5, borderBottomColor: '#00000040' },
  tileAncho: { width: '48.5%' },
  tileLetra: { color: '#fff', fontSize: 18, fontWeight: '900', opacity: 0.85 },
  tileTxt: { color: '#fff', fontSize: 18, lineHeight: 23, fontWeight: '800', flex: 1 },
  split: { gap: 16 },
  barra: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barraLetra: { color: TINTA, width: 22, fontSize: 16, fontWeight: '900' },
  barraNum: { color: TINTA, width: 32, textAlign: 'right', fontSize: 15, fontWeight: '900' },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff14', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  filaTxt: { color: TINTA, fontSize: 15, fontWeight: '800' },
  filaPts: { color: TINTA, fontSize: 15, fontWeight: '900' },
  punto: { width: 12, height: 12, borderRadius: 6 },
  nombres: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nombreChip: { backgroundColor: '#ffffff1a', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  nombreTxt: { color: TINTA, fontSize: 14, fontWeight: '800' },
  podio: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  escalon: { flex: 1, maxWidth: 180, backgroundColor: '#FF8A1F', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 10, justifyContent: 'flex-start', alignItems: 'center', gap: 2 },
  escalonPuesto: { color: NOCHE, fontSize: 24, fontWeight: '900' },
  escalonNombre: { color: NOCHE, fontSize: 15, fontWeight: '900' },
  escalonPts: { color: NOCHE, fontSize: 13, fontWeight: '800' },
});
