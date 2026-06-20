import { Redirect, Stack, type Href } from 'expo-router';
import { useAuthStore, useIsAdmin } from '@features/auth/store/useAuthStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';

/**
 * Admin console (course/role structure management). Restricted to the platform
 * admin (role:'admin') ONLY — §1.3 matrix: createCurso and assignRole are
 * admin-only Cloud Functions; this is the matching client-side gate.
 * rector/coordinador/profesor are explicitly excluded (they clear the (staff)
 * group guard but must not reach these screens).
 */
export default function AdminLayout() {
  const authReady = useAuthStore((s) => s.authReady);
  const isAdmin = useIsAdmin();
  const colors = useThemeColors();

  if (authReady && !isAdmin) {
    // Cast: typed-routes union regenerates from the filesystem on build.
    return <Redirect href={'/(staff)' as Href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background.base },
      }}
    />
  );
}
