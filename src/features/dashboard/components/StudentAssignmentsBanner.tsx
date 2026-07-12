import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import type { WorldId } from '@features/learning/data/quiz.types';
import {
  asignacionRepository,
  type AsignacionWithId,
} from '@features/dashboard/data/asignacionRepository';
import { assignmentStatus } from '@features/dashboard/data/assignmentStatus';
import { useRetoCompletionSync } from '@features/dashboard/hooks/useRetoCompletionSync';
import type { RetoAsignado, RetoCoords } from '@features/dashboard/data/retoSync';

function worldNumber(worldId: string): number {
  return Number(worldId.replace('world_', ''));
}

/**
 * Muestra al estudiante sus tareas activas: mundos ("completa el mundo X") y
 * retos financieros (RQ-PR14). Para los retos, monta el sync de cumplimiento
 * (evalúa el diario LOCAL y publica solo la señal de estado). No renderiza nada
 * si no está aprovisionado o no hay tareas activas.
 */
export default function StudentAssignmentsBanner() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);

  const [items, setItems] = useState<AsignacionWithId[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (role !== 'estudiante' || !colegioId || !cursoId) return;
    void asignacionRepository.listByCurso(colegioId, cursoId).then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [role, colegioId, cursoId]);

  const now = Date.now();
  const active = items
    .filter((a) => assignmentStatus(a, now, false) !== 'upcoming')
    .sort((a, b) => a.deadline - b.deadline);

  // Retos vigentes → sync de cumplimiento (evaluación 100% local; solo cruza el
  // estado). Debe llamarse SIEMPRE (hooks), antes de cualquier return condicional.
  const retosAsignados = useMemo<RetoAsignado[]>(() => {
    const out: RetoAsignado[] = [];
    for (const a of items) {
      if (a.kind === 'reto') {
        out.push({
          id: a.id,
          tipo: a.reto.tipo,
          cantidad: a.reto.cantidad,
          fechaInicio: a.fechaInicio,
          deadline: a.deadline,
        });
      }
    }
    return out;
  }, [items]);

  const coords = useMemo<RetoCoords | null>(
    () => (colegioId && cursoId && uid ? { colegioId, cursoId, uid } : null),
    [colegioId, cursoId, uid]
  );

  useRetoCompletionSync(retosAsignados, coords);

  if (active.length === 0) return null;

  const hayReto = active.some((a) => a.kind === 'reto');

  return (
    <View style={[styles.wrap, { backgroundColor: colors.background.elevated }]}>
      <View style={styles.header}>
        <Ionicons name="flag" size={16} color={colors.brand.primary} />
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {t('assignments.studentTitle')}
        </Text>
      </View>
      {active.map((a) => {
        const overdue = assignmentStatus(a, now, false) === 'overdue';
        const fecha = new Date(a.deadline).toLocaleDateString('es-CO');
        const label =
          a.kind === 'reto'
            ? `${t(`assignments.retoItem_${a.reto.tipo}`, { n: a.reto.cantidad })} · ${fecha}`
            : t('assignments.studentItem', { n: worldNumber(a.worldId as WorldId), date: fecha });
        return (
          <Text
            key={a.id}
            style={[styles.item, { color: overdue ? colors.system.red : colors.text.secondary }]}
          >
            {label}
          </Text>
        );
      })}
      {hayReto && (
        <Text style={[styles.privacy, { color: colors.text.tertiary }]}>
          {t('assignments.retoPrivacidad')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 14, padding: 14, gap: 6, marginBottom: 8 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 14, fontWeight: '700' },
  item: { fontSize: 13, lineHeight: 18 },
  privacy: { fontSize: 12, fontStyle: 'italic', marginTop: 2 },
});
