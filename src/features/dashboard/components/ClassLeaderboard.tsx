import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { leaderboardRepository } from '@features/dashboard/data/leaderboardRepository';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { Typography } from '@shared/constants/typography';
import type { LeaderboardEntry } from '@shared/types/tenancy';

/**
 * Class leaderboard (V2). Renders nothing unless the student belongs to a course
 * whose teacher enabled colaboracionAula. When enabled, it publishes the student's
 * own minimal entry (label + xp) and shows the course ranking (no global board,
 * no per-competency data — privacy-preserving).
 */
export default function ClassLeaderboard() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const studentId = useAuthStore((s) => s.studentId);
  const xp = useUserStore((s) => s.xp);
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);

  useEffect(() => {
    if (role !== 'estudiante' || !colegioId || !cursoId || !studentId) {
      setEntries(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const curso = await rosterRepository.getCurso(colegioId, cursoId);
      if (cancelled) return;
      if (!curso?.colaboracionAula) {
        setEntries(null);
        return;
      }
      const est = await rosterRepository.getEstudiante(colegioId, cursoId, studentId);
      const displayLabel = est?.displayLabel ?? 'Estudiante';
      await leaderboardRepository.upsertEntry(colegioId, cursoId, studentId, { displayLabel, xp });
      if (cancelled) return;
      const board = await leaderboardRepository.getCourseLeaderboard(colegioId, cursoId);
      if (!cancelled) setEntries(board);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, colegioId, cursoId, studentId, xp]);

  if (!entries) return null;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
      ]}
    >
      <View style={styles.header}>
        <Ionicons name="trophy-outline" size={18} color={colors.gold.primary} />
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('leaderboard.title')}</Text>
      </View>
      {entries.length === 0 ? (
        <Text style={[styles.empty, { color: colors.text.tertiary }]}>
          {t('leaderboard.empty')}
        </Text>
      ) : (
        entries.map((e, i) => {
          const isSelf = e.studentId === studentId;
          return (
            <View key={e.studentId} style={styles.row}>
              <Text style={[styles.rank, { color: colors.text.tertiary }]}>{i + 1}</Text>
              <Text
                style={[
                  styles.name,
                  {
                    color: isSelf ? colors.brand.primary : colors.text.primary,
                    fontWeight: isSelf ? '800' : '600',
                  },
                ]}
                numberOfLines={1}
              >
                {e.displayLabel}
                {isSelf ? ` · ${t('leaderboard.you')}` : ''}
              </Text>
              <Text style={[styles.xp, { color: colors.text.secondary }]}>
                {t('leaderboard.xp', { xp: e.xp })}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8, marginBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { ...Typography.headline, fontWeight: '800' },
  empty: { ...Typography.caption1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rank: { ...Typography.caption1, fontWeight: '800', width: 20, textAlign: 'center' },
  name: { ...Typography.subheadline, flex: 1 },
  xp: { ...Typography.caption1, fontWeight: '700' },
});
