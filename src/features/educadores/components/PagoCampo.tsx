/**
 * Campo de pago con el mismo estilo que `Campo` del kit, pero con lo que pide un
 * formulario de pago: teclado numérico, autocompletado de tarjeta, clave oculta
 * (CVC) y el error debajo. Sin autocorrección nunca.
 */
import { useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useThemeColors } from '@shared/hooks/useThemeColors';

export default function PagoCampo({
  etiqueta,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  teclado = 'default',
  autoComplete,
  textContentType,
  autoCapitalize = 'none',
  secreto = false,
  maxLength,
  editable = true,
  style,
}: {
  etiqueta: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  /** Mensaje de error (solo se muestra si viene). */
  error?: string | null;
  teclado?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  secreto?: boolean;
  maxLength?: number;
  editable?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const [foco, setFoco] = useState(false);
  const borde = error ? colors.system.red : foco ? colors.brand.primary : colors.materials.border;
  return (
    <View style={[{ gap: 8 }, style]}>
      <Text style={[styles.etiqueta, { color: colors.text.secondary }]} numberOfLines={1}>
        {etiqueta}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.text.quaternary}
        keyboardType={teclado}
        inputMode={
          teclado === 'number-pad' ? 'numeric' : teclado === 'phone-pad' ? 'tel' : undefined
        }
        autoComplete={autoComplete}
        textContentType={textContentType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        spellCheck={false}
        secureTextEntry={secreto}
        maxLength={maxLength}
        editable={editable}
        onFocus={() => setFoco(true)}
        onBlur={() => {
          setFoco(false);
          onBlur?.();
        }}
        accessibilityLabel={etiqueta}
        accessibilityHint={error ?? undefined}
        style={[
          styles.campo,
          {
            color: colors.text.primary,
            backgroundColor: colors.background.primary,
            borderColor: borde,
          },
          Platform.OS === 'web' && ({ outlineWidth: 0 } as object),
        ]}
      />
      {error ? (
        <Text style={[styles.error, { color: colors.system.red }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  etiqueta: { fontSize: 14, fontWeight: '800' },
  campo: {
    borderWidth: 2,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontWeight: '600',
  },
  error: { fontSize: 13, lineHeight: 18, fontWeight: '700' },
});
