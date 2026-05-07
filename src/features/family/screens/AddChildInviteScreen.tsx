import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Share, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { Spacing, BorderRadius } from '@shared/constants/theme';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { invitationService } from '@shared/lib/firebase/invitationService';
import { useParentStore } from '@features/family/store/useParentStore';
import { callSyncUserClaims } from '@shared/lib/firebase/cloudFunctions';

export default function AddChildInviteScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);
  const familyId = useParentStore((s) => s.familyId);

  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      setError('');
      const u = getFirebaseClients()?.auth.currentUser;
      const fid = familyId || u?.uid;
      if (!u || !fid) {
        setError('Inicia sesión como padre para generar un código.');
        setBusy(false);
        return;
      }
      try {
        try {
          await callSyncUserClaims();
          await u.getIdToken(true);
        } catch {
          /* sigue intentando crear invitación */
        }
        const c = await invitationService.generateChildLinkCode(fid, u.uid);
        if (!cancelled) setCode(c);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo crear la invitación';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [familyId]);

  const onShare = async () => {
    if (!code) return;
    try {
      await Share.share({
        message: `Únete a mi familia en Ceti con este código: ${code}`,
        title: 'Invitación Ceti',
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  return (
    <ScreenWrapper style={styles.root}>
      <View style={styles.content}>
        <PageHeader
          overline="Familia"
          title="Invitar a un hijo"
          subtitle="Tu hijo debe instalar Ceti, iniciar sesión con su cuenta y elegir «Niño o niña». Luego introduce este código."
          style={{ marginBottom: Spacing.xl }}
        />

        {busy ? <Text style={{ color: colors.text.secondary }}>Generando código…</Text> : null}

        {error ? <Text style={[styles.error, { color: colors.system.red }]}>{error}</Text> : null}

        {code ? (
          <>
            <View
              style={[
                styles.codeCard,
                { backgroundColor: colors.materials.base, borderColor: colors.materials.border },
              ]}
            >
              <Text selectable style={[styles.codeText, { color: colors.text.primary }]}>
                {code}
              </Text>
              <Text style={[styles.hint, { color: colors.text.tertiary }]}>
                Caduca en 7 días. Un solo uso.
              </Text>
            </View>

            <View style={styles.qrWrap}>
              <QRCode
                value={code}
                size={180}
                backgroundColor={colors.materials.base}
                color={colors.text.primary}
              />
            </View>

            <CetiButton
              label="Compartir código"
              onPress={() => void onShare()}
              variant="primary"
              size="large"
            />
            <CetiButton
              label="Listo"
              onPress={() => router.back()}
              variant="ghost"
              size="medium"
              style={{ marginTop: Spacing.md }}
            />
          </>
        ) : null}
      </View>
    </ScreenWrapper>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>, _mode: string) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background.base },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.OS === 'ios' ? 56 : 40,
      paddingBottom: Spacing['2xl'],
      gap: Spacing.md,
    },
    codeCard: {
      borderWidth: 1,
      borderRadius: BorderRadius.xl,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    codeText: {
      ...Typography.largeTitle,
      fontWeight: '900',
      letterSpacing: 4,
    },
    hint: {
      ...Typography.caption1,
      textAlign: 'center',
    },
    qrWrap: {
      alignItems: 'center',
      paddingVertical: Spacing.lg,
    },
    error: {
      ...Typography.body,
      fontWeight: '600',
    },
  });
