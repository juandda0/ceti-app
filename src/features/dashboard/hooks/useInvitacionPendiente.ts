/**
 * Enlace de invitación /join/{código}: la ruta guarda el código y manda al
 * inicio de sesión. Cuando el estudiante ya está dentro de la app, este hook
 * lo lleva a "Unirme a una clase" con el código puesto.
 */
import { useEffect } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { pendingInvite } from '@features/dashboard/data/pendingInvite';

export function useInvitacionPendiente(): void {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    // Rol null = estudiante sin clase (su token no trae colegio).
    if (role === 'profesor' || role === 'admin') return;
    const codigo = pendingInvite.consume();
    if (!codigo) return;
    router.push(`/(app)/unirme?codigo=${encodeURIComponent(codigo)}&auto=1` as Href);
  }, [role, router]);
}
