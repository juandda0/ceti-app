import { Redirect, type Href } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import SuperAdminScreen from '@features/dashboard/screens/SuperAdminScreen';

/**
 * Platform super-admin console (register/list colegios). Gated to the super-admin
 * allowlist: the `superadmin` claim is set server-side (CETI_SUPERADMIN_EMAILS)
 * and the Cloud Functions re-check it, so this is the client-side mirror that
 * keeps ordinary staff (rector/coordinador/profesor) out of the platform surface.
 */
export default function SuperAdminRoute() {
  const authReady = useAuthStore((s) => s.authReady);
  const superadmin = useAuthStore((s) => s.superadmin);

  if (authReady && !superadmin) {
    // Cast: typed-routes union regenerates from the filesystem on build.
    return <Redirect href={'/(staff)' as Href} />;
  }

  return <SuperAdminScreen />;
}
