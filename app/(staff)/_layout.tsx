import { Redirect, Stack } from 'expo-router';
import { useAuthStore, isStaffRole } from '@features/auth/store/useAuthStore';

/** Route group for school staff. Non-staff are bounced back to the resolver. */
export default function StaffLayout() {
  const authReady = useAuthStore((s) => s.authReady);
  const role = useAuthStore((s) => s.role);

  if (authReady && !isStaffRole(role)) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
