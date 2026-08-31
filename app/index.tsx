import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Redirect, type Href } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuthStore, isStaffRole } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useLearningFlowStore } from '@features/learning/store/useLearningFlowStore';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { readCetiClaims } from '@shared/lib/firebase/claims';
import { userRepository } from '@features/auth/data/userRepository';
import { adminService } from '@features/dashboard/data/adminService';
import { loginIntent } from '@features/auth/data/loginIntent';
import { hasClassAccess } from '@features/learning/data/classAccess';

export default function Index() {
  const authReady = useAuthStore((s) => s.authReady);
  const [target, setTarget] = useState<Href | null>(null);
  const [bootstrapError, setBootstrapError] = useState(false);
  const [routeRetry, setRouteRetry] = useState(0);
  const seq = useRef(0);
  const { width } = useWindowDimensions();

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;

    function resolveOffline(): void {
      const { isAuthenticated } = useAuthStore.getState();
      const isOnboarded = useUserStore.getState().isOnboarded;

      if (!isAuthenticated) {
        if (!cancelled) setTarget('/(auth)/welcome');
        return;
      }
      if (!isOnboarded) {
        if (!cancelled) setTarget('/(auth)/onboarding/user-setup');
        return;
      }
      if (!cancelled) setTarget('/(app)/saga');
    }

    async function resolveFirebase(clients: NonNullable<ReturnType<typeof getFirebaseClients>>) {
      const mySeq = ++seq.current;
      setBootstrapError(false);

      try {
        await clients.auth.authStateReady();
      } catch {
        if (cancelled || mySeq !== seq.current) return;
        setBootstrapError(true);
        setTarget(null);
        return;
      }
      if (cancelled || mySeq !== seq.current) return;

      const u = clients.auth.currentUser;
      if (!u) {
        setTarget('/(auth)/welcome');
        return;
      }

      useAuthStore.getState().setFirebaseUid(u.uid);

      // Role/tenant from custom claims (set by Cloud Functions).
      let claims = await readCetiClaims(u);
      if (cancelled || mySeq !== seq.current) return;

      // Settle access on first login. A declared professor is provisioned into
      // their own isolated colegio; a student remains on the join-by-code path.
      // Refresh the token to pick up any newly-set claims.
      if (!claims?.role) {
        try {
          const access = await adminService.resolveMyAccess(loginIntent.get());
          if (access.role) claims = await readCetiClaims(u, true);
        } catch {
          // offline / function error → treat as prospective student below
        }
        if (cancelled || mySeq !== seq.current) return;
      }
      useAuthStore.getState().setClaims(claims);

      // admin → admin panel; profesor → staff panel (skip student onboarding).
      if (claims?.role === 'admin') {
        useAuthStore.getState().login();
        setTarget('/(admin)' as Href);
        return;
      }
      if (claims && isStaffRole(claims.role)) {
        useAuthStore.getState().login();
        // Cast: typed-routes union regenerates from the filesystem on build.
        setTarget('/(staff)' as Href);
        return;
      }

      let remote: Awaited<ReturnType<typeof userRepository.getUser>>;
      try {
        remote = await userRepository.getUser(u.uid);
      } catch {
        if (cancelled || mySeq !== seq.current) return;
        setBootstrapError(true);
        setTarget(null);
        return;
      }

      if (cancelled || mySeq !== seq.current) return;

      const localUser = useUserStore.getState();
      const persistedId = (localUser.id ?? '').trim();
      const idMismatch = persistedId !== u.uid && (persistedId !== '' || localUser.isOnboarded);

      if (idMismatch) {
        // Otra cuenta en el mismo dispositivo: purga TODO el estado local del
        // usuario anterior (incluye el diario de bolsillo, PII del menor) — no
        // basta con user+savings o el diario de A quedaría visible para B.
        useUserStore.getState().resetUser();
        useSavingsStore.getState().resetSavings();
        useMovimientosStore.getState().resetMovimientos();
        usePresupuestosStore.getState().resetPresupuestos();
        useQuestionBankStore.getState().resetUserProgress();
        useLearningFlowStore.getState().reset();
      }

      if (!remote) {
        setTarget('/(auth)/onboarding/user-setup');
        return;
      }

      const hasProfile =
        remote.profile != null &&
        typeof remote.profile.nickname === 'string' &&
        remote.profile.nickname.trim().length >= 2;

      if (!hasProfile || !useUserStore.getState().isOnboarded) {
        if (remote.profile) {
          const p = remote.profile;
          useUserStore.getState().loadProfile({
            id: u.uid,
            nickname: typeof p.nickname === 'string' ? p.nickname : '',
            fullName: typeof p.fullName === 'string' ? p.fullName : '',
            avatarId: typeof p.avatarId === 'string' ? p.avatarId : '',
            avatarEmoji: typeof p.avatarEmoji === 'string' ? p.avatarEmoji : '',
          });
        }
        if (!useUserStore.getState().isOnboarded) {
          setTarget('/(auth)/onboarding/user-setup');
          return;
        }
      }

      if (cancelled || mySeq !== seq.current) return;
      if (!hasClassAccess(claims?.colegioId, claims?.cursoId)) {
        useAuthStore.getState().login();
        setTarget('/(app)/dinero');
        return;
      }
      useAuthStore.getState().login();
      setTarget('/(app)/saga');
    }

    if (!isFirebaseConfigured()) {
      resolveOffline();
      return () => {
        cancelled = true;
      };
    }

    const clients = getFirebaseClients();
    if (!clients) {
      setTarget('/(auth)/welcome');
      return () => {
        cancelled = true;
      };
    }

    const unsub = onAuthStateChanged(clients.auth, () => {
      void resolveFirebase(clients);
    });

    void resolveFirebase(clients);

    return () => {
      cancelled = true;
      unsub();
    };
  }, [authReady, routeRetry]);

  const onRetryBootstrap = () => {
    setBootstrapError(false);
    setTarget(null);
    setRouteRetry((n) => n + 1);
  };

  if (!authReady) return null;

  if (bootstrapError) {
    return (
      <View style={[styles.errorWrap, { maxWidth: Math.min(400, width - 48) }]}>
        <Text style={styles.errorTitle}>No pudimos cargar tu perfil</Text>
        <Text style={styles.errorSub}>Revisa tu conexión e inténtalo de nuevo.</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={onRetryBootstrap}
          accessibilityRole="button"
        >
          <Text style={styles.retryBtnText}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (target === null) {
    if (isFirebaseConfigured()) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }
    return null;
  }

  return <Redirect href={target} />;
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  errorWrap: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0f172a',
    gap: 12,
  },
  errorTitle: { fontSize: 20, fontWeight: '800', color: '#f8fafc' },
  errorSub: { fontSize: 15, lineHeight: 22, color: '#94a3b8' },
  retryBtn: {
    marginTop: 16,
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  retryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
