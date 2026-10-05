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
import { useAuthStore, isStaffRole } from '@features/auth/store/useAuthStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useSavingsStore } from '@features/savings/store/useSavingsStore';
import { useMovimientosStore } from '@features/savings/store/useMovimientosStore';
import { usePresupuestosStore } from '@features/savings/store/usePresupuestosStore';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useLearningFlowStore } from '@features/learning/store/useLearningFlowStore';
import { isBackendConfigured } from '@shared/lib/api/client';
import { getSessionUser, toCetiClaims, type SessionUser } from '@shared/lib/auth/session';
import { adminService } from '@features/dashboard/data/adminService';
import { loginIntent } from '@features/auth/data/loginIntent';
import { hasClassAccess } from '@features/learning/data/classAccess';
import { recordError } from '@shared/lib/analytics/errorReporting';

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

    async function resolveSession() {
      const mySeq = ++seq.current;
      setBootstrapError(false);

      let u: SessionUser | null;
      try {
        u = await getSessionUser();
      } catch {
        if (cancelled || mySeq !== seq.current) return;
        setBootstrapError(true);
        setTarget(null);
        return;
      }
      if (cancelled || mySeq !== seq.current) return;

      if (!u) {
        setTarget('/(auth)/welcome');
        return;
      }

      useAuthStore.getState().setUid(u.id);

      // Role/tenant come from the account (set only by the backend).
      let claims = toCetiClaims(u);

      // Settle access on first login. A declared professor is provisioned into
      // their own isolated colegio; a student remains on the join-by-code path.
      if (!u.role) {
        try {
          const access = await adminService.resolveMyAccess(loginIntent.get());
          claims = toCetiClaims(access);
        } catch (e) {
          // offline / server error → treat as prospective student below
          recordError(e, 'resolve_my_access');
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

      const localUser = useUserStore.getState();
      const persistedId = (localUser.id ?? '').trim();
      const idMismatch = persistedId !== u.id && (persistedId !== '' || localUser.isOnboarded);

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

      const hasProfile =
        u.profile != null &&
        typeof u.profile.nickname === 'string' &&
        u.profile.nickname.trim().length >= 2;

      if (!hasProfile || !useUserStore.getState().isOnboarded) {
        if (u.profile) {
          const p = u.profile;
          useUserStore.getState().loadProfile({
            id: u.id,
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
        setTarget('/(app)/saga' as Href);
        return;
      }
      useAuthStore.getState().login();
      setTarget('/(app)/saga');
    }

    if (!isBackendConfigured()) {
      setTarget('/(auth)/welcome');
      return () => {
        cancelled = true;
      };
    }

    void resolveSession();

    return () => {
      cancelled = true;
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
    if (isBackendConfigured()) {
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
