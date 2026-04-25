// app/index.tsx — Entry point: redirige según estado del onboarding
import { Redirect } from 'expo-router';
import { useChildStore } from '@features/auth/store/useChildStore';

export default function Index() {
  const isOnboarded = useChildStore((s) => s.isOnboarded);

  if (isOnboarded) {
    return <Redirect href="/(child)/world" />;
  }

  return <Redirect href="/(auth)/welcome" />;
}
