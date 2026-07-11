/**
 * CreateClassScreen — a professor creates their own class (D-ADMIN / RQ-PR13):
 * name + grado → crearMiCurso (mints a unique join code). On success we land on
 * the new class's manage screen so they can see the code and configure it.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { adminService } from '@features/dashboard/data/adminService';

const GRADOS = ['9', '10', '11'] as const;

export default function CreateClassScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [grado, setGrado] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    if (!nombre.trim()) {
      showMessage(t('createClass.nombreRequired'));
      return;
    }
    if (!grado) {
      showMessage(t('createClass.gradoRequired'));
      return;
    }
    setBusy(true);
    try {
      const res = await adminService.crearMiCurso({ nombre: nombre.trim(), grado });
      showMessage(t('createClass.created'));
      router.replace(
        `/(staff)/gestionar/${res.cursoId}?nombre=${encodeURIComponent(nombre.trim())}` as Href
      );
    } catch (e) {
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenWrapper style={{ flex: 1, backgroundColor: colors.background.base }}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('quiz.back')}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text.primary }]}>{t('createClass.title')}</Text>
        <Text style={[styles.subtitle, { color: colors.text.tertiary }]}>
          {t('createClass.subtitle')}
        </Text>

        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
          {t('createClass.nombre')}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.background.secondary,
              color: colors.text.primary,
              borderColor: colors.materials.border,
            },
          ]}
          value={nombre}
          onChangeText={setNombre}
          placeholder={t('createClass.nombrePlaceholder')}
          placeholderTextColor={colors.text.quaternary}
          maxLength={60}
        />

        <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>
          {t('createClass.grado')}
        </Text>
        <View style={styles.chipRow}>
          {GRADOS.map((g) => (
            <TouchableOpacity
              key={g}
              onPress={() => setGrado(g)}
              accessibilityRole="button"
              accessibilityState={{ selected: grado === g }}
              style={[
                styles.chip,
                {
                  backgroundColor: grado === g ? colors.brand.primary : colors.background.secondary,
                },
              ]}
            >
              <Text
                style={[styles.chipText, { color: grado === g ? '#fff' : colors.text.secondary }]}
              >
                {g}°
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.brand.primary, opacity: busy ? 0.6 : 1 }]}
          onPress={() => void onCreate()}
          disabled={busy}
          accessibilityRole="button"
        >
          <Text style={styles.btnText}>{t('createClass.create')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 24, paddingBottom: 48, gap: 10 },
  backBtn: { alignSelf: 'flex-start', padding: 4 },
  title: { fontSize: 24, fontWeight: '900' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', gap: 10 },
  chip: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 20 },
  chipText: { fontSize: 15, fontWeight: '800' },
  btn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
