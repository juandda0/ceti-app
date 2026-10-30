/**
 * Notas del periodo (Decreto 1290): "Ceti hace el papeleo". Por estudiante, la
 * nota de 1,0 a 5,0 con su desempeño, los mundos completados y una observación,
 * listas para la plataforma del colegio en CSV. Herramienta de Piloto: en
 * Cadete solo se muestra el adelanto, sin cargar ni mostrar datos de la clase.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { showMessage } from '@shared/lib/dialogs';
import { downloadTextFile } from '@shared/lib/export/downloadFile';
import { ALL_COMPETENCIAS, competenciaLabel } from '@features/learning/data/competencias';
import {
  construirNotas,
  notasCsv,
  ETIQUETA_DESEMPENO,
  type Periodo,
  type FilaNota,
  type Desempeno,
  periodoActualDe,
  periodosDelAnio,
} from '@/functions/src/educadores/dominio';
import { useEvaluacion } from '@features/educadores/entidad/hooks/useEvaluacion';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import { cargarCursoDetalle, type CursoDetalle } from '../data/cursoDetalle';
import { entradasNotaDesdeReporte } from '../data/notasEntradas';
import TarjetaBloqueada from '../components/TarjetaBloqueada';
import {
  Aviso,
  Avatar,
  BotonChunky,
  Chip,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  tapsConTeclado,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import { useNombreCurso } from '@features/dashboard/hooks/useNombreCurso';

/** Orden del resumen: de mayor a menor desempeño, y al final quienes no tienen datos. */
const ORDEN_RESUMEN: Desempeno[] = ['superior', 'alto', 'basico', 'bajo'];

const TONO_DESEMPENO: Record<Desempeno, Tono> = {
  superior: 'verde',
  alto: 'verde',
  basico: 'naranja',
  bajo: 'rojo',
};

const COMPETENCIAS_CSV = ALL_COMPETENCIAS.map((c) => ({ id: c.id, etiqueta: c.label }));

/** Nota con coma decimal y un decimal (4,3), como en el boletín. */
function formatoNota(nota: number): string {
  return nota.toFixed(1).replace('.', ',');
}

/** 'Grado 9°A' → 'grado-9a' para el nombre del archivo. */
function slug(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'curso'
  );
}

export default function NotasScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId;
  const cursoNombre = useNombreCurso(cursoId, params.nombre);
  const { puede, cargando: cargandoPlan } = useMiPlan();
  const habilitado = !cargandoPlan && puede('notasPeriodo');

  // Periodos del año del periodo en curso (en enero, el del año anterior): los
  // de la entidad (SIEE o semestres, Fase 6) o los 4 del calendario A.
  const evaluacion = useEvaluacion();
  const { config: configEvaluacion, escala } = evaluacion;
  const { periodos, actual } = useMemo(() => {
    const p = periodoActualDe(configEvaluacion, Date.now());
    return { periodos: periodosDelAnio(configEvaluacion, Number(p.desde.slice(0, 4))), actual: p };
  }, [configEvaluacion]);
  const [numero, setNumero] = useState(actual.numero);
  useEffect(() => {
    if (!evaluacion.cargando) setNumero(actual.numero);
  }, [evaluacion.cargando, actual.numero]);
  const periodo: Periodo = periodos.find((p) => p.numero === numero) ?? actual;

  const [detalle, setDetalle] = useState<CursoDetalle | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  // Una sola carga por clase; el cambio de periodo solo recalcula.
  useEffect(() => {
    if (!habilitado) return;
    let cancelled = false;
    if (!colegioId || !cursoId) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    void cargarCursoDetalle(colegioId, cursoId, cursoNombre, Date.now())
      .then((d) => {
        if (!cancelled) {
          setDetalle(d);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [habilitado, colegioId, cursoId, cursoNombre]);

  const filas: FilaNota[] = useMemo(
    () =>
      detalle
        ? construirNotas(
            entradasNotaDesdeReporte(detalle.report.students, detalle.progreso, periodo),
            {
              escala,
              etiquetaCompetencia: competenciaLabel,
            }
          )
        : [],
    [detalle, periodo, escala]
  );

  const resumen = useMemo(() => {
    const cuenta: Record<Desempeno, number> = { superior: 0, alto: 0, basico: 0, bajo: 0 };
    let sinEvaluar = 0;
    for (const f of filas) {
      if (f.desempeno === null) sinEvaluar += 1;
      else cuenta[f.desempeno] += 1;
    }
    return { cuenta, sinEvaluar };
  }, [filas]);

  const nadieConDatos = filas.length > 0 && resumen.sinEvaluar === filas.length;

  const meses = t('educadores.notas.meses').split(',');
  const fecha = (iso: string) =>
    `${Number(iso.slice(8, 10))} ${meses[Number(iso.slice(5, 7)) - 1] ?? iso.slice(5, 7)}`;

  const onDescargar = useCallback(() => {
    if (filas.length === 0) return;
    // BOM: Excel en español abre bien las tildes.
    const csv = '﻿' + notasCsv(filas, COMPETENCIAS_CSV, periodo.numero);
    const ok = downloadTextFile(`notas-${slug(cursoNombre)}-p${periodo.numero}.csv`, csv);
    if (!ok) showMessage(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'), 'error');
  }, [filas, periodo.numero, cursoNombre, t]);

  const adelanto = (
    <View style={styles.bloque}>
      <Text style={[styles.intro, { color: colors.text.secondary }]}>
        {t('educadores.notas.adelantoIntro')}
      </Text>
      <TarjetaBloqueada
        titulo={t('educadores.notas.titulo')}
        valor={t('educadores.notas.adelantoValor')}
        motivo="notasPeriodo"
        icono="document-text"
      />
    </View>
  );

  const selector = (
    <View style={styles.bloque}>
      <Seccion texto={t('educadores.notas.periodoSeccion')} />
      <View style={styles.chips}>
        {periodos.map((p) => (
          <Chip
            key={p.numero}
            texto={p.nombre || t('educadores.notas.periodo', { numero: p.numero })}
            seleccionado={p.numero === periodo.numero}
            onPress={() => setNumero(p.numero)}
          />
        ))}
      </View>
      <Text style={[styles.rango, { color: colors.text.tertiary }]}>
        {t('educadores.notas.rango', { desde: fecha(periodo.desde), hasta: fecha(periodo.hasta) })}
      </Text>
    </View>
  );

  const contenido =
    filas.length === 0 ? (
      <Vacio
        icono="people-outline"
        titulo={t('educadores.notas.vacioTitulo')}
        texto={t('educadores.notas.vacioTexto')}
      />
    ) : (
      <View style={styles.bloque}>
        {nadieConDatos ? (
          <Aviso icono="moon-outline" tono="naranja" texto={t('educadores.notas.sinDatos')} />
        ) : null}

        <Seccion texto={t('educadores.notas.resumenSeccion')} />
        <View style={styles.chips}>
          {ORDEN_RESUMEN.map((d) => (
            <Pill
              key={d}
              texto={t('educadores.notas.resumenItem', {
                desempeno: ETIQUETA_DESEMPENO[d],
                count: resumen.cuenta[d],
              })}
              tono={TONO_DESEMPENO[d]}
            />
          ))}
          <Pill
            texto={t('educadores.notas.resumenItem', {
              desempeno: t('educadores.notas.sinEvaluar'),
              count: resumen.sinEvaluar,
            })}
            tono="neutro"
          />
        </View>

        <BotonChunky
          texto={t('educadores.notas.descargar')}
          icono="download-outline"
          onPress={onDescargar}
        />

        <Seccion
          texto={t('educadores.notas.estudiantesSeccion')}
          derecha={
            <Text style={[styles.cuenta, { color: colors.text.tertiary }]}>
              {t('educadores.notas.estudiantes', { count: filas.length })}
            </Text>
          }
        />
        <Tarjeta style={styles.lista}>
          {filas.map((f, i) => (
            <View
              key={`${f.nombre}-${i}`}
              style={[
                styles.fila,
                i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
              ]}
            >
              <View style={styles.filaCabeza}>
                <Avatar nombre={f.nombre} />
                <View style={styles.filaTexto}>
                  <Text style={[styles.nombre, { color: colors.text.primary }]} numberOfLines={1}>
                    {f.nombre}
                  </Text>
                  <Text style={[styles.sub, { color: colors.text.tertiary }]} numberOfLines={1}>
                    {t('educadores.notas.mundos', { count: f.mundosCompletados })}
                  </Text>
                </View>
                <View style={styles.notaCaja}>
                  {f.nota === null ? (
                    <Text style={[styles.sinNota, { color: colors.text.tertiary }]}>
                      {t('educadores.notas.sinEvaluar')}
                    </Text>
                  ) : (
                    <>
                      <Text
                        style={[styles.nota, { color: colors.text.primary }]}
                        accessibilityLabel={t('educadores.notas.notaA11y', {
                          nota: formatoNota(f.nota),
                        })}
                      >
                        {formatoNota(f.nota)}
                      </Text>
                      {f.desempeno ? (
                        <Pill
                          texto={ETIQUETA_DESEMPENO[f.desempeno]}
                          tono={TONO_DESEMPENO[f.desempeno]}
                          style={styles.pillNota}
                        />
                      ) : null}
                    </>
                  )}
                </View>
              </View>
              <Text style={[styles.observacion, { color: colors.text.secondary }]}>
                {f.observacion}
              </Text>
            </View>
          ))}
        </Tarjeta>

        <Aviso
          icono="information-circle"
          tono="azul"
          texto={
            configEvaluacion
              ? t('educadores.notas.escalaEntidad', {
                  min: escala.notaMin.toFixed(1).replace('.', ','),
                  max: escala.notaMax.toFixed(1).replace('.', ','),
                })
              : t('educadores.notas.escalaAviso')
          }
        />
      </View>
    );

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps={tapsConTeclado}
      >
        <Encabezado
          atras={`/(staff)/curso/${cursoId}?nombre=${encodeURIComponent(cursoNombre)}`}
          sobretitulo={t('educadores.notas.sobretitulo')}
          titulo={t('educadores.notas.titulo')}
          subtitulo={cursoNombre}
        />

        {cargandoPlan ? <Esqueleto filas={3} alto={96} /> : null}

        {!cargandoPlan && !habilitado ? adelanto : null}

        {habilitado ? (
          <>
            {selector}
            {status === 'loading' ? <Esqueleto filas={4} alto={88} /> : null}
            {status === 'error' ? (
              <Vacio
                icono="cloud-offline-outline"
                tono="rojo"
                titulo={t('profe.errorTitulo')}
                texto={t('educadores.notas.error')}
              />
            ) : null}
            {status === 'ready' ? contenido : null}
          </>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  bloque: { gap: 14 },
  intro: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rango: { fontSize: 13, fontWeight: '700', marginTop: -4 },
  cuenta: { fontSize: 13, fontWeight: '800' },
  lista: { gap: 0, paddingVertical: 4 },
  fila: { paddingVertical: 12, gap: 8 },
  filaCabeza: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filaTexto: { flex: 1, gap: 2 },
  nombre: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, fontWeight: '600' },
  notaCaja: { alignItems: 'flex-end', gap: 4 },
  nota: { fontSize: 22, lineHeight: 26, fontWeight: '900' },
  pillNota: { alignSelf: 'flex-end' },
  sinNota: { fontSize: 13, fontWeight: '800' },
  observacion: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
});
