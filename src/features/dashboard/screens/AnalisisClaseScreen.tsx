/**
 * Análisis de la clase (Fase 3). Se abre desde el tablero de la clase. Cuatro
 * vistas: Mapa (estudiantes × mundos), Preguntas (facilidad, discriminación y
 * respuesta errada más elegida), Actividad (semana a semana y quién no entra)
 * y Tareas (a tiempo, tarde, sin hacer). Se filtra por periodo y se exporta a
 * Excel o PDF. Herramienta de Piloto en adelante; Cadete ve el adelanto.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import Bounceable from '@shared/components/Bounceable';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { construirXlsx } from '@shared/lib/export/xlsx';
import { MIME_XLSX, compartirPdf, guardarArchivo } from '@shared/lib/export/guardarArchivo';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import TarjetaBloqueada from '@features/educadores/retencion/components/TarjetaBloqueada';
import Segmented from '@features/savings/components/Segmented';
import { FadeIn, GrowBar } from '@features/savings/charts/ChartParts';
import {
  fechaBogota,
  inicioDiaBogota,
  periodoActual,
  periodoActualDe,
  periodosDelAnio,
} from '@/functions/src/educadores/dominio';
import { useEvaluacion, type Evaluacion } from '@features/educadores/entidad/hooks/useEvaluacion';
import {
  cargarAnalisisClase,
  type AnalisisCargado,
} from '@features/dashboard/data/cargarAnalisisClase';
import { hojasDelAnalisis, informeHtml } from '@features/dashboard/data/exportarAnalisis';
import { materialDeRepaso, type CeldaMapa } from '@features/dashboard/data/analisisClase';
import AccionGrupo from '@features/dashboard/components/AccionGrupo';
import { gruposRepository } from '@features/educadores/grupos/data/gruposRepository';
import type { Grupo } from '@/functions/src/educadores/dominio';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';
import {
  Aviso,
  BotonChunky,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  tonoNivel,
} from '@features/dashboard/components/profe/kit';

type Vista = 'mapa' | 'preguntas' | 'actividad' | 'tareas';
const DIA_MS = 24 * 60 * 60 * 1000;
const ANCHO_NOMBRE = 128;
const ANCHO_CELDA = 64;

const pct = (v: number | null) => (v == null ? null : Math.round(v * 100));
const fecha = (t: number | null) =>
  t == null ? '—' : new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

interface OpcionPeriodo {
  clave: string;
  etiqueta: string;
  desde: number;
  hasta: number;
}

/**
 * Los periodos del año en curso y "todo el año". Con entidad, los de su SIEE o
 * su calendario semestral (Fase 6); si no, los 4 del calendario A.
 */
function periodos(ahora: number, t: TFunction, periodosDe: Evaluacion['periodosDe']): OpcionPeriodo[] {
  const anio = Number(fechaBogota(ahora).slice(0, 4));
  const lista = periodosDe(anio).map((p) => ({
    clave: `p${p.numero}`,
    etiqueta: p.nombre || t('analisis.periodoN', { n: p.numero }),
    desde: inicioDiaBogota(p.desde),
    hasta: inicioDiaBogota(p.hasta) + DIA_MS - 1,
  }));
  return [
    ...lista,
    {
      clave: 'anio',
      etiqueta: t('analisis.todoElAnio'),
      desde: inicioDiaBogota(`${anio}-01-01`),
      hasta: ahora,
    },
  ];
}

export default function AnalisisClaseScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colegioId = useAuthStore((s) => s.colegioId);
  const { cursoId } = useLocalSearchParams<{ cursoId: string }>();
  const nombreCurso = useNombreCurso(cursoId, undefined);
  const { puede, cargando: planCargando } = useMiPlan();
  const conAnalisis = !planCargando && puede('analisisClase');
  const conExportar = !planCargando && puede('exportarCsv');

  const ahora = useMemo(() => Date.now(), []);
  const evaluacion = useEvaluacion();
  const { config: configEvaluacion, escala } = evaluacion;
  const opciones = useMemo(
    () => periodos(ahora, t, (anio) => periodosDelAnio(configEvaluacion, anio)),
    [ahora, t, configEvaluacion]
  );
  const [periodo, setPeriodo] = useState(() => `p${periodoActual(ahora).numero}`);
  // La escala de la entidad llega después del primer render: el periodo en curso es el suyo.
  useEffect(() => {
    if (!evaluacion.cargando) setPeriodo(`p${periodoActualDe(configEvaluacion, ahora).numero}`);
  }, [evaluacion.cargando, configEvaluacion, ahora]);
  const elegido = opciones.find((o) => o.clave === periodo) ?? opciones[opciones.length - 1];

  // Fase 8: filtrar por un grupo de la clase.
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  useEffect(() => {
    if (!colegioId || !cursoId) return;
    void gruposRepository
      .get(colegioId, cursoId)
      .then(setGrupos)
      .catch(() => setGrupos([]));
  }, [colegioId, cursoId]);
  const soloUids = grupos.find((g) => g.id === grupoId)?.uids ?? null;

  const [vista, setVista] = useState<Vista>('mapa');
  const [datos, setDatos] = useState<AnalisisCargado | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [exportando, setExportando] = useState<'xlsx' | 'pdf' | null>(null);

  const cargar = useCallback(async () => {
    if (!colegioId || !cursoId || !conAnalisis) return;
    setEstado('cargando');
    try {
      setDatos(
        await cargarAnalisisClase(colegioId, cursoId, {
          desde: elegido.desde,
          hasta: elegido.hasta,
          ahora,
          escala,
          soloUids,
        })
      );
      setEstado('listo');
    } catch {
      setEstado('error');
    }
  }, [colegioId, cursoId, conAnalisis, elegido.desde, elegido.hasta, ahora, escala, soloUids]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const vistas = useMemo(
    () =>
      (['mapa', 'preguntas', 'actividad', 'tareas'] as const).map((k) => ({
        key: k,
        label: t(`analisis.vista_${k}`),
      })),
    [t]
  );

  const a = datos?.analisis;
  const repaso = a ? materialDeRepaso(a.preguntas) : null;
  const nombreArchivo = `${(datos?.cursoNombre || 'clase').replace(/[^\p{L}\p{N}]+/gu, '-')}-${elegido.clave}`;

  const exportarXlsx = async () => {
    if (!a || !datos) return;
    setExportando('xlsx');
    const ok = await guardarArchivo(
      `${nombreArchivo}.xlsx`,
      construirXlsx(hojasDelAnalisis(a, datos.mundos, escala)),
      MIME_XLSX
    );
    setExportando(null);
    if (!ok) showMessage(t('analisis.exportarError'), undefined, 'error');
  };
  const exportarPdf = async () => {
    if (!a || !datos) return;
    setExportando('pdf');
    const ok = await compartirPdf(
      `${nombreArchivo}.pdf`,
      informeHtml(a, datos.mundos, {
        curso: datos.cursoNombre,
        periodo: elegido.etiqueta,
        generado: Date.now(),
      })
    );
    setExportando(null);
    if (!ok) showMessage(t('analisis.exportarError'), undefined, 'error');
  };

  const abrirFicha = (uid: string, nombre: string) =>
    router.push(
      `/(staff)/estudiante/${cursoId}/${uid}?nombre=${encodeURIComponent(nombre)}` as Href
    );

  const colorCelda = (c: CeldaMapa | undefined) => {
    if (!c || c.estado === 'sin_empezar')
      return { fondo: colors.materials.highlight, tinta: colors.text.quaternary };
    const p = pct(c.acierto);
    if (c.estado === 'conquistado' && (p == null || p >= 80)) return paletaTono(colors, 'verde');
    return paletaTono(colors, tonoNivel(p ?? 50));
  };

  // ── Vistas ──────────────────────────────────────────────────────────────
  const mapa =
    a && datos ? (
      <View style={st.vista}>
        <Aviso icono="grid" tono="azul" texto={t('analisis.mapaAyuda')} />
        <Tarjeta style={{ padding: 0, overflow: 'hidden' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View>
              <View
                style={[
                  st.filaMapa,
                  { borderBottomWidth: 1, borderBottomColor: colors.materials.border },
                ]}
              >
                <View style={{ width: ANCHO_NOMBRE }} />
                {datos.mundos.map((m) => (
                  <Text
                    key={m.id}
                    style={[st.cabeceraMapa, { color: colors.text.secondary }]}
                    numberOfLines={2}
                  >
                    {m.nombre}
                  </Text>
                ))}
                <Text style={[st.cabeceraMapa, { color: colors.text.secondary }]}>
                  {t('analisis.nota')}
                </Text>
              </View>
              {a.mapa.map((f) => (
                <View key={f.uid} style={st.filaMapa}>
                  <Bounceable
                    onPress={() => abrirFicha(f.uid, f.nombre)}
                    accessibilityRole="button"
                    accessibilityLabel={t('ficha.abrir', { nombre: f.nombre })}
                    style={{ width: ANCHO_NOMBRE, paddingHorizontal: 10 }}
                  >
                    <Text style={[st.nombreMapa, { color: colors.text.primary }]} numberOfLines={1}>
                      {f.nombre}
                    </Text>
                  </Bounceable>
                  {datos.mundos.map((m) => {
                    const c = f.celdas[m.id];
                    const { fondo, tinta } = colorCelda(c);
                    const p = pct(c?.acierto ?? null);
                    return (
                      <View
                        key={m.id}
                        style={[st.celda, { backgroundColor: fondo }]}
                        accessibilityLabel={`${f.nombre}, ${m.nombre}: ${t(`ficha.estadoMundo.${c?.estado ?? 'sin_empezar'}`)}${p == null ? '' : `, ${p} %`}`}
                      >
                        <Text style={[st.celdaTexto, { color: tinta }]}>
                          {c?.estado === 'conquistado' ? '✓' : ''}
                          {p == null ? (c?.estado === 'sin_empezar' ? '·' : '') : ` ${p}`}
                        </Text>
                      </View>
                    );
                  })}
                  <View style={st.celda}>
                    <Text
                      style={[
                        st.celdaTexto,
                        {
                          color:
                            f.nota != null && f.nota < 3 ? colors.system.red : colors.text.primary,
                        },
                      ]}
                    >
                      {f.nota == null ? '—' : f.nota.toFixed(1).replace('.', ',')}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </Tarjeta>
        {colegioId && cursoId ? (
          <AccionGrupo
            colegioId={colegioId}
            cursoId={cursoId}
            titulo={t('analisis.grupoBajoTres')}
            estudiantes={a.mapa.filter((f) => a.grupos.bajoTres.includes(f.uid))}
            mundos={datos.mundos}
          />
        ) : null}
      </View>
    ) : null;

  const preguntas = a ? (
    <View style={st.vista}>
      <Aviso icono="help-circle" tono="azul" texto={t('analisis.preguntasAyuda')} />
      {repaso ? (
        <BotonChunky
          texto={t('analisis.crearRepaso')}
          icono="sparkles"
          onPress={() =>
            router.push(
              `/(staff)/crear-mundo/${cursoId}?nombre=${encodeURIComponent(repaso.nombre)}&tema=${encodeURIComponent(repaso.tema)}&fuente=${encodeURIComponent(repaso.fuente)}` as Href
            )
          }
        />
      ) : null}
      {a.preguntas.length === 0 ? (
        <Text style={[st.sub, { color: colors.text.secondary }]}>
          {t('analisis.sinRespuestas')}
        </Text>
      ) : (
        a.preguntas.map((p) => {
          const f = pct(p.facilidad) ?? 0;
          return (
            <Tarjeta key={p.id} style={st.tarjeta}>
              <Text style={[st.pregunta, { color: colors.text.primary }]}>{p.enunciado}</Text>
              <Text style={[st.mini, { color: colors.text.tertiary }]}>
                {p.mundo} ·{' '}
                {t('analisis.respondieron', { count: p.estudiantes, respuestas: p.respuestas })}
              </Text>
              <View style={st.barraCabeza}>
                <View style={{ flex: 1 }}>
                  <GrowBar
                    pct={f}
                    color={paletaTono(colors, tonoNivel(f)).tinta}
                    trackColor={colors.materials.highlight}
                    height={8}
                  />
                </View>
                <Text style={[st.valor, { color: colors.text.primary }]}>{f} %</Text>
              </View>
              <View style={st.chips}>
                {p.dificil ? (
                  <Pill tono="rojo" icono="alert-circle" texto={t('analisis.dificil')} />
                ) : null}
                {p.revisar ? (
                  <Pill tono="morado" icono="construct" texto={t('analisis.revisar')} />
                ) : null}
                {p.discriminacion != null ? (
                  <Pill
                    tono="neutro"
                    texto={t('analisis.discriminacion', {
                      d: p.discriminacion.toFixed(2).replace('.', ','),
                    })}
                  />
                ) : null}
              </View>
              {p.erradaMasElegida ? (
                <Text style={[st.sub, { color: colors.text.secondary }]}>
                  {t('analisis.errada', {
                    count: p.erradaMasElegida.veces,
                    texto: p.erradaMasElegida.texto,
                  })}
                </Text>
              ) : null}
              {p.revisar || p.dificil ? (
                <View style={{ alignSelf: 'flex-start' }}>
                  <Chip
                    texto={t('analisis.editarPregunta')}
                    icono="create-outline"
                    seleccionado={false}
                    onPress={() =>
                      router.push(`/(staff)/contenido/${cursoId}/${p.worldId}` as Href)
                    }
                  />
                </View>
              ) : null}
            </Tarjeta>
          );
        })
      )}
    </View>
  ) : null;

  const maxActivos = Math.max(1, a?.mapa.length ?? 1);
  const actividad =
    a && datos ? (
      <View style={st.vista}>
        <Aviso
          icono="pulse"
          tono="azul"
          texto={t('analisis.activosSemana', { activos: a.activosSemana, total: a.mapa.length })}
        />
        <Tarjeta style={st.tarjeta}>
          <View style={st.columnas} accessibilityLabel={t('analisis.actividadA11y')}>
            {a.semanas.map((s) => (
              <View key={s.inicio} style={st.columna}>
                <Text style={[st.columnaValor, { color: colors.text.secondary }]}>{s.activos}</Text>
                <View style={[st.columnaPista, { backgroundColor: colors.materials.highlight }]}>
                  <View
                    style={{
                      height: `${(s.activos / maxActivos) * 100}%`,
                      borderRadius: 6,
                      backgroundColor: colors.brand.primary,
                    }}
                  />
                </View>
                <Text style={[st.columnaFecha, { color: colors.text.tertiary }]}>
                  {new Date(s.inicio).getDate()}/{new Date(s.inicio).getMonth() + 1}
                </Text>
              </View>
            ))}
          </View>
          <Text style={[st.mini, { color: colors.text.secondary }]}>
            {t('analisis.actividadAyuda', {
              respuestas: a.semanas[a.semanas.length - 1]?.respuestas ?? 0,
              minutos: a.semanas[a.semanas.length - 1]?.minutos ?? 0,
            })}
          </Text>
        </Tarjeta>
        <Seccion texto={t('analisis.sinEntrar', { count: a.sinEntrar7.length })} />
        {a.sinEntrar7.length === 0 ? (
          <Text style={[st.sub, { color: colors.text.secondary }]}>
            {t('analisis.todosEntraron')}
          </Text>
        ) : (
          <>
            <Tarjeta style={[st.tarjeta, { gap: 0, paddingVertical: 4 }]}>
              {a.sinEntrar7.map((s, i) => (
                <Bounceable
                  key={s.uid}
                  onPress={() => abrirFicha(s.uid, s.nombre)}
                  accessibilityRole="button"
                  style={[
                    st.filaLista,
                    i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                  ]}
                >
                  <Text style={[st.nombreLista, { color: colors.text.primary }]} numberOfLines={1}>
                    {s.nombre}
                  </Text>
                  <Text style={[st.mini, { color: colors.text.tertiary }]}>
                    {s.ultimaActividad
                      ? t('analisis.ultima', { fecha: fecha(s.ultimaActividad) })
                      : t('analisis.nunca')}
                  </Text>
                </Bounceable>
              ))}
            </Tarjeta>
            {colegioId && cursoId ? (
              <AccionGrupo
                colegioId={colegioId}
                cursoId={cursoId}
                titulo={t('analisis.grupoSinEntrar')}
                estudiantes={a.sinEntrar7}
                mundos={datos.mundos}
              />
            ) : null}
          </>
        )}
      </View>
    ) : null;

  const tareas =
    a && datos ? (
      <View style={st.vista}>
        {a.tareas.length === 0 ? (
          <Text style={[st.sub, { color: colors.text.secondary }]}>{t('analisis.sinTareas')}</Text>
        ) : (
          a.tareas.map((tarea) => {
            const total = tarea.aTiempo.length + tarea.tarde.length + tarea.sinHacer.length;
            const ancho = (n: number) => `${total ? (n / total) * 100 : 0}%` as const;
            return (
              <View key={tarea.id} style={st.vista}>
                <Tarjeta style={st.tarjeta}>
                  <View style={st.barraCabeza}>
                    <Text style={[st.pregunta, { color: colors.text.primary, flex: 1 }]}>
                      {t('profe.tareaMundo', { mundo: tarea.mundo })}
                    </Text>
                    <Pill
                      tono={tarea.vencida ? 'rojo' : 'verde'}
                      texto={t('assignments.due', { date: fecha(tarea.deadline) })}
                    />
                  </View>
                  <View style={[st.embudo, { backgroundColor: colors.materials.highlight }]}>
                    <View
                      style={{
                        width: ancho(tarea.aTiempo.length),
                        backgroundColor: paletaTono(colors, 'verde').tinta,
                      }}
                    />
                    <View
                      style={{
                        width: ancho(tarea.tarde.length),
                        backgroundColor: paletaTono(colors, 'naranja').tinta,
                      }}
                    />
                  </View>
                  <View style={st.chips}>
                    <Pill
                      tono="verde"
                      texto={t('analisis.aTiempo', { count: tarea.aTiempo.length })}
                    />
                    <Pill
                      tono="naranja"
                      texto={t('analisis.tarde', { count: tarea.tarde.length })}
                    />
                    <Pill
                      tono="neutro"
                      texto={t('analisis.sinHacer', { count: tarea.sinHacer.length })}
                    />
                  </View>
                </Tarjeta>
                {colegioId && cursoId ? (
                  <AccionGrupo
                    colegioId={colegioId}
                    cursoId={cursoId}
                    titulo={t('analisis.grupoSinHacer', { mundo: tarea.mundo })}
                    estudiantes={tarea.sinHacer}
                    mundos={datos.mundos}
                    mundoSugerido={tarea.worldId}
                  />
                ) : null}
              </View>
            );
          })
        )}
      </View>
    ) : null;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras={`/(staff)/curso/${cursoId}`}
          sobretitulo={t('analisis.sobre')}
          titulo={datos?.cursoNombre || nombreCurso || t('analisis.titulo')}
          subtitulo={t('analisis.subtitulo')}
        />

        {!planCargando && !conAnalisis ? (
          <TarjetaBloqueada
            titulo={t('analisis.bloqueadoTitulo')}
            valor={t('analisis.bloqueadoValor')}
            motivo="analisisClase"
            icono="analytics"
          />
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={st.chips}
            >
              {opciones.map((o) => (
                <Chip
                  key={o.clave}
                  texto={o.etiqueta}
                  icono="calendar-outline"
                  seleccionado={o.clave === periodo}
                  onPress={() => setPeriodo(o.clave)}
                />
              ))}
            </ScrollView>
            {grupos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chips}>
                <Chip
                  texto={t('diferenciales.grupos.todaLaClase')}
                  icono="people-outline"
                  seleccionado={grupoId === null}
                  onPress={() => setGrupoId(null)}
                />
                {grupos.map((g) => (
                  <Chip key={g.id} texto={g.nombre} color={g.color} seleccionado={grupoId === g.id} onPress={() => setGrupoId(g.id)} />
                ))}
              </ScrollView>
            ) : null}

            {conExportar && estado === 'listo' ? (
              <View style={st.exportar}>
                <BotonChunky
                  texto={t('analisis.excel')}
                  icono="grid-outline"
                  variante="secundario"
                  compacto
                  cargando={exportando === 'xlsx'}
                  deshabilitado={exportando !== null}
                  onPress={() => void exportarXlsx()}
                  style={{ flex: 1 }}
                />
                <BotonChunky
                  texto={t('analisis.pdf')}
                  icono="document-outline"
                  variante="secundario"
                  compacto
                  cargando={exportando === 'pdf'}
                  deshabilitado={exportando !== null}
                  onPress={() => void exportarPdf()}
                  style={{ flex: 1 }}
                />
              </View>
            ) : null}

            <Segmented options={vistas} value={vista} onChange={setVista} />

            {estado === 'cargando' ? <Esqueleto filas={4} alto={72} /> : null}
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
            {estado === 'listo' && a ? (
              a.mapa.length === 0 ? (
                <Vacio
                  icono="people-outline"
                  titulo={t('admin.emptyRoster')}
                  texto={t('profe.invitaTexto')}
                />
              ) : (
                <FadeIn key={vista}>
                  {vista === 'mapa'
                    ? mapa
                    : vista === 'preguntas'
                      ? preguntas
                      : vista === 'actividad'
                        ? actividad
                        : tareas}
                </FadeIn>
              )
            ) : null}
          </>
        )}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  vista: { gap: 12 },
  tarjeta: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  exportar: { flexDirection: 'row', gap: 10 },
  sub: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  mini: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  valor: { fontSize: 15, fontWeight: '900', fontVariant: ['tabular-nums'] },
  barraCabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pregunta: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  filaMapa: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  cabeceraMapa: {
    width: ANCHO_CELDA,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
    paddingVertical: 8,
    paddingHorizontal: 2,
  },
  nombreMapa: { fontSize: 14, fontWeight: '800' },
  celda: {
    width: ANCHO_CELDA - 6,
    height: 36,
    margin: 3,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celdaTexto: { fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
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
  filaLista: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 12,
  },
  nombreLista: { flex: 1, fontSize: 15, fontWeight: '800' },
  embudo: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden' },
});
