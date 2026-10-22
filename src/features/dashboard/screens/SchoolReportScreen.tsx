import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { loadSchoolReport } from '@features/dashboard/data/loadSchoolReport';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { schoolReportToCsv, type SchoolReport } from '@features/dashboard/data/schoolReport';
import { downloadTextFile, printPage } from '@shared/lib/export/downloadFile';
import { showMessage } from '@shared/lib/dialogs';
import { ChartCard, GrowBar } from '@features/savings/charts/ChartParts';
import AdopcionColegio from '@features/educadores/retencion/components/AdopcionColegio';
import {
  Aviso,
  BotonChunky,
  Encabezado,
  Esqueleto,
  NumeroAnimado,
  Seccion,
  Tarjeta,
  Vacio,
  paletaTono,
  tonoNivel,
} from '@features/dashboard/components/profe/kit';

function pct(m: number): number {
  return Math.round(m * 100);
}

/**
 * Pestaña Colegio: adopción (profes y estudiantes activos frente a la meta, lo
 * que el colegio mira para renovar), dominio promedio de todo el colegio, por
 * curso y por competencia (solo agregados no nominales, D-PIVOT), y exportación.
 */
export default function SchoolReportScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  // Built purely from per-course aggregates (nominal progress outside the
  // profesor's own courses is denied by rules). Sedes are dormant (RQ-FN01).

  const [report, setReport] = useState<SchoolReport | null>(null);
  const [colegioNombre, setColegioNombre] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!colegioId) {
      setStatus('error');
      return;
    }
    setStatus('loading');
    void rosterRepository.getColegioNombre(colegioId).then((n) => {
      if (!cancelled) setColegioNombre(n);
    });
    void loadSchoolReport(colegioId, Date.now())
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
  }, [colegioId]);

  const onExportCsv = useCallback(() => {
    if (!report) return;
    const ok = downloadTextFile(
      `reporte-colegio-${report.colegioId}.csv`,
      schoolReportToCsv(report)
    );
    if (!ok) showMessage(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'), 'error');
  }, [report, t]);

  const onPrint = useCallback(() => {
    if (!printPage())
      showMessage(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'), 'error');
  }, [t]);

  const sinDatos = report !== null && report.courseSummaries.every((c) => c.studentsWithData === 0);
  const general = report ? pct(report.overallMastery) : 0;
  const nivel = paletaTono(colors, tonoNivel(general));

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          titulo={t('profe.colegioTitulo')}
          subtitulo={colegioNombre ?? t('school.title')}
        />

        <AdopcionColegio />

        {status === 'ready' ? <Seccion texto={t('educadores.adopcion.dominioTitulo')} /> : null}

        {status === 'loading' ? <Esqueleto filas={3} alto={110} /> : null}

        {status === 'error' ? (
          <Vacio
            icono="cloud-offline-outline"
            tono="rojo"
            titulo={t('profe.errorTitulo')}
            texto={t('dashboard.error')}
          />
        ) : null}

        {status === 'ready' && report && sinDatos ? (
          <Vacio
            icono="bar-chart"
            titulo={t('profe.colegioVacioTitulo')}
            texto={t('profe.colegioVacioTexto')}
          />
        ) : null}

        {status === 'ready' && report && !sinDatos ? (
          <Tarjeta style={styles.hero}>
            <Text style={[styles.heroEtiqueta, { color: colors.text.tertiary }]}>
              {t('school.overall').toUpperCase()}
            </Text>
            <View style={styles.heroFila}>
              <NumeroAnimado
                valor={general}
                sufijo="%"
                style={[styles.heroNumero, { color: colors.text.primary }]}
              />
              <Text style={[styles.heroNivel, { color: nivel.tinta }]}>
                {t(`profe.nivel_${tonoNivel(general)}`)}
              </Text>
            </View>
            <GrowBar
              pct={general}
              color={nivel.tinta}
              trackColor={colors.materials.highlight}
              height={12}
            />
            <Text style={[styles.heroSub, { color: colors.text.secondary }]}>
              {t('profe.colegioCursos', { count: report.courseSummaries.length })}
            </Text>
          </Tarjeta>
        ) : null}

        {status === 'ready' && report?.weakestCompetencia && !sinDatos ? (
          <Aviso
            icono="alert-circle"
            tono="naranja"
            texto={t('school.weakest', {
              competencia: report.weakestCompetencia.label,
              pct: `${pct(report.weakestCompetencia.averageMastery)}%`,
            })}
          />
        ) : null}

        {status === 'ready' && report && !sinDatos ? (
          <ChartCard title={t('school.byCourse')} subtitle={t('profe.porCursoSub')}>
            <View style={styles.lista}>
              {report.courseSummaries.map((c) => {
                const p = pct(c.avgMastery);
                const tono = paletaTono(colors, tonoNivel(p));
                return (
                  <View key={c.cursoId} style={styles.filaBarra}>
                    <View style={styles.filaCabeza}>
                      <Text
                        style={[styles.filaNombre, { color: colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {c.nombre}
                      </Text>
                      <Text style={[styles.filaValor, { color: colors.text.primary }]}>{p}%</Text>
                    </View>
                    <GrowBar
                      pct={p}
                      color={tono.tinta}
                      trackColor={colors.materials.highlight}
                      height={10}
                      dimmed={c.studentsWithData === 0}
                    />
                    <Text style={[styles.filaSub, { color: colors.text.tertiary }]}>
                      {t('school.studentsCount', { count: c.studentsWithData })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ChartCard>
        ) : null}

        {status === 'ready' && report && !sinDatos ? (
          <ChartCard title={t('school.byCompetency')} subtitle={t('profe.porCompetenciaSub')}>
            <View style={styles.lista}>
              {report.competencyAverages.map((c) => {
                const p = pct(c.averageMastery);
                const tono = paletaTono(colors, tonoNivel(p));
                return (
                  <View key={c.competenciaId} style={styles.filaBarra}>
                    <View style={styles.filaCabeza}>
                      <Text
                        style={[styles.filaNombre, { color: colors.text.primary }]}
                        numberOfLines={2}
                      >
                        {c.label}
                      </Text>
                      <Text style={[styles.filaValor, { color: colors.text.primary }]}>{p}%</Text>
                    </View>
                    <GrowBar
                      pct={p}
                      color={tono.tinta}
                      trackColor={colors.materials.highlight}
                      height={10}
                    />
                  </View>
                );
              })}
            </View>
          </ChartCard>
        ) : null}

        {status === 'ready' && report ? (
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
        ) : null}
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 130, gap: 14 },
  hero: { gap: 10, padding: 20, borderRadius: 24 },
  heroEtiqueta: { fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  heroFila: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  heroNumero: { fontSize: 56, lineHeight: 62, fontWeight: '900', letterSpacing: -2 },
  heroNivel: { fontSize: 16, fontWeight: '900' },
  heroSub: { fontSize: 14, fontWeight: '600' },
  lista: { gap: 16 },
  filaBarra: { gap: 6 },
  filaCabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  filaNombre: { flex: 1, fontSize: 15, fontWeight: '800' },
  filaValor: { fontSize: 15, fontWeight: '900' },
  filaSub: { fontSize: 13, fontWeight: '600' },
  exportar: { flexDirection: 'row', gap: 10 },
});
