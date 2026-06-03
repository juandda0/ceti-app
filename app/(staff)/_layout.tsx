import { Redirect, Stack } from 'expo-router';
import { useAuthStore, isStaffRole } from '@features/auth/store/useAuthStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';

/** Route group for school staff. Non-staff are bounced back to the resolver. */
export default function StaffLayout() {
  const authReady = useAuthStore((s) => s.authReady);
  const role = useAuthStore((s) => s.role);
  const superadmin = useAuthStore((s) => s.superadmin);
  const colors = useThemeColors();

  if (authReady && !isStaffRole(role) && !superadmin) {
    return <Redirect href="/" />;
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
