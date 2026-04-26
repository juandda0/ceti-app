// app/index.tsx — Entry point: redirige según estado de autenticación y rol
import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useWalletStore } from '@features/savings/store/useWalletStore';
import { useLessonsStore } from '@features/learning/store/useLessonsStore';
import { useParentStore } from '@features/family/store/useParentStore';
import { useWorldStore } from '@features/world/store/useWorldStore';

const FORCE_RESET = true; // CAMBIAR A FALSE DESPUÉS DE REINICIAR

export default function Index() {
  const { isAuthenticated, userRole, logout } = useAuthStore();
  const { isOnboarded, resetChild } = useChildStore();
  const resetWallet = useWalletStore(s => s.resetWallet);
  const resetLessons = useLessonsStore(s => s.resetLessons);
  const resetParent = useParentStore(s => s.resetParent);
  const resetWorld = useWorldStore(s => s.resetWorld);

  useEffect(() => {
    if (FORCE_RESET) {
      resetChild();
      resetWallet();
      resetLessons();
      resetParent();
      resetWorld();
      logout();
      console.log('FACTORY RESET EXECUTED');
    }
  }, []);

  if (!isAuthenticated || !isOnboarded) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (userRole === 'parent') {
    return <Redirect href="/(parent)/dashboard" />;
  }

  return <Redirect href="/(child)/world" />;
}

