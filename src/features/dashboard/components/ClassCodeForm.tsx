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
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import {
  NOMBRE_COMPLETO_MAX,
  limpiarNombreCompleto,
  normalizeClassCode,
} from '@features/dashboard/data/classCode';
import LectorQrClase from '@features/dashboard/components/LectorQrClase';

type ClassCodeFormProps = {
  initialCode?: string;
  /** Pre-fills the full name (from the profile); the student can fix it. */
  nombreInicial?: string;
  /** Joins on its own once there is a code and a valid full name (invite link). */
  autoSubmit?: boolean;
  onJoin: (code: string, nombreCompleto: string) => Promise<void>;
  onSkip?: () => Promise<void>;
  /** The screen already shows its own title and hint. */
  sinEncabezado?: boolean;
};

/**
 * Unirse a una clase: el código (escrito o leído del QR) y el nombre completo,
 * que es como el profe ve al estudiante en su lista.
 */
export default function ClassCodeForm({
  initialCode = '',
  nombreInicial = '',
  autoSubmit = false,
  onJoin,
  onSkip,
  sinEncabezado = false,
}: ClassCodeFormProps) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const [code, setCode] = useState(() => normalizeClassCode(initialCode));
  const [nombre, setNombre] = useState(nombreInicial);
  const [busy, setBusy] = useState(false);
  const [lector, setLector] = useState(false);
  const autoSubmitted = useRef(false);

  const nombreValido = limpiarNombreCompleto(nombre);
  const listo = normalizeClassCode(code).length > 0 && nombreValido !== null;

  const submit = useCallback(
    async (value: string, nombreCompleto: string | null) => {
      const normalized = normalizeClassCode(value);
      if (!normalized) return;
      if (!nombreCompleto) {
        showMessage(t('miClase.nombreFalta'), t('miClase.nombreAyuda'), 'error');
        return;
      }

      setBusy(true);
      try {
        await onJoin(normalized, nombreCompleto);
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
    const n = limpiarNombreCompleto(nombreInicial);
    if (!n) return;
    autoSubmitted.current = true;
    void submit(initialCode, n);
  }, [autoSubmit, initialCode, nombreInicial, submit]);

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.background.secondary,
      color: colors.text.primary,
      borderColor: colors.materials.border,
    },
  ];

  return (
    <View style={styles.wrap}>
      {sinEncabezado ? null : (
        <>
          <Text style={[styles.title, { color: colors.text.primary }]}>{t('join.title')}</Text>
          <Text style={[styles.hint, { color: colors.text.secondary }]}>{t('join.hint')}</Text>
        </>
      )}

      <Text style={[styles.label, { color: colors.text.secondary }]}>{t('miClase.codigo')}</Text>
      <View style={styles.codeRow}>
        <TextInput
          testID="class-code-input"
          style={[inputStyle, styles.code]}
          placeholder={t('join.placeholder')}
          placeholderTextColor={colors.text.quaternary}
          autoCapitalize="characters"
          autoCorrect={false}
          value={code}
          onChangeText={setCode}
          editable={!busy}
          maxLength={12}
        />
        <TouchableOpacity
          testID="class-code-qr"
          onPress={() => setLector(true)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={t('miClase.qrEscanear')}
          style={[
            styles.qr,
            { backgroundColor: colors.fill.brandSubtle, borderColor: colors.brand.primary },
          ]}
        >
          <Ionicons name="qr-code" size={24} color={colors.brand.primary} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.label, { color: colors.text.secondary }]}>
        {t('miClase.nombreCompleto')}
      </Text>
      <TextInput
        testID="class-full-name-input"
        style={[inputStyle, styles.nombre]}
        placeholder={t('miClase.nombrePlaceholder')}
        placeholderTextColor={colors.text.quaternary}
        autoCapitalize="words"
        autoComplete="name"
        value={nombre}
        onChangeText={setNombre}
        editable={!busy}
        maxLength={NOMBRE_COMPLETO_MAX}
        onSubmitEditing={() => void submit(code, nombreValido)}
      />
      <Text style={[styles.small, { color: colors.text.tertiary }]}>
        {t('miClase.nombreAyuda')}
      </Text>

      <TouchableOpacity
        testID="class-code-submit"
        style={[
          styles.button,
          { backgroundColor: colors.brand.primary, opacity: busy || !listo ? 0.6 : 1 },
        ]}
        onPress={() => void submit(code, nombreValido)}
        disabled={busy || !listo}
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

      <LectorQrClase
        visible={lector}
        onCerrar={() => setLector(false)}
        onCodigo={(c) => {
          setLector(false);
          setCode(c);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', gap: 10 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  hint: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  label: { fontSize: 14, fontWeight: '800', marginTop: 4 },
  codeRow: { flexDirection: 'row', gap: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  code: { flex: 1, fontSize: 18, letterSpacing: 2, textAlign: 'center' },
  nombre: { fontSize: 16 },
  qr: {
    width: 56,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { fontSize: 12, lineHeight: 17, fontWeight: '600' },
  button: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  skip: { alignSelf: 'center', paddingVertical: 8 },
  skipText: { fontSize: 14, fontWeight: '600' },
});
