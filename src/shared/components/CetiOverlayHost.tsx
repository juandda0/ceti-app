import { Modal, View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CetiButton from '@shared/components/CetiButton';
import { Typography } from '@shared/constants/typography';
import { BorderRadius } from '@shared/constants/theme';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { useCetiOverlayStore, CetiNoticeVariant } from '@shared/store/useCetiOverlayStore';

function noticeIcon(variant: CetiNoticeVariant): keyof typeof Ionicons.glyphMap {
  switch (variant) {
    case 'success':
      return 'checkmark-circle';
    case 'error':
      return 'alert-circle';
    default:
      return 'information-circle';
  }
}

function noticeAccent(
  variant: CetiNoticeVariant,
  colors: ReturnType<typeof useThemeColors>
): string {
  switch (variant) {
    case 'success':
      return colors.system.green;
    case 'error':
      return colors.system.red;
    default:
      return colors.brand.primary;
  }
}

/**
 * Pantallas globales: confirmaciones en bottom sheet y avisos en modal centrado con icono.
 * Usar `showCetiConfirm` / `showCetiNotice` desde `@shared/store/useCetiOverlayStore`.
 */
export default function CetiOverlayHost() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  const confirm = useCetiOverlayStore((s) => s.confirm);
  const notice = useCetiOverlayStore((s) => s.notice);
  const dismissConfirm = useCetiOverlayStore((s) => s.dismissConfirm);
  const dismissNotice = useCetiOverlayStore((s) => s.dismissNotice);

  return (
    <>
      <Modal
        visible={!!confirm}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={dismissConfirm}
      >
        <Pressable
          style={[styles.confirmBackdrop, { backgroundColor: colors.overlay.modalBackdrop }]}
          onPress={dismissConfirm}
        >
          <Pressable
            style={[
              styles.confirmSheet,
              {
                backgroundColor: colors.background.primary,
                borderColor: colors.materials.border,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.sheetHandle, { backgroundColor: colors.materials.border }]} />
            <Text style={[styles.confirmTitle, { color: colors.text.primary }]}>
              {confirm?.title}
            </Text>
            {confirm?.message ? (
              <Text style={[styles.confirmMessage, { color: colors.text.secondary }]}>
                {confirm.message}
              </Text>
            ) : null}
            <View style={styles.confirmRow}>
              <CetiButton
                label={confirm?.cancelLabel ?? 'Cancelar'}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  dismissConfirm();
                }}
                variant="glass"
                size="medium"
                style={styles.flex}
              />
              <CetiButton
                label={confirm?.confirmLabel ?? 'Continuar'}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                    () => undefined
                  );
                  const c = useCetiOverlayStore.getState().confirm;
                  if (!c) return;
                  useCetiOverlayStore.getState().dismissConfirm();
                  c.onConfirm();
                }}
                variant={confirm?.destructive ? 'destructive' : 'primary'}
                size="medium"
                style={styles.flex}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={!!notice}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissNotice}
      >
        <Pressable
          style={[styles.noticeBackdrop, { backgroundColor: colors.overlay.modalBackdrop }]}
          onPress={dismissNotice}
        >
          <Pressable
            style={[
              styles.noticeCard,
              {
                backgroundColor: colors.background.elevated,
                borderColor: colors.materials.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            {notice ? (
              <>
                <View
                  style={[
                    styles.noticeIconWrap,
                    {
                      backgroundColor:
                        notice.variant === 'success'
                          ? colors.fill.greenSubtle
                          : notice.variant === 'error'
                            ? colors.fill.redSubtle
                            : colors.fill.brandSubtle,
                    },
                  ]}
                >
                  <Ionicons
                    name={noticeIcon(notice.variant)}
                    size={40}
                    color={noticeAccent(notice.variant, colors)}
                  />
                </View>
                <Text style={[styles.noticeTitle, { color: colors.text.primary }]}>
                  {notice.title}
                </Text>
                {notice.message ? (
                  <Text style={[styles.noticeMessage, { color: colors.text.secondary }]}>
                    {notice.message}
                  </Text>
                ) : null}
                <CetiButton
                  label="Entendido"
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    const n = useCetiOverlayStore.getState().notice;
                    dismissNotice();
                    n?.onDismiss?.();
                  }}
                  variant="primary"
                  size="medium"
                  style={styles.noticeBtn}
                />
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  confirmBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  confirmSheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: 24,
    paddingTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.85,
  },
  confirmTitle: {
    ...Typography.title2,
    fontWeight: '800',
    marginBottom: 8,
  },
  confirmMessage: {
    ...Typography.body,
    marginBottom: 22,
    lineHeight: 22,
  },
  confirmRow: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: { flex: 1 },

  noticeBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    alignItems: 'stretch',
  },
  noticeCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: 26,
    alignItems: 'center',
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  noticeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  noticeTitle: {
    ...Typography.title3,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  noticeMessage: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  noticeBtn: {
    width: '100%',
  },
});
