import { useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@shared/constants/typography';
import { BorderRadius } from '@shared/constants/theme';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import {
  useCetiOverlayStore,
  CetiNoticeVariant,
  CetiToastPayload,
} from '@shared/store/useCetiOverlayStore';

// Las animaciones `exiting` de reanimated dejan overlays fantasma en web que
// tragan taps (ver ScreenWrapper). Las desactivamos en web.
const isWeb = Platform.OS === 'web';

type Colors = ReturnType<typeof useThemeColors>;

function toastIcon(variant: CetiNoticeVariant): keyof typeof Ionicons.glyphMap {
  switch (variant) {
    case 'success':
      return 'checkmark-circle';
    case 'error':
      return 'alert-circle';
    default:
      return 'information-circle';
  }
}

function toastAccent(variant: CetiNoticeVariant, colors: Colors): string {
  switch (variant) {
    case 'success':
      return colors.system.green;
    case 'error':
      return colors.system.red;
    default:
      return colors.brand.primary;
  }
}

function toastFill(variant: CetiNoticeVariant, colors: Colors): string {
  switch (variant) {
    case 'success':
      return colors.fill.greenSubtle;
    case 'error':
      return colors.fill.redSubtle;
    default:
      return colors.fill.brandSubtle;
  }
}

function ToastCard({ toast }: { toast: CetiToastPayload }) {
  const colors = useThemeColors();
  const dismiss = useCetiOverlayStore((s) => s.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast.id, toast.durationMs, dismiss]);

  return (
    <Animated.View
      entering={isWeb ? undefined : FadeIn.duration(160)}
      exiting={isWeb ? undefined : FadeOut.duration(140)}
      style={styles.cardWrap}
      pointerEvents="box-none"
    >
      <Pressable
        onPress={() => dismiss(toast.id)}
        accessibilityRole="alert"
        accessibilityLabel={toast.message ? `${toast.title}. ${toast.message}` : toast.title}
        style={[
          styles.card,
          { backgroundColor: colors.background.elevated, borderColor: colors.materials.border },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: toastFill(toast.variant, colors) }]}>
          <Ionicons
            name={toastIcon(toast.variant)}
            size={20}
            color={toastAccent(toast.variant, colors)}
          />
        </View>
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={2}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text style={[styles.message, { color: colors.text.secondary }]} numberOfLines={3}>
              {toast.message}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Toasts globales de Ceti (no bloqueantes, auto-descarte). Se dispara con
 * `showCetiToast` desde `@shared/store/useCetiOverlayStore`. Montado en
 * `CetiOverlayHost`. `box-none` deja pasar los taps que no caen sobre una tarjeta.
 */
export default function CetiToastHost() {
  const insets = useSafeAreaInsets();
  const toasts = useCetiOverlayStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <View style={[styles.host, { top: insets.top + 8 }]} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    zIndex: 9999,
  },
  cardWrap: {
    width: '100%',
    maxWidth: 460,
    alignItems: 'stretch',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...Typography.footnote,
    fontWeight: '700',
  },
  message: {
    ...Typography.caption1,
    fontWeight: '400',
  },
});
