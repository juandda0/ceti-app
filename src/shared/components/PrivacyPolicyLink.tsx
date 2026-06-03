import { Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as WebBrowser from 'expo-web-browser';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { PRIVACY_POLICY_URL, hasPrivacyPolicy } from '@shared/constants/legal';

/**
 * In-app link to the data-treatment policy (Ley 1581). Renders nothing if no
 * policy URL is configured, so screens can include it unconditionally.
 */
export default function PrivacyPolicyLink({ style }: { style?: StyleProp<ViewStyle> }) {
  const { t } = useTranslation();
  const colors = useThemeColors();

  if (!hasPrivacyPolicy()) return null;

  return (
    <TouchableOpacity
      style={style}
      accessibilityRole="link"
      onPress={() => void WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)}
    >
      <Text style={[styles.text, { color: colors.text.secondary }]}>
        {t('legal.privacyPolicy')}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13, textDecorationLine: 'underline', textAlign: 'center' },
});
