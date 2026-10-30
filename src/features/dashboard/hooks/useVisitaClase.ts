/**
 * Cuenta una visita al espacio de la clase abierta en Aprender: al entrar a la
 * pantalla o al volver a la app, como mucho una cada 30 min por clase. Así el
 * profe ve cuántas veces entra cada estudiante a su clase. En Mi galaxia no
 * cuenta nada.
 */
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { cuentaComoVisita } from '@features/dashboard/data/registroClase';
import { registroClaseRepository } from '@features/dashboard/data/registroClaseRepository';

const ultimaVisita = new Map<string, number>();

export function useVisitaClase(): void {
  const role = useAuthStore((s) => s.role);
  const colegioId = useAuthStore((s) => s.colegioId);
  const cursoId = useAuthStore((s) => s.cursoId);
  const uid = useAuthStore((s) => s.firebaseUid);

  const contar = useCallback(() => {
    if (role !== 'estudiante' || !colegioId || !cursoId || !uid) return;
    const ahora = Date.now();
    if (!cuentaComoVisita(ultimaVisita.get(cursoId), ahora)) return;
    ultimaVisita.set(cursoId, ahora);
    // Sin autorización las reglas lo niegan: no pasa nada.
    void registroClaseRepository
      .registrarVisita(colegioId, cursoId, uid, ahora)
      .catch(() => undefined);
  }, [role, colegioId, cursoId, uid]);

  useFocusEffect(contar);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') contar();
    });
    return () => sub.remove();
  }, [contar]);
}
