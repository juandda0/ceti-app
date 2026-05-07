import {
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Typography } from '@shared/constants/typography';
import { BorderRadius } from '@shared/constants/theme';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export interface CetiBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Ignorado si `contentOnly`: usa solo `children`. */
  title?: string;
  subtitle?: string;
  children: ReactNode;
  closeOnBackdropPress?: boolean;
  /** Solo panel inferior + children (sin manija ni títulos). */
  contentOnly?: boolean;
}

/**
 * Bottom sheet estándar Ceti: manija, fondo, radios y safe area inferior.
 */
export default function CetiBottomSheet({
  visible,
  onClose,
  title = '',
  subtitle,
  children,
  closeOnBackdropPress = false,
  contentOnly = false,
}: CetiBottomSheetProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        style={styles.keyboardRoot}
      >
        <View style={[styles.root, { backgroundColor: colors.overlay.modalBackdrop }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => closeOnBackdropPress && onClose()}
            accessibilityLabel="Cerrar panel"
          />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background.primary,
                borderColor: colors.materials.border,
                paddingBottom: Math.max(insets.bottom, 22),
                paddingTop: contentOnly ? 18 : 12,
              },
            ]}
          >
            {contentOnly ? null : (
              <>
                <View style={[styles.dragHandle, { backgroundColor: colors.materials.border }]} />
                <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                    {subtitle}
                  </Text>
                ) : null}
              </>
            )}
            <View style={[styles.children, contentOnly && styles.childrenContentOnly]}>
              {children}
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'stretch',
  },
  sheet: {
    width: '100%',
    alignSelf: 'stretch',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 24,
    paddingTop: 12,
    maxHeight: '92%',
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.85,
  },
  title: {
    ...Typography.title2,
    fontWeight: '800',
    marginBottom: 6,
  },
  subtitle: {
    ...Typography.subheadline,
    marginBottom: 16,
  },
  children: {
    gap: 12,
    paddingBottom: 6,
  },
  childrenContentOnly: {
    paddingTop: 8,
  },
});
