import { Redirect, Stack } from 'expo-router';
import { useAuthStore, useIsAdmin } from '@features/auth/store/useAuthStore';
import { useThemeColors } from '@shared/hooks/useThemeColors';

/** Route group for Ceti admin (D-ADMIN). Non-admins are bounced to the resolver. */
export default function AdminLayout() {
  const authReady = useAuthStore((s) => s.authReady);
  const isAdmin = useIsAdmin();
  const colors = useThemeColors();

  if (authReady && !isAdmin) {
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
