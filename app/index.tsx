// app/index.tsx — Entry point: redirige según estado de autenticación y rol
import { Redirect } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useChildStore } from '@features/auth/store/useChildStore';

export default function Index() {
  const { isAuthenticated, userRole } = useAuthStore();
  const isOnboarded = useChildStore((s) => s.isOnboarded);

  if (!isAuthenticated || !isOnboarded) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (userRole === 'parent') {
    return <Redirect href="/(parent)/dashboard" />;
  }

  return <Redirect href="/(child)/world" />;
}

