/**
 * Botón "volver" estándar. El Stack corre con `headerShown:false`, así que cada
 * pantalla empujada dibuja el suyo. Vuelve con `router.back()`; si no hay
 * historial (deep-link directo en web) usa `fallback`.
 */
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function BackButton({
  fallback,
  color,
  style,
}: {
  fallback?: Href;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useThemeColors();

  const onPress = () => {
    if (router.canGoBack()) router.back();
    else if (fallback) router.replace(fallback);
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('common.back')}
      hitSlop={10}
      style={[styles.btn, style]}
    >
      <Ionicons name="arrow-back" size={22} color={color ?? colors.text.secondary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { alignSelf: 'flex-start', padding: 4 },
});
