import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { normalizeClassCode } from '@features/dashboard/data/classCode';

type ClassCodeFormProps = {
  initialCode?: string;
  autoSubmit?: boolean;
  onJoin: (code: string) => Promise<void>;
  onSkip?: () => Promise<void>;
};

export default function ClassCodeForm({
  initialCode = '',
  autoSubmit = false,
  onJoin,
  onSkip,
}: ClassCodeFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [code, setCode] = useState(() => normalizeClassCode(initialCode));
  const [busy, setBusy] = useState(false);
  const autoSubmitted = useRef(false);

  const submit = useCallback(
    async (value: string) => {
      const normalized = normalizeClassCode(value);
      if (!normalized) return;

      setBusy(true);
      try {
        await onJoin(normalized);
      } catch (error) {
        showMessage(
          t('join.errorTitle'),
          error instanceof Error ? error.message : String(error),
          'error'
        );
      } finally {
        setBusy(false);
      }
    },
    [onJoin, t]
  );

  useEffect(() => {
    if (!autoSubmit || autoSubmitted.current || !initialCode.trim()) return;
    autoSubmitted.current = true;
    void submit(initialCode);
  }, [autoSubmit, initialCode, submit]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text.primary }]}>{t('join.title')}</Text>
      <Text style={[styles.hint, { color: colors.text.secondary }]}>{t('join.hint')}</Text>
      <TextInput
        testID="class-code-input"
        style={[
          styles.input,
          {
            backgroundColor: colors.background.secondary,
            color: colors.text.primary,
            borderColor: colors.materials.border,
          },
        ]}
        placeholder={t('join.placeholder')}
        placeholderTextColor={colors.text.quaternary}
        autoCapitalize="characters"
        autoCorrect={false}
        value={code}
        onChangeText={setCode}
        editable={!busy}
        onSubmitEditing={() => void submit(code)}
      />
      <TouchableOpacity
        testID="class-code-submit"
        style={[
          styles.button,
          { backgroundColor: colors.brand.primary, opacity: busy || !code.trim() ? 0.6 : 1 },
        ]}
        onPress={() => void submit(code)}
        disabled={busy || !code.trim()}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t('join.cta')}</Text>
        )}
      </TouchableOpacity>
      {onSkip && (
        <TouchableOpacity
          testID="class-code-skip"
          onPress={() => void onSkip()}
          disabled={busy}
          accessibilityRole="button"
          style={styles.skip}
        >
          <Text style={[styles.skipText, { color: colors.text.tertiary }]}>Ahora no</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 12 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  hint: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    letterSpacing: 2,
    textAlign: 'center',
  },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  skip: { alignSelf: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14, fontWeight: '600' },
});
