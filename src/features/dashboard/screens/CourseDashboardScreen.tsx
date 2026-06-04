import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { loadCourseReport } from '@features/dashboard/data/loadCourseReport';
import { courseReportToCsv, type CourseReport } from '@features/dashboard/data/courseReport';
import { buildWeaknessReport } from '@features/dashboard/data/weaknessReport';
import AssignmentsManager from '@features/dashboard/components/AssignmentsManager';
import { downloadTextFile, printPage } from '@shared/lib/export/downloadFile';

function pct(m: number): string {
  return `${Math.round(m * 100)}%`;
}

export default function CourseDashboardScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const params = useLocalSearchParams<{ cursoId: string; nombre?: string }>();
  const cursoId = params.cursoId;
  const cursoNombre = params.nombre ?? cursoId;

  const [report, setReport] = useState<CourseReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const weakness = useMemo(() => (report ? buildWeaknessReport(report) : null), [report]);

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
    if (!ok) Alert.alert(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'));
  }, [report, t]);

  const onPrint = useCallback(() => {
    if (!printPage()) Alert.alert(t('dashboard.exportTitle'), t('dashboard.exportWebOnly'));
  }, [t]);

  return (
    <ScreenWrapper style={styles.root}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{cursoNombre}</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          {t('dashboard.courseReport')}
        </Text>

        {status === 'loading' && (
          <ActivityIndicator style={styles.loader} color={colors.brand.primary} />
        )}

        {status === 'error' && (
          <Text style={[styles.error, { color: colors.text.secondary }]}>
            {t('dashboard.error')}
          </Text>
        )}

        {status === 'ready' && report && (
          <>
            {report.weakestCompetencia ? (
              <View style={[styles.weakBanner, { backgroundColor: colors.background.secondary }]}>
                <Ionicons name="alert-circle-outline" size={18} color={colors.system.orange} />
                <Text style={[styles.weakText, { color: colors.text.primary }]}>
                  {t('dashboard.weakest', {
                    competencia: report.weakestCompetencia.label,
                    pct: pct(report.weakestCompetencia.averageMastery),
                  })}
                </Text>
              </View>
            ) : (
              <Text style={[styles.empty, { color: colors.text.secondary }]}>
                {t('dashboard.noData')}
              </Text>
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

            {weakness && weakness.hasData && (
              <View style={styles.diag}>
                <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>
                  {t('dashboard.diagnosisTitle')}
                </Text>
                {weakness.weakCompetencias.length === 0 && weakness.studentsAtRisk.length === 0 ? (
                  <View style={[styles.diagCard, { backgroundColor: colors.background.secondary }]}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color={colors.system.green}
                    />
                    <Text style={[styles.weakText, { color: colors.text.primary }]}>
                      {t('dashboard.allStrong')}
                    </Text>
                  </View>
                ) : (
                  <>
                    {weakness.weakCompetencias.length > 0 && (
                      <View
                        style={[styles.diagCard, { backgroundColor: colors.background.secondary }]}
                      >
                        <Text style={[styles.diagHead, { color: colors.text.primary }]}>
                          {t('dashboard.weakCompetenciesTitle')}
                        </Text>
                        {weakness.weakCompetencias.map((c) => (
                          <View key={c.competenciaId} style={styles.diagItem}>
                            <Text style={[styles.diagItemTitle, { color: colors.text.primary }]}>
                              {t('dashboard.weakCompetencyItem', {
                                label: c.label,
                                pct: pct(c.averageMastery),
                              })}
                            </Text>
                            <Text style={[styles.diagItemSub, { color: colors.text.tertiary }]}>
                              {t('dashboard.weakCompetencyBelow', {
                                below: c.studentsBelow,
                                total: c.studentsWithData,
                              })}
                            </Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {weakness.studentsAtRisk.length > 0 && (
                      <View
                        style={[styles.diagCard, { backgroundColor: colors.background.secondary }]}
                      >
                        <Text style={[styles.diagHead, { color: colors.text.primary }]}>
                          {t('dashboard.atRiskTitle')}
                        </Text>
                        {weakness.studentsAtRisk.map((s) => (
                          <View key={s.studentId} style={styles.diagItem}>
                            <Text style={[styles.diagItemTitle, { color: colors.text.primary }]}>
                              {s.displayLabel} ·{' '}
                              {t('dashboard.atRiskItem', { pct: pct(s.overallMastery) })}
                            </Text>
                            {s.weakAreas.length > 0 && (
                              <Text style={[styles.diagItemSub, { color: colors.text.tertiary }]}>
                                {t('dashboard.atRiskAreas', {
                                  areas: s.weakAreas.map((a) => a.label).join(', '),
                                })}
                              </Text>
                            )}
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>
              {t('dashboard.students', { count: report.students.length })}
            </Text>

            {report.students.map((s) => (
              <View
                key={s.studentId}
                style={[styles.studentRow, { borderColor: colors.background.secondary }]}
              >
                <View style={styles.studentInfo}>
                  <Text style={[styles.studentName, { color: colors.text.primary }]}>
                    {s.displayLabel}
                  </Text>
                  <Text style={[styles.studentEstado, { color: colors.text.tertiary }]}>
                    {t(`estados.${s.estado}`)}
                  </Text>
                </View>
                <Text style={[styles.studentMastery, { color: colors.brand.primary }]}>
                  {pct(s.overallMastery)}
                </Text>
              </View>
            ))}

            {colegioId && cursoId && uid && (
              <AssignmentsManager colegioId={colegioId} cursoId={cursoId} createdByUid={uid} />
            )}
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
  subtitle: { fontSize: 14 },
  loader: { marginTop: 24 },
  error: { marginTop: 24, fontSize: 14 },
  empty: { fontSize: 14, marginTop: 8 },
  weakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  weakText: { flex: 1, fontSize: 14, fontWeight: '600' },
  diag: { gap: 8, marginTop: 4 },
  diagCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 14,
  },
  diagHead: { width: '100%', fontSize: 14, fontWeight: '800' },
  diagItem: { width: '100%', gap: 2 },
  diagItemTitle: { fontSize: 14, fontWeight: '600' },
  diagItemSub: { fontSize: 12 },
  exportRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
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
  sectionLabel: { fontSize: 13, fontWeight: '600', marginTop: 12 },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  studentInfo: { gap: 2 },
  studentName: { fontSize: 15, fontWeight: '600' },
  studentEstado: { fontSize: 12 },
  studentMastery: { fontSize: 18, fontWeight: '800' },
});
