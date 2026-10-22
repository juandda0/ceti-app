import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  loadCourseReport,
  type CourseReportWithRetos,
} from '@features/dashboard/data/loadCourseReport';
import { courseReportToCsv } from '@features/dashboard/data/courseReport';
import { buildWeaknessReport } from '@features/dashboard/data/weaknessReport';
import { buildEarlyWarning, type RiskFlag } from '@features/dashboard/data/earlyWarning';
import AssignmentsManager from '@features/dashboard/components/AssignmentsManager';
import { showMessage } from '@shared/lib/dialogs';
import { downloadTextFile, printPage } from '@shared/lib/export/downloadFile';
import Segmented from '@features/savings/components/Segmented';
import { ChartCard, FadeIn, GrowBar } from '@features/savings/charts/ChartParts';
import {
  Aviso,
  Avatar,
  BotonChunky,
  Cifra,
  Encabezado,
  Esqueleto,
  Pill,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  tonoNivel,
} from '@features/dashboard/components/profe/kit';

const FLAG_KEY: Record<RiskFlag, string> = {
  no_activity: 'dashboard.flagNoActivity',
  stalled: 'dashboard.flagStalled',
  low_mastery: 'dashboard.flagLowMastery',
};

type Vista = 'resumen' | 'estudiantes' | 'tareas';

function pct(m: number): number {
  return Math.round(m * 100);
}

/**
 * Tablero de una clase: resumen (cifras, alertas y diagnóstico), estudiantes con
 * su dominio, y tareas (asignaciones y retos). Las tres vistas se alternan con el
 * mismo control segmentado de Actividad y Gráficas.
 */
export default function CourseDashboardScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId;
  const cursoNombre = params.nombre ?? cursoId;

  const [report, setReport] = useState<CourseReportWithRetos | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [vista, setVista] = useState<Vista>('resumen');
  const weakness = useMemo(() => (report ? buildWeaknessReport(report) : null), [report]);
  const warning = useMemo(() => (report ? buildEarlyWarning(report, Date.now()) : null), [report]);

  useEffect(() => {
    let cancelled = false;
    if (!colegioId || !cursoId) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    void loadCourseReport(colegioId, cursoId, cursoNombre, Date.now())
      .then((r) => {
        if (!cancelled) {
          setReport(r);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [colegioId, cursoId, cursoNombre]);

  const onExportCsv = useCallback(() => {
    if (!report) return;
    const ok = downloadTextFile(`reporte-${report.cursoId}.csv`, courseReportToCsv(report));
    if (!ok) showMessage(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'), 'error');
  }, [report, t]);

  const onPrint = useCallback(() => {
    if (!printPage())
      showMessage(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'), 'error');
  }, [t]);

  // Promedio del curso entre quienes ya tienen progreso (los demás no cuentan como 0).
  const conDatos =
    report?.students.filter((s) => Object.keys(s.masteryByCompetencia).length > 0) ?? [];
  const promedio =
    conDatos.length > 0
      ? pct(conDatos.reduce((acc, s) => acc + s.overallMastery, 0) / conDatos.length)
      : null;

  const vistas = useMemo(
    () => [
      { key: 'resumen' as const, label: t('profe.vistaResumen') },
      { key: 'estudiantes' as const, label: t('profe.vistaEstudiantes') },
      { key: 'tareas' as const, label: t('profe.vistaTareas') },
    ],
    [t]
  );

  const resumen = report ? (
    <View style={styles.vista}>
      <View style={styles.tiles}>
        <Cifra
          icono="people"
          valor={String(report.students.length)}
          etiqueta={t('profe.statEstudiantes')}
          tono="azul"
        />
        <Cifra
          icono="trending-up"
          valor={promedio === null ? '—' : `${promedio}%`}
          etiqueta={t('profe.statDominio')}
          tono="verde"
        />
        <Cifra
          icono="alert-circle"
          valor={String(warning?.atRisk.length ?? 0)}
          etiqueta={t('profe.statApoyo')}
          tono="naranja"
        />
      </View>

      {report.weakestCompetencia ? (
        <Aviso
          icono="alert-circle"
          tono="naranja"
          texto={t('dashboard.weakest', {
            competencia: report.weakestCompetencia.label,
            pct: `${pct(report.weakestCompetencia.averageMastery)}%`,
          })}
        />
      ) : (
        <Vacio
          icono="sparkles-outline"
          titulo={t('profe.cursoVacioTitulo')}
          texto={t('dashboard.noData')}
        />
      )}

      {warning && warning.atRisk.length > 0 ? (
        <>
          <Seccion texto={t('dashboard.earlyWarningTitle')} />
          <Tarjeta style={{ gap: 14 }}>
            {warning.atRisk.map((r) => (
              <View key={r.uid} style={styles.fila}>
                <Avatar nombre={r.nombre} />
                <View style={styles.filaTexto}>
                  <Text
                    style={[styles.filaNombre, { color: colors.text.primary }]}
                    numberOfLines={1}
                  >
                    {r.nombre}
                  </Text>
                  <Text style={[styles.filaSub, { color: colors.text.tertiary }]} numberOfLines={1}>
                    {r.flags.map((f) => t(FLAG_KEY[f])).join(' · ')}
                  </Text>
                </View>
                <Pill
                  texto={r.level === 'high' ? t('dashboard.riskHigh') : t('dashboard.riskMedium')}
                  tono={r.level === 'high' ? 'rojo' : 'naranja'}
                />
              </View>
            ))}
          </Tarjeta>
        </>
      ) : null}

      {weakness && weakness.hasData ? (
        weakness.weakCompetencias.length === 0 && weakness.studentsAtRisk.length === 0 ? (
          <Aviso icono="checkmark-circle" tono="verde" texto={t('dashboard.allStrong')} />
        ) : (
          <>
            {weakness.weakCompetencias.length > 0 ? (
              <ChartCard
                title={t('dashboard.weakCompetenciesTitle')}
                subtitle={t('profe.reforzarSub')}
              >
                <View style={{ gap: 16 }}>
                  {weakness.weakCompetencias.map((c) => {
                    const p = pct(c.averageMastery);
                    return (
                      <View key={c.competenciaId} style={{ gap: 6 }}>
                        <View style={styles.barraCabeza}>
                          <Text
                            style={[styles.filaNombre, { flex: 1, color: colors.text.primary }]}
                            numberOfLines={2}
                          >
                            {c.label}
                          </Text>
                          <Text style={[styles.valor, { color: colors.text.primary }]}>{p}%</Text>
                        </View>
                        <GrowBar
                          pct={p}
                          color={paletaTono(colors, tonoNivel(p)).tinta}
                          trackColor={colors.materials.highlight}
                          height={10}
                        />
                        <Text style={[styles.filaSub, { color: colors.text.tertiary }]}>
                          {t('dashboard.weakCompetencyBelow', {
                            below: c.studentsBelow,
                            total: c.studentsWithData,
                          })}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ChartCard>
            ) : null}
            {weakness.studentsAtRisk.length > 0 ? (
              <ChartCard title={t('dashboard.atRiskTitle')}>
                <View style={{ gap: 14 }}>
                  {weakness.studentsAtRisk.map((s) => (
                    <View key={s.uid} style={styles.fila}>
                      <Avatar nombre={s.nombre} />
                      <View style={styles.filaTexto}>
                        <Text
                          style={[styles.filaNombre, { color: colors.text.primary }]}
                          numberOfLines={1}
                        >
                          {s.nombre}
                        </Text>
                        {s.weakAreas.length > 0 ? (
                          <Text
                            style={[styles.filaSub, { color: colors.text.tertiary }]}
                            numberOfLines={2}
                          >
                            {t('dashboard.atRiskAreas', {
                              areas: s.weakAreas.map((a) => a.label).join(', '),
                            })}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.valor, { color: colors.system.red }]}>
                        {pct(s.overallMastery)}%
                      </Text>
                    </View>
                  ))}
                </View>
              </ChartCard>
            ) : null}
          </>
        )
      ) : null}

      <View style={styles.exportar}>
        <BotonChunky
          texto={t('dashboard.exportCsv')}
          icono="download-outline"
          variante="secundario"
          compacto
          onPress={onExportCsv}
          style={{ flex: 1 }}
        />
        <BotonChunky
          texto={t('profe.imprimir')}
          icono="print-outline"
          variante="secundario"
          compacto
          onPress={onPrint}
          style={{ flex: 1 }}
        />
      </View>
    </View>
  ) : null;

  const estudiantes = report ? (
    <View style={styles.vista}>
      {report.students.length === 0 ? (
        <Vacio
          icono="people-outline"
          titulo={t('admin.emptyRoster')}
          texto={t('profe.invitaTexto')}
        />
      ) : (
        <Tarjeta style={{ gap: 0, paddingVertical: 4 }}>
          {report.students.map((s, i) => {
            const p = pct(s.overallMastery);
            const sinDatos = Object.keys(s.masteryByCompetencia).length === 0;
            return (
              <View
                key={s.uid}
                style={[
                  styles.estudiante,
                  i > 0 && { borderTopWidth: 1, borderTopColor: colors.materials.border },
                ]}
              >
                <Avatar nombre={s.nombre} />
                <View style={[styles.filaTexto, { gap: 6 }]}>
                  <View style={styles.barraCabeza}>
                    <Text
                      style={[styles.filaNombre, { flex: 1, color: colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {s.nombre}
                    </Text>
                    <Text style={[styles.valor, { color: colors.text.primary }]}>
                      {sinDatos ? '—' : `${p}%`}
                    </Text>
                  </View>
                  <GrowBar
                    pct={sinDatos ? 0 : p}
                    color={paletaTono(colors, tonoNivel(p)).tinta}
                    trackColor={colors.materials.highlight}
                    height={8}
                  />
                  <Text style={[styles.filaSub, { color: colors.text.tertiary }]}>
                    {t(`estados.${s.estado}`)}
                  </Text>
                </View>
              </View>
            );
          })}
        </Tarjeta>
      )}
    </View>
  ) : null;

  const tareas =
    report && colegioId && cursoId && uid ? (
      <View style={styles.vista}>
        <AssignmentsManager colegioId={colegioId} cursoId={cursoId} createdByUid={uid} />
        {report.retoColumns.length > 0 ? (
          <>
            <Seccion texto={t('dashboard.retosTitle')} />
            <Aviso icono="lock-closed" tono="azul" texto={t('dashboard.retoSeguimientoPrivado')} />
          </>
        ) : null}
      </View>
    ) : null;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          sobretitulo={t('profe.sobreClase')}
          titulo={cursoNombre}
          subtitulo={t('dashboard.courseReport')}
        />

        <BotonChunky
          texto={t('profe.gestionarClase')}
          icono="settings-outline"
          variante="secundario"
          compacto
          onPress={() =>
            router.push(
              `/(staff)/gestionar/${cursoId}?nombre=${encodeURIComponent(cursoNombre)}` as Href
            )
          }
        />

        {status === 'ready' && report ? (
          <Segmented options={vistas} value={vista} onChange={setVista} />
        ) : null}

        {status === 'loading' ? <Esqueleto filas={3} alto={96} /> : null}

        {status === 'error' ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('profe.errorTitulo')}
            texto={t('dashboard.error')}
          />
        ) : null}

        {status === 'ready' && report ? (
          // key={vista}: al cambiar de vista el contenido vuelve a entrar suave.
          <FadeIn key={vista}>
            {vista === 'resumen' ? resumen : vista === 'estudiantes' ? estudiantes : tareas}
          </FadeIn>
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 14 },
  vista: { gap: 14 },
  tiles: { flexDirection: 'row', gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  filaTexto: { flex: 1, gap: 2 },
  filaNombre: { fontSize: 16, fontWeight: '800' },
  filaSub: { fontSize: 13, fontWeight: '600' },
  valor: { fontSize: 16, fontWeight: '900' },
  barraCabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  estudiante: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  exportar: { flexDirection: 'row', gap: 10 },
});
