import { Redirect, type Href } from 'expo-router';
import { useAuthStore, useIsAdmin } from '@features/auth/store/useAuthStore';
import SuperAdminScreen from '@features/dashboard/screens/SuperAdminScreen';

/**
 * Platform admin console (register/list colegios). Gated to the platform admin:
 * the `role:'admin'` claim is set server-side and the Cloud Functions re-check
 * it, so this is the client-side mirror that keeps ordinary staff
 * (rector/coordinador/profesor) out of the platform surface.
 */
export default function SuperAdminRoute() {
  const authReady = useAuthStore((s) => s.authReady);
  const isAdmin = useIsAdmin();

  if (authReady && !isAdmin) {
    // Cast: typed-routes union regenerates from the filesystem on build.
    return <Redirect href={'/(staff)' as Href} />;
  }

  return <SuperAdminScreen />;
}
