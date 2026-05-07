// app/index.tsx — Punto de entrada: Firebase + documento remoto o modo solo-local
import { useEffect, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { useChildStore } from '@features/auth/store/useChildStore';
import { useParentStore } from '@features/family/store/useParentStore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { userRepository } from '@features/auth/data/userRepository';

export default function Index() {
  const authReady = useAuthStore((s) => s.authReady);
  const [target, setTarget] = useState<Href | null>(null);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    void (async () => {
      if (!isFirebaseConfigured()) {
        const { isAuthenticated, userRole } = useAuthStore.getState();
        const isChildOnboarded = useChildStore.getState().isOnboarded;
        const isPinSet = useParentStore.getState().isPinSet;
        const parentName = useParentStore.getState().parentName;

        if (!isAuthenticated || !userRole) {
          if (!cancelled) setTarget('/(auth)/welcome');
          return;
        }
        if (userRole === 'parent') {
          const parentReady = isPinSet && parentName.trim().length >= 2;
          if (!cancelled) {
            setTarget(parentReady ? '/(parent)/dashboard' : '/(auth)/onboarding/parent-setup');
          }
          return;
        }
        if (!isChildOnboarded) {
          if (!cancelled) setTarget('/(auth)/onboarding/child-setup');
          return;
        }
        if (!cancelled) setTarget('/(child)/world');
        return;
      }

      const clients = getFirebaseClients();
      const u = clients?.auth.currentUser;
      if (!u) {
        if (!cancelled) setTarget('/(auth)/welcome');
        return;
      }

      useAuthStore.getState().setFirebaseUid(u.uid);

      const remote = await userRepository.getUser(u.uid);
      if (!remote) {
        if (!cancelled) setTarget('/(auth)/choose-role');
        return;
      }

      if (remote.role === 'parent') {
        const { isPinSet, parentName } = useParentStore.getState();
        const parentReady = isPinSet && parentName.trim().length >= 2;
        if (!parentReady) {
          if (!cancelled) setTarget('/(auth)/onboarding/parent-setup');
          return;
        }
        useAuthStore.getState().loginAsParent();
        if (!cancelled) setTarget('/(parent)/dashboard');
        return;
      }

      const fam = remote.familyId;
      if (fam == null || fam === '') {
        if (!cancelled) setTarget('/(auth)/onboarding/child-link');
        return;
      }

      useAuthStore.getState().setLinkedFamilyId(fam);

      const isChildOnboarded = useChildStore.getState().isOnboarded;
      if (!isChildOnboarded) {
        if (!cancelled) setTarget('/(auth)/onboarding/child-setup');
        return;
      }

      useAuthStore.getState().loginAsChild();
      if (!cancelled) setTarget('/(child)/world');
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady]);

  if (!authReady || target === null) return null;
  return <Redirect href={target} />;
}
