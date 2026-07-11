import { Redirect, Stack } from 'expo-router';
import { useAuthStore, isStaffRole, useIsAdmin } from '@features/auth/store/useAuthStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';

/** Route group for school staff. Non-staff are bounced back to the resolver. */
export default function StaffLayout() {
  const authReady = useAuthStore((s) => s.authReady);
  const role = useAuthStore((s) => s.role);
  const isAdmin = useIsAdmin();
  const colors = useThemeColors();

  if (authReady && !isStaffRole(role) && !isAdmin) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 200,
        contentStyle: { backgroundColor: colors.background.base },
      }}
    />
  );
}
