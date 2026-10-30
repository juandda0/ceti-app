/**
 * Ficha del estudiante (Fase 2). El profe la abre tocando un estudiante en el
 * tablero de la clase. Responde en una pantalla: cómo va (nota, aciertos), cuánto
 * entra (días, visitas, minutos), en qué va bien y en qué no (competencias,
 * preguntas que más falla), cómo le fue en cada mundo y su evolución semana a
 * semana. Todo sale de lo que hizo en el espacio de esta clase desde que se unió.
 * Con Cadete se ven los últimos 7 días; el historial completo es de Piloto.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import { FadeIn, GrowBar } from '@features/savings/charts/ChartParts';
import { ETIQUETA_DESEMPENO } from '@/functions/src/educadores/dominio';
import { competenciaLabel } from '@features/learning/data/competencias';
import {
  cargarFichaEstudiante,
  type FichaCargada,
} from '@features/dashboard/data/cargarFichaEstudiante';
import type { EstadoMundo } from '@features/dashboard/data/fichaEstudiante';
import { asignacionRepository } from '@features/dashboard/data/asignacionRepository';
import {
  Aviso,
  BotonChunky,
  Chip,
  Cifra,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  tonoNivel,
  type Tono,
} from '@features/dashboard/components/profe/kit';

const DIA_MS = 24 * 60 * 60 * 1000;
const TONO_MUNDO: Record<EstadoMundo, Tono> = {
  conquistado: 'verde',
  en_curso: 'naranja',
  sin_empezar: 'neutro',
};

const pct = (v: number | null) => (v == null ? null : Math.round(v * 100));
const fecha = (t: number | null) =>
  t == null ? '—' : new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

export default function FichaEstudianteScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colegioId = useAuthStore((s) => s.colegioId);
  const profeUid = useAuthStore((s) => s.firebaseUid);
  const { cursoId, uid, nombre } = useLocalSearchParams<{
    cursoId: string;
    uid: string;
    nombre?: string;
  }>();
  const { puede, cargando: planCargando } = useMiPlan();
  const completa = !planCargando && puede('fichaCompleta');

  const [datos, setDatos] = useState<FichaCargada | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [mundoTarea, setMundoTarea] = useState<string | null>(null);
  const [asignando, setAsignando] = useState(false);

  const cargar = useCallback(async () => {
    if (!colegioId || !cursoId || !uid || planCargando) return;
    setEstado('cargando');
    try {
      const ahora = Date.now();
      const desde = completa ? 0 : ahora - 7 * DIA_MS;
      setDatos(await cargarFichaEstudiante(colegioId, cursoId, uid, { desde, ahora }));
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [colegioId, cursoId, uid, completa, planCargando]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const ficha = datos?.ficha;
  const nombreVisible = datos?.estudiante?.nombre ?? nombre ?? '';
  const pendientes = useMemo(
    () => (ficha?.mundos ?? []).filter((m) => m.estado !== 'conquistado'),
    [ficha]
  );

  const asignar = async () => {
    if (!colegioId || !cursoId || !uid || !profeUid || !mundoTarea) return;
    setAsignando(true);
    try {
      const ahora = Date.now();
      await asignacionRepository.create(colegioId, {
        worldId: mundoTarea,
        target: { tipo: 'estudiante', cursoId, uid },
        fechaInicio: ahora,
        deadline: ahora + 7 * DIA_MS,
        createdByUid: profeUid,
        createdAt: ahora,
      });
      showMessage(t('ficha.tareaCreada', { nombre: nombreVisible }), undefined, 'success');
      setMundoTarea(null);
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setAsignando(false);
    }
  };

  const texto = (s: string, estilo: object = st.sub) => (
    <Text style={[estilo, { color: colors.text.secondary }]}>{s}</Text>
  );

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras={`/(staff)/curso/${cursoId}`}
          sobretitulo={datos?.cursoNombre || t('ficha.sobre')}
          titulo={nombreVisible || t('ficha.titulo')}
          subtitulo={
            ficha?.ultimaActividad
              ? t('ficha.ultimaActividad', { fecha: fecha(ficha.ultimaActividad) })
              : ficha
                ? t('ficha.sinActividad')
                : null
          }
        />

        {estado === 'cargando' ? <Esqueleto filas={4} alto={88} /> : null}
        {estado === 'error' ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('profe.errorTitulo')}
            texto={t('ficha.error')}
            accion={
              <BotonChunky
                texto={t('ficha.reintentar')}
                icono="refresh"
                onPress={() => void cargar()}
              />
            }
          />
        ) : null}

        {estado === 'listo' && ficha ? (
          <FadeIn>
            <View style={st.vista}>
              {datos?.estudiante?.estado === 'pendiente_atestacion' ? (
                <Aviso icono="time-outline" tono="naranja" texto={t('ficha.pendiente')} />
              ) : null}
              {!completa ? (
                <TarjetaBloqueada
                  titulo={t('ficha.historialTitulo')}
                  valor={t('ficha.historialValor')}
                  motivo="fichaCompleta"
                  icono="time"
                />
              ) : null}

              {/* ── Resumen ─────────────────────────────────────────── */}
              <View style={st.cifras}>
                <View style={st.cifra}>
                  <Cifra
                    icono="ribbon"
                    valor={
                      ficha.nota == null
                        ? '—'
                        : `${ficha.nota.toFixed(1).replace('.', ',')} · ${ETIQUETA_DESEMPENO[ficha.desempeno ?? 'bajo']}`
                    }
                    etiqueta={t('ficha.nota')}
                    tono={ficha.nota == null ? 'neutro' : ficha.nota >= 3 ? 'verde' : 'rojo'}
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="checkmark-done"
                    valor={ficha.acierto == null ? '—' : `${pct(ficha.acierto)} %`}
                    etiqueta={t('ficha.aciertos', { count: ficha.respuestas })}
                    tono={ficha.acierto == null ? 'neutro' : tonoNivel(pct(ficha.acierto) ?? 0)}
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="calendar"
                    valor={`${ficha.diasActivosSemana}/7`}
                    etiqueta={t('ficha.diasActivos')}
                    tono="azul"
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="time"
                    valor={`${ficha.minutosSemana} min`}
                    etiqueta={t('ficha.minutosSemana', { total: ficha.minutosTotal })}
                    tono="azul"
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="enter"
                    valor={String(ficha.visitasSemana)}
                    etiqueta={t('ficha.visitas', { total: ficha.visitasTotal })}
                    tono="morado"
                  />
                </View>
                <View style={st.cifra}>
                  <Cifra
                    icono="flame"
                    valor={ficha.orbita ? String(ficha.orbita.racha) : '—'}
                    etiqueta={
                      ficha.orbita
                        ? t('ficha.racha', {
                            xp: ficha.orbita.xpTotal,
                            mejor: ficha.orbita.mejorRacha,
                          })
                        : t('ficha.rachaSinDatos')
                    }
                    tono="naranja"
                  />
                </View>
              </View>

              {ficha.comparacion.estudiante != null && ficha.comparacion.clase != null ? (
                <Aviso
                  icono="people"
                  tono={
                    ficha.comparacion.estudiante >= ficha.comparacion.clase ? 'verde' : 'naranja'
                  }
                  texto={t('ficha.comparacion', {
                    estudiante: pct(ficha.comparacion.estudiante),
                    clase: pct(ficha.comparacion.clase),
                  })}
                />
              ) : null}

              {/* ── Competencias ───────────────────────────────────── */}
              <Seccion texto={t('ficha.competencias')} />
              {ficha.porCompetencia.length === 0 ? (
                texto(t('ficha.sinRespuestas'))
              ) : (
                <Tarjeta style={st.tarjeta}>
                  {ficha.porCompetencia.map((c) => {
                    const p = pct(c.acierto) ?? 0;
                    return (
                      <View key={c.id} style={st.barra}>
                        <View style={st.barraCabeza}>
                          <Text
                            style={[st.barraNombre, { color: colors.text.primary }]}
                            numberOfLines={1}
                          >
                            {c.id === 'personalizada'
                              ? t('ficha.mundosPropios')
                              : competenciaLabel(c.id)}
                          </Text>
                          <Text style={[st.valor, { color: colors.text.primary }]}>{p} %</Text>
                        </View>
                        <GrowBar
                          pct={p}
                          color={paletaTono(colors, tonoNivel(p)).tinta}
                          trackColor={colors.materials.highlight}
                          height={8}
                        />
                        {texto(t('ficha.respuestasN', { count: c.respuestas }), st.mini)}
                      </View>
                    );
                  })}
                  {ficha.fuertes.length > 0 || ficha.debiles.length > 0 ? (
                    <View style={st.chips}>
                      {ficha.fuertes.map((id) => (
                        <Pill
                          key={`f-${id}`}
                          icono="thumbs-up"
                          tono="verde"
                          texto={t('ficha.vaBien', {
                            tema:
                              id === 'personalizada'
                                ? t('ficha.mundosPropios')
                                : competenciaLabel(id),
                          })}
                        />
                      ))}
                      {ficha.debiles.map((id) => (
                        <Pill
                          key={`d-${id}`}
                          icono="alert-circle"
                          tono="rojo"
                          texto={t('ficha.reforzar', {
                            tema:
                              id === 'personalizada'
                                ? t('ficha.mundosPropios')
                                : competenciaLabel(id),
                          })}
                        />
                      ))}
                    </View>
                  ) : null}
                </Tarjeta>
              )}

              {/* ── Preguntas que más falla ────────────────────────── */}
              <Seccion texto={t('ficha.preguntasQueFalla')} />
              {ficha.preguntasQueFalla.length === 0 ? (
                texto(ficha.respuestas > 0 ? t('ficha.sinFallas') : t('ficha.sinRespuestas'))
              ) : (
                <Tarjeta style={[st.tarjeta, { gap: 0, paddingVertical: 4 }]}>
                  {ficha.preguntasQueFalla.map((p, i) => (
                    <View
                      key={p.id}
                      style={[
                        st.pregunta,
                        i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                      ]}
                    >
                      <View style={st.barraCabeza}>
                        <Text style={[st.preguntaTexto, { color: colors.text.primary }]}>
                          {p.enunciado}
                        </Text>
                        <Pill tono="rojo" texto={`${p.aciertos}/${p.vistas}`} />
                      </View>
                      {texto(p.mundo, st.mini)}
                      {p.ultimaErrada
                        ? texto(t('ficha.respondio', { respuesta: p.ultimaErrada }))
                        : null}
                    </View>
                  ))}
                </Tarjeta>
              )}

              {/* ── Semana a semana ───────────────────────────────── */}
              <Seccion texto={t('ficha.semanas')} />
              <Tarjeta style={st.tarjeta}>
                <View style={st.columnas} accessibilityLabel={t('ficha.semanasA11y')}>
                  {ficha.semanas.map((s) => {
                    const p = pct(s.acierto);
                    return (
                      <View key={s.inicio} style={st.columna}>
                        <Text style={[st.columnaValor, { color: colors.text.secondary }]}>
                          {p == null ? '' : `${p}`}
                        </Text>
                        <View
                          style={[st.columnaPista, { backgroundColor: colors.materials.highlight }]}
                        >
                          <View
                            style={{
                              height: `${p ?? 0}%`,
                              borderRadius: 6,
                              backgroundColor:
                                p == null ? 'transparent' : paletaTono(colors, tonoNivel(p)).tinta,
                            }}
                          />
                        </View>
                        <Text style={[st.columnaFecha, { color: colors.text.tertiary }]}>
                          {new Date(s.inicio).getDate()}/{new Date(s.inicio).getMonth() + 1}
                        </Text>
                      </View>
                    );
                  })}
                </View>
                {texto(t('ficha.semanasAyuda'), st.mini)}
              </Tarjeta>

              {/* ── Mundos ─────────────────────────────────────────── */}
              <Seccion texto={t('ficha.mundos')} />
              <Tarjeta style={[st.tarjeta, { gap: 0, paddingVertical: 4 }]}>
                {ficha.mundos.map((m, i) => (
                  <View
                    key={m.id}
                    style={[
                      st.mundo,
                      i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                    ]}
                  >
                    <View style={st.barraCabeza}>
                      <Text
                        style={[st.barraNombre, { color: colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {m.nombre}
                      </Text>
                      <Pill
                        tono={TONO_MUNDO[m.estado]}
                        texto={t(`ficha.estadoMundo.${m.estado}`)}
                      />
                    </View>
                    {m.estado === 'sin_empezar'
                      ? null
                      : texto(
                          [
                            m.primerIntentoAt
                              ? t('ficha.empezo', { fecha: fecha(m.primerIntentoAt) })
                              : null,
                            m.conquistadoAt
                              ? t('ficha.conquisto', { fecha: fecha(m.conquistadoAt) })
                              : null,
                            m.lecciones > 0 ? t('ficha.lecciones', { count: m.lecciones }) : null,
                            m.respuestas === 0 ? t('ficha.sinDetalle') : null,
                            m.jefesIntentados > 0
                              ? t('ficha.jefe', {
                                  ganados: m.jefesGanados,
                                  intentos: m.jefesIntentados,
                                })
                              : null,
                            m.acierto == null
                              ? null
                              : t('ficha.aciertoMundo', { pct: pct(m.acierto) }),
                          ]
                            .filter(Boolean)
                            .join(' · '),
                          st.mini
                        )}
                  </View>
                ))}
              </Tarjeta>

              {/* ── Acciones ───────────────────────────────────────── */}
              <Seccion texto={t('ficha.acciones')} />
              <Tarjeta style={st.tarjeta}>
                {pendientes.length === 0 ? (
                  texto(t('ficha.todoConquistado'))
                ) : (
                  <>
                    {texto(t('ficha.asignarAyuda'))}
                    <View style={st.chips}>
                      {pendientes.map((m) => (
                        <Chip
                          key={m.id}
                          texto={m.nombre}
                          icono="planet"
                          seleccionado={mundoTarea === m.id}
                          onPress={() => setMundoTarea(m.id)}
                        />
                      ))}
                    </View>
                    <BotonChunky
                      texto={t('ficha.asignar')}
                      icono="paper-plane"
                      cargando={asignando}
                      deshabilitado={!mundoTarea}
                      onPress={() => void asignar()}
                    />
                  </>
                )}
                <BotonChunky
                  texto={t('ficha.verNotas')}
                  icono="document-text-outline"
                  variante="secundario"
                  onPress={() => router.push(`/(staff)/notas/${cursoId}` as Href)}
                />
              </Tarjeta>
            </View>
          </FadeIn>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  vista: { gap: 14 },
  cifras: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  cifra: { flexBasis: '47%', flexGrow: 1 },
  tarjeta: { gap: 12 },
  barra: { gap: 6 },
  barraCabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barraNombre: { flex: 1, fontSize: 15, fontWeight: '800' },
  valor: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  mini: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pregunta: { gap: 4, paddingVertical: 12 },
  preguntaTexto: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  columnas: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 150 },
  columna: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  columnaValor: { fontSize: 11, fontWeight: '800', fontVariant: ['tabular-nums'] },
  columnaPista: {
    width: '70%',
    flex: 1,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  columnaFecha: { fontSize: 10, fontWeight: '700' },
  mundo: { gap: 4, paddingVertical: 12 },
});
