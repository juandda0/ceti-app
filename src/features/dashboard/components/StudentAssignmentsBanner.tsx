import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import {
  asignacionRepository,
  type AsignacionWithId,
} from '@features/dashboard/data/asignacionRepository';
import { assignmentStatus } from '@features/dashboard/data/assignmentStatus';

const MAX_VISIBLES = 3;

/**
 * Tareas de la clase en Aprender: mundos ("completa X antes del…") y retos
 * financieros (RQ-PR14). Las de mundo se abren con un toque. No muestra las ya
 * hechas ni las que todavía no empiezan, y no renderiza nada sin clase.
 */
export default function StudentAssignmentsBanner({
  nombreDeMundo,
  mundoHecho,
  onAbrirMundo,
}: {
  nombreDeMundo: (worldId: string) => string | null;
  mundoHecho: (worldId: string) => boolean;
  onAbrirMundo: (worldId: string) => void;
}) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);

  const [items, setItems] = useState<AsignacionWithId[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (role !== 'estudiante' || !colegioId || !cursoId || !uid) {
      setItems([]);
      return;
    }
    // Un estudiante pendiente de autorización no puede leer las tareas: no hay nada que mostrar.
    void asignacionRepository
      .listForStudent(colegioId, cursoId, uid)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [role, colegioId, cursoId, uid]);

  const now = Date.now();
  const visibles = items
    .map((a) => {
      const hecha = a.kind !== 'reto' && mundoHecho(a.worldId);
      return { a, status: assignmentStatus(a, now, hecha) };
    })
    .filter(({ a, status }) => {
      if (status === 'upcoming' || status === 'done') return false;
      // Una tarea de un mundo que la clase ya no ve no se puede hacer.
      return a.kind === 'reto' || nombreDeMundo(a.worldId) !== null;
    })
    .sort((x, y) => x.a.deadline - y.a.deadline);

  if (visibles.length === 0) return null;

  // Las más urgentes primero; el resto se resume para no tapar la galaxia.
  const mostradas = visibles.slice(0, MAX_VISIBLES);
  const ocultas = visibles.length - mostradas.length;

  const hayReto = visibles.some(({ a }) => a.kind === 'reto');

  return (
    <View style={st.wrap}>
      <View style={st.header}>
        <Ionicons name="flag" size={16} color={ESPACIO.oro} />
        <Text style={st.title}>{t('assignments.studentTitle')}</Text>
      </View>
      {mostradas.map(({ a, status }) => {
        const vencida = status === 'overdue';
        const fecha = new Date(a.deadline).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'short',
        });
        const cuando = vencida
          ? t('assignments.studentOverdue', { date: fecha })
          : t('assignments.studentDue', { date: fecha });
        if (a.kind === 'reto') {
          return (
            <View key={a.id} style={st.item}>
              <Ionicons name="wallet" size={18} color={ESPACIO.textoSuave} />
              <View style={st.flex}>
                <Text style={st.itemTitulo}>
                  {t(`assignments.retoItem_${a.reto.tipo}`, { n: a.reto.cantidad })}
                </Text>
                <Text style={[st.itemFecha, vencida && st.vencida]}>{cuando}</Text>
              </View>
            </View>
          );
        }
        return (
          <Bounceable
            key={a.id}
            onPress={() => onAbrirMundo(a.worldId)}
            activeScale={0.97}
            accessibilityRole="button"
            style={st.item}
          >
            <Ionicons name="planet" size={18} color={ESPACIO.naranja} />
            <View style={st.flex}>
              <Text style={st.itemTitulo}>
                {t('assignments.studentWorld', { mundo: nombreDeMundo(a.worldId) })}
              </Text>
              <Text style={[st.itemFecha, vencida && st.vencida]}>{cuando}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={ESPACIO.textoApagado} />
          </Bounceable>
        );
      })}
      {ocultas > 0 ? (
        <Text style={st.mas}>{t('assignments.studentMore', { count: ocultas })}</Text>
      ) : null}
      {hayReto ? <Text style={st.privacy}>{t('assignments.retoPrivacidad')}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    padding: 14,
    gap: 8,
    backgroundColor: ESPACIO.superficie,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontSize: 15, fontWeight: '900', color: ESPACIO.texto },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: ESPACIO.superficieBaja,
  },
  flex: { flex: 1, gap: 2 },
  itemTitulo: { fontSize: 14, fontWeight: '800', color: ESPACIO.texto },
  itemFecha: { fontSize: 12, fontWeight: '700', color: ESPACIO.textoSuave },
  vencida: { color: '#FF8A80' },
  mas: { fontSize: 13, fontWeight: '800', color: ESPACIO.textoSuave, paddingHorizontal: 4 },
  privacy: { fontSize: 12, fontStyle: 'italic', color: ESPACIO.textoApagado },
});
