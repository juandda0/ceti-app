import { Redirect, Stack, type Href } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';

/**
 * Admin console (course/role management). Restricted to rector/coordinador
 * (whole-school scope) or a platform super-admin. A profesor is staff and clears
 * the (staff) group guard, so this nested guard is what keeps them out of the
 * admin surfaces — authorization is enforced server-side by firestore.rules and
 * the Cloud Functions, this is the matching client-side gate.
 */
export default function AdminLayout() {
  const authReady = useAuthStore((s) => s.authReady);
  const role = useAuthStore((s) => s.role);
  const superadmin = useAuthStore((s) => s.superadmin);
  const colors = useThemeColors();

  const canManageSchool = role === 'rector' || role === 'coordinador' || superadmin;

  if (authReady && !canManageSchool) {
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
