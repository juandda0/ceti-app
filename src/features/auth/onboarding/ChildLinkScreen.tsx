import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Typography } from '@shared/constants/typography';
import { BorderRadius, Spacing } from '@shared/constants/theme';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import PageHeader from '@shared/components/PageHeader';
import CetiButton from '@shared/components/CetiButton';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useThemeStore } from '@shared/store/useThemeStore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callRedeemInvitation, callSyncUserClaims } from '@shared/lib/firebase/cloudFunctions';
import { useAuthStore } from '@features/auth/store/useAuthStore';

function normalizeCode(raw: string): string {
  return raw.replace(/\s/g, '').toUpperCase();
}

export default function ChildLinkScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const mode = useThemeStore((s) => s.mode);
  const styles = getStyles(colors, mode);
  const { setLinkedFamilyId, loginAsChild } = useAuthStore();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async () => {
    const normalized = normalizeCode(code);
    if (normalized.length < 6) {
      setError('Escribe el código que te dio tu padre o madre.');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { familyId } = await callRedeemInvitation(normalized);
      setLinkedFamilyId(familyId);
      const u = getFirebaseClients()?.auth.currentUser;
      if (u) {
        try {
          await callSyncUserClaims();
          await u.getIdToken(true);
        } catch {
          /* claims pueden llegar en el siguiente arranque */
        }
      }
      loginAsChild();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(child)/world');
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === 'object' && e !== null && 'message' in e
            ? String((e as { message: string }).message)
            : 'No se pudo canjear el código';
      setError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenWrapper style={styles.root}>
      <View style={styles.content}>
        <PageHeader
          overline="Familia"
          title="Enlaza tu cuenta"
          subtitle="Pide a tu padre o madre el código de invitación (formato CETI-XXXX) y pégalo aquí."
          style={{ marginBottom: Spacing.xl }}
        />

        <Text style={[styles.label, { color: colors.text.secondary }]}>Código</Text>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(normalizeCode(t))}
          placeholder="CETI-XXXX"
          placeholderTextColor={colors.text.tertiary}
          autoCapitalize="characters"
          autoCorrect={false}
          style={[
            styles.input,
            {
              backgroundColor: colors.materials.highlight,
              color: colors.text.primary,
              borderColor: colors.materials.border,
            },
          ]}
        />

        {error ? <Text style={[styles.error, { color: colors.system.red }]}>{error}</Text> : null}

        <CetiButton
          label={busy ? 'Uniendo…' : 'Unirme a la familia'}
          onPress={() => void onSubmit()}
          variant="primary"
          size="large"
          disabled={busy}
          isLoading={busy}
          style={{ marginTop: Spacing.lg }}
        />

        <CetiButton
          label="Volver"
          onPress={() => router.back()}
          variant="ghost"
          size="medium"
          style={{ marginTop: Spacing.md }}
        />
      </View>
    </ScreenWrapper>
  );
}

const getStyles = (colors: ReturnType<typeof useThemeColors>, _mode: string) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background.base,
    },
    content: {
      flex: 1,
      paddingHorizontal: Spacing.xl,
      paddingTop: Platform.OS === 'ios' ? 72 : 56,
      paddingBottom: Spacing['2xl'],
    },
    label: {
      ...Typography.caption1,
      fontWeight: '700',
      marginBottom: 8,
    },
    input: {
      borderWidth: 1,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.base,
      ...Typography.title3,
      letterSpacing: 2,
    },
    error: {
      ...Typography.caption1,
      marginTop: Spacing.sm,
      fontWeight: '600',
    },
  });
