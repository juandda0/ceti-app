import { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import Animated from 'react-native-reanimated';
import { motion } from '@shared/constants/motion';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import CetiButton from '@shared/components/CetiButton';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { logEvent } from '@shared/lib/analytics/logEvent';
import { getFirebaseClients, isFirebaseConfigured } from '@shared/lib/firebase/app';
import { userRepository } from '@features/auth/data/userRepository';
import AvatarView from '@features/avatar/components/AvatarView';
import { SelectorColor, SelectorPersonaje } from '@features/avatar/components/Selectores';
import {
  AVATAR_POR_DEFECTO,
  muestrasPelo,
  muestrasPiel,
  personajePorId,
  type AvatarConfig,
} from '@features/avatar/domain/catalogo';
import LeccionScreen, { type ResultadoLeccion } from '@features/learning/screens/LeccionScreen';
import FinLeccion from '@features/orbita/components/FinLeccion';
import StreakCelebration from '@features/learning/components/StreakCelebration';
import { SelectorMeta } from '@features/orbita/components/PuenteDeMando';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { refrescarAvisos } from '@features/orbita/hooks/useOrbita';
import { pedirPermisoAvisos } from '@features/orbita/data/avisosCeti';
import { eventos } from '@features/orbita/data/eventos';
import { PRIMER_VUELO } from '@features/orbita/data/primerVuelo';
import { HORA_MAX, HORA_MIN, HORA_POR_DEFECTO } from '@features/orbita/domain/avisos';
import type { MetaDiaria } from '@features/orbita/domain/progreso';
import type { RecompensaPractica } from '@features/orbita/domain/orbita';

const PASO = { nombre: 0, tripulante: 1, meta: 2, hora: 3, vuelo: 4, bienvenida: 5 } as const;
const PASOS = 6;

/** Mismo id de juego que useUidJuego: uid de Firebase o id local (se crea si aún no hay). */
function resolverUid(): string {
  if (isFirebaseConfigured()) return getFirebaseClients()?.auth.currentUser?.uid ?? '';
  const id = useUserStore.getState().id;
  if (id) return id;
  const nuevo = `user_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  useUserStore.setState({ id: nuevo });
  return nuevo;
}

export default function UserSetupScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const setProfile = useUserStore((s) => s.setProfile);
  const colors = useThemeColors();

  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState<AvatarConfig>(AVATAR_POR_DEFECTO);
  const [error, setError] = useState('');
  const [finishing, setFinishing] = useState(false);
  const [meta, setMeta] = useState<MetaDiaria>('crucero');
  const [hora, setHora] = useState(HORA_POR_DEFECTO);
  const [avisos, setAvisos] = useState<'pendiente' | 'pidiendo' | 'activos' | 'no'>('pendiente');
  const [fin, setFin] = useState<{ r: RecompensaPractica; res: ResultadoLeccion } | null>(null);
  const [celebrando, setCelebrando] = useState(false);

  const canAdvance = useCallback(() => {
    if (step === PASO.nombre) return name.trim().length >= 2;
    return avisos !== 'pidiendo';
  }, [step, name, avisos]);

  const handleNext = () => {
    if (!canAdvance() || step >= PASO.bienvenida) return;
    if (step === PASO.meta) eventos.metaElegida({ meta });
    if (step === PASO.hora) eventos.avisosConfigurados({ activos: avisos === 'activos', hora });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setError('');
    setStep(step + 1);
  };

  const formatoHora = (h: number) =>
    h < 12
      ? t('orbita.onboarding.horaAm', { h })
      : h === 12
        ? t('orbita.onboarding.horaMediodia')
        : t('orbita.onboarding.horaPm', { h: h - 12 });

  const cambiarHora = (delta: number) => {
    const nueva = Math.min(HORA_MAX, Math.max(HORA_MIN, hora + delta));
    if (nueva === hora) return;
    Haptics.selectionAsync();
    setHora(nueva);
  };

  const activarAvisos = async () => {
    setAvisos('pidiendo');
    const ok = await pedirPermisoAvisos();
    setAvisos(ok ? 'activos' : 'no');
  };

  /** Guarda meta, hora y avisos en Órbita. Devuelve el uid de juego ('' si no hay sesión). */
  const guardarAjustes = () => {
    const uid = resolverUid();
    if (uid) {
      useOrbitaStore.getState().configurar(uid, { meta, horaAviso: hora, avisos: avisos === 'activos' });
    }
    return uid;
  };

  const terminarPrimerVuelo = (res: ResultadoLeccion) => {
    const uid = guardarAjustes();
    if (!uid) {
      setStep(PASO.bienvenida);
      return;
    }
    const r = useOrbitaStore.getState().completar(uid, {
      tipo: 'primer_vuelo',
      xpRespuestas: res.xpRespuestas,
      perfecta: res.perfecta,
    });
    setFin({ r, res });
    // El primer vuelo prende la racha: primero se celebra y después el resumen.
    if (r.primeroHoy || r.reparada || r.hito) setCelebrando(true);
  };

  const saltarPrimerVuelo = () => {
    guardarAjustes();
    setStep(PASO.bienvenida);
  };

  const finishSetup = async () => {
    const nickname = name.trim();

    setProfile(nickname, nickname, avatar);

    if (isFirebaseConfigured()) {
      const u = getFirebaseClients()?.auth.currentUser;
      if (!u) {
        setError(t('onboarding.sessionExpired'));
        router.replace('/(auth)/welcome');
        return;
      }
      setFinishing(true);
      try {
        useUserStore.getState().loadProfile({ id: u.uid });
        await userRepository.upsertProfile(u.uid, {
          displayName: nickname,
          email: u.email ?? null,
          photoURL: u.photoURL ?? null,
          provider: u.providerData?.some((p) => p.providerId?.includes('google'))
            ? 'google'
            : u.providerData?.some((p) => p.providerId?.includes('apple'))
              ? 'apple'
              : 'unknown',
          profile: {
            nickname,
            fullName: nickname,
            avatarId: avatar.personaje,
            avatarEmoji: '',
            avatar,
          },
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : t('onboarding.saveError'));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setFinishing(false);
        return;
      }
      setFinishing(false);
    }

    void logEvent('user_setup_complete', {});
    useAuthStore.getState().login();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/');
    const uid = resolverUid();
    if (uid) refrescarAvisos(useOrbitaStore.getState().porUid[uid]);
  };

  if (step === PASO.vuelo) {
    if (fin && celebrando) {
      return (
        <View style={styles.esperaRacha}>
          <StreakCelebration
            racha={fin.r.racha}
            hito={fin.r.hito}
            reparada={fin.r.reparada}
            visible
            onClose={() => setCelebrando(false)}
          />
        </View>
      );
    }
    if (fin) {
      return (
        <FinLeccion
          recompensa={fin.r}
          modo="primer_vuelo"
          titulo={t('orbita.onboarding.primerVuelo')}
          color={colors.brand.primary}
          aciertos={fin.res.acertadasALaPrimera}
          total={fin.res.total}
          onContinuar={() => setStep(PASO.bienvenida)}
        />
      );
    }
    return (
      <LeccionScreen
        items={PRIMER_VUELO}
        modo="primer_vuelo"
        titulo={t('orbita.onboarding.primerVuelo')}
        color={colors.brand.primary}
        mundo="onboarding"
        onSalir={saltarPrimerVuelo}
        onTerminar={terminarPrimerVuelo}
      />
    );
  }

  return (
    <ScreenWrapper style={styles.container}>
      <View style={styles.progressContainer}>
        {Array.from({ length: PASOS }, (_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              { backgroundColor: i <= step ? colors.brand.primary : colors.materials.highlight },
              i === step && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === PASO.nombre && (
          <Animated.View
            key="name"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <PageHeader
              overline={t('onboarding.stepNameOverline')}
              title={t('onboarding.stepNameTitle')}
              subtitle={t('onboarding.stepNameSubtitle')}
              style={{ alignItems: 'center' }}
            />
            <TextInput
              style={[
                styles.input,
                Typography.headline,
                {
                  color: colors.text.primary,
                  borderColor: colors.materials.border,
                  backgroundColor: colors.materials.highlight,
                },
              ]}
              placeholder={t('onboarding.namePlaceholder')}
              placeholderTextColor={colors.text.tertiary}
              value={name}
              onChangeText={setName}
              maxLength={30}
              autoFocus
            />
          </Animated.View>
        )}

        {step === PASO.tripulante && (
          <Animated.View
            key="avatar"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <PageHeader
              overline={t('onboarding.stepAvatarOverline')}
              title={t('onboarding.stepAvatarTitle')}
              subtitle={t('onboarding.stepAvatarSubtitle')}
              style={{ alignItems: 'center' }}
            />
            <View style={[styles.escenario, { backgroundColor: colors.materials.base }]}>
              <View style={[styles.halo, { backgroundColor: colors.fill.brandSubtle }]} />
              <AvatarView config={avatar} size={112} />
              <Text style={[styles.rol, { color: colors.text.secondary }]}>
                {t(`avatar.rol.${personajePorId(avatar.personaje).rol}`)}
              </Text>
            </View>
            <View style={styles.selectores}>
              <SelectorPersonaje
                config={avatar}
                onChange={(personaje) => setAvatar((a) => ({ ...a, personaje }))}
              />
              <SelectorColor
                titulo={t('avatar.tonoPiel')}
                opciones={muestrasPiel(avatar)}
                valor={avatar.tono}
                onChange={(tono) => setAvatar((a) => ({ ...a, tono }))}
                etiqueta={(id) => t(`avatar.tono.${id}`)}
              />
              <SelectorColor
                titulo={t('avatar.colorPelo')}
                opciones={muestrasPelo(avatar)}
                valor={avatar.pelo}
                onChange={(pelo) => setAvatar((a) => ({ ...a, pelo }))}
                etiqueta={(id) => t(`avatar.pelo.${id}`)}
              />
            </View>
          </Animated.View>
        )}

        {step === PASO.meta && (
          <Animated.View
            key="meta"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <PageHeader
              overline={t('orbita.onboarding.metaOverline')}
              title={t('orbita.onboarding.metaTitulo')}
              subtitle={t('orbita.onboarding.metaSubtitulo')}
              style={{ alignItems: 'center' }}
            />
            <View style={styles.bloque}>
              <SelectorMeta valor={meta} onElegir={setMeta} />
            </View>
          </Animated.View>
        )}

        {step === PASO.hora && (
          <Animated.View
            key="hora"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <PageHeader
              overline={t('orbita.onboarding.horaOverline')}
              title={t('orbita.onboarding.horaTitulo')}
              subtitle={t('orbita.onboarding.horaSubtitulo')}
              style={{ alignItems: 'center' }}
            />
            <View style={[styles.reloj, { backgroundColor: colors.materials.highlight }]}>
              <TouchableOpacity
                onPress={() => cambiarHora(-1)}
                disabled={hora <= HORA_MIN}
                accessibilityRole="button"
                accessibilityLabel={t('orbita.onboarding.horaMenos')}
                style={[styles.relojBoton, { borderColor: colors.materials.border, opacity: hora <= HORA_MIN ? 0.35 : 1 }]}
              >
                <Ionicons name="remove" size={24} color={colors.text.primary} />
              </TouchableOpacity>
              <Text style={[styles.relojHora, { color: colors.text.primary }]} accessibilityLiveRegion="polite">
                {formatoHora(hora)}
              </Text>
              <TouchableOpacity
                onPress={() => cambiarHora(1)}
                disabled={hora >= HORA_MAX}
                accessibilityRole="button"
                accessibilityLabel={t('orbita.onboarding.horaMas')}
                style={[styles.relojBoton, { borderColor: colors.materials.border, opacity: hora >= HORA_MAX ? 0.35 : 1 }]}
              >
                <Ionicons name="add" size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <View style={styles.bloque}>
              {avisos === 'activos' ? (
                <View style={[styles.avisosOk, { backgroundColor: colors.fill.brandSubtle }]}>
                  <Ionicons name="notifications" size={18} color={colors.brand.primary} />
                  <Text style={[styles.avisosOkTexto, { color: colors.text.primary }]}>
                    {t('orbita.onboarding.avisosActivos', { hora: formatoHora(hora) })}
                  </Text>
                </View>
              ) : (
                <CetiButton
                  label={t('orbita.onboarding.activarAvisos')}
                  onPress={() => void activarAvisos()}
                  isLoading={avisos === 'pidiendo'}
                  variant="secondary"
                  icon="notifications-outline"
                  style={{ width: '100%' }}
                />
              )}
              {avisos === 'no' && (
                <Text style={[styles.nota, { color: colors.text.secondary }]}>
                  {t('orbita.onboarding.avisosNo')}
                </Text>
              )}
              <Text style={[styles.nota, { color: colors.text.tertiary }]}>
                {t('orbita.onboarding.avisosRegla')}
              </Text>
            </View>
          </Animated.View>
        )}

        {step === PASO.bienvenida && (
          <Animated.View
            key="welcome"
            entering={motion.stepEnter}
            exiting={motion.stepExit}
            style={styles.stepContainer}
          >
            <PageHeader
              overline={t('onboarding.stepWelcomeOverline')}
              title={t('onboarding.stepWelcomeTitle')}
              subtitle={t('onboarding.stepWelcomeSubtitle')}
              style={{ alignItems: 'center' }}
            />
            <View
              style={[
                styles.finalAvatarContainer,
                {
                  backgroundColor: colors.materials.highlight,
                  borderColor: colors.materials.border,
                },
              ]}
            >
              <AvatarView config={avatar} encuadre="retrato" size={116} />
            </View>
          </Animated.View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        {error !== '' && (
          <Text style={[styles.errorText, { color: colors.system.red }]}>{error}</Text>
        )}
        {step <= PASO.bienvenida && (
          <CetiButton
            label={
              step === PASO.bienvenida
                ? t('onboarding.start')
                : step === PASO.hora
                  ? t('orbita.onboarding.despegar')
                  : t('onboarding.next')
            }
            onPress={step === PASO.bienvenida ? () => void finishSetup() : handleNext}
            disabled={!canAdvance() || finishing}
            variant="primary"
            size="large"
            style={{ width: '100%' }}
            isLoading={finishing}
          />
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 80 },
  esperaRacha: { flex: 1, backgroundColor: '#0E0F13' },
  progressContainer: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 },
  progressDot: { width: 10, height: 10, borderRadius: 5 },
  progressDotActive: { width: 24 },
  content: { flexGrow: 1, paddingHorizontal: Spacing.base },
  stepContainer: { alignItems: 'center', paddingTop: 20 },
  input: {
    width: '100%',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    textAlign: 'center',
    borderWidth: 1,
  },
  escenario: {
    width: '100%',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderRadius: 28,
    alignItems: 'center',
    overflow: 'hidden',
  },
  halo: { position: 'absolute', bottom: 18, width: 104, height: 104, borderRadius: 52 },
  rol: { ...Typography.subheadline, fontWeight: '700', marginTop: 4 },
  selectores: { width: '100%', gap: Spacing.sm, marginTop: Spacing.sm },
  finalAvatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
    borderWidth: 1,
  },
  bloque: { width: '100%', gap: Spacing.sm, marginTop: Spacing.lg },
  reloj: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: Spacing.lg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.xl,
  },
  relojBoton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  relojHora: { ...Typography.title1, fontWeight: '900', fontVariant: ['tabular-nums'] },
  avisosOk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  avisosOkTexto: { ...Typography.subheadline, fontWeight: '700', flex: 1 },
  nota: { ...Typography.footnote, textAlign: 'center' },
  footer: { paddingHorizontal: Spacing.base, paddingBottom: 50 },
  errorText: {
    ...Typography.caption1,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
});
