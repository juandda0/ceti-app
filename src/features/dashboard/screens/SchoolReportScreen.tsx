import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { loadSchoolReport } from '@features/dashboard/data/loadSchoolReport';
import { schoolReportToCsv, type SchoolReport } from '@features/dashboard/data/schoolReport';
import { downloadTextFile, printPage } from '@shared/lib/export/downloadFile';

function pct(m: number): string {
  return `${Math.round(m * 100)}%`;
}

/** Profesor high-level compliance view across the whole colegio (non-nominal). */
export default function SchoolReportScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  // Built purely from per-course aggregates (nominal progress outside the
  // profesor's own courses is denied by rules). Sedes are dormant (RQ-FN01).

  const [report, setReport] = useState<SchoolReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!colegioId) {
      setStatus('error');
      return;
    }
    setStatus('loading');
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
    if (!ok) Alert.alert(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'));
  }, [report, t]);

  const onPrint = useCallback(() => {
    if (!printPage()) Alert.alert(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'));
  }, [t]);

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('school.title')}</Text>

        {status === 'loading' && (
          <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
        )}
        {status === 'error' && (
          <Text style={[styles.muted, { color: colors.text.secondary }]}>
            {t('dashboard.error')}
          </Text>
        )}

        {status === 'ready' && report && (
          <>
            <View style={[styles.kpi, { backgroundColor: colors.background.secondary }]}>
              <Text style={[styles.kpiLabel, { color: colors.text.secondary }]}>
                {t('school.overall')}
              </Text>
              <Text style={[styles.kpiValue, { color: colors.brand.primary }]}>
                {pct(report.overallMastery)}
              </Text>
            </View>

            {report.weakestCompetencia && (
              <View style={[styles.weakBanner, { backgroundColor: colors.background.secondary }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.system.orange} />
                <Text style={[styles.weakText, { color: colors.text.primary }]}>
                  {t('school.weakest', {
                    competencia: report.weakestCompetencia.label,
                    pct: pct(report.weakestCompetencia.averageMastery),
                  })}
                </Text>
              </View>
            )}

            <View style={styles.exportRow}>
              <TouchableOpacity
                style={[styles.exportBtn, { borderColor: colors.brand.primary }]}
                onPress={onExportCsv}
                accessibilityRole="button"
              >
                <Ionicons name="download-outline" size={16} color={colors.brand.primary} />
                <Text style={[styles.exportText, { color: colors.brand.primary }]}>
                  {t('dashboard.exportCsv')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.exportBtn, { borderColor: colors.brand.primary }]}
                onPress={onPrint}
                accessibilityRole="button"
              >
                <Ionicons name="print-outline" size={16} color={colors.brand.primary} />
                <Text style={[styles.exportText, { color: colors.brand.primary }]}>
                  {t('dashboard.exportPdf')}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.section, { color: colors.text.secondary }]}>
              {t('school.byCourse')}
            </Text>
            {report.courseSummaries.map((c) => (
              <View
                key={c.cursoId}
                style={[styles.row, { borderColor: colors.background.secondary }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowName, { color: colors.text.primary }]}>{c.nombre}</Text>
                  <Text style={[styles.rowSub, { color: colors.text.tertiary }]}>
                    {t('school.studentsCount', { count: c.studentsWithData })}
                  </Text>
                </View>
                <Text style={[styles.rowValue, { color: colors.brand.primary }]}>
                  {pct(c.avgMastery)}
                </Text>
              </View>
            ))}

            <Text style={[styles.section, { color: colors.text.secondary }]}>
              {t('school.byCompetency')}
            </Text>
            {report.competencyAverages.map((c) => (
              <View
                key={c.competenciaId}
                style={[styles.row, { borderColor: colors.background.secondary }]}
              >
                <Text style={[styles.rowName, { flex: 1, color: colors.text.primary }]}>
                  {c.label}
                </Text>
                <Text style={[styles.rowValue, { color: colors.brand.primary }]}>
                  {pct(c.averageMastery)}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  loader: { marginTop: 24 },
  muted: { marginTop: 24, fontSize: 14 },
  kpi: { borderRadius: 16, padding: 18, alignItems: 'center', gap: 4 },
  kpiLabel: { fontSize: 13, fontWeight: '600' },
  kpiValue: { fontSize: 36, fontWeight: '900' },
  weakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
  },
  weakText: { flex: 1, fontSize: 14, fontWeight: '600' },
  exportRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  exportText: { fontSize: 14, fontWeight: '700' },
  section: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  rowName: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 12 },
  rowValue: { fontSize: 18, fontWeight: '800' },
});
