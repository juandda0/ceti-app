/**
 * CreateClassScreen — a professor creates their own class (D-ADMIN / RQ-PR13):
 * name + grado → crearMiCurso (mints a unique join code). On success we land on
 * the new class's manage screen so they can see the code and configure it.
 * Arriba, la tarjeta de la clase se arma en vivo mientras escribe.
 */
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { adminService } from '@features/dashboard/data/adminService';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { puedeCrearClase } from '@/functions/src/educadores/dominio';
import { useMiPlan } from '@features/educadores/hooks/useMiPlan';
import { useMuro } from '@features/educadores/components/MuroPlan';
import { motivoDeError } from '@features/educadores/data/planUi';
import {
  BotonChunky,
  Campo,
  Chip,
  Encabezado,
  InsigniaGrado,
  Tarjeta,
  tapsConTeclado,
} from '@features/dashboard/components/profe/kit';

const GRADOS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'] as const;

export default function CreateClassScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [nombre, setNombre] = useState('');
  const [grado, setGrado] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Límite de clases del plan: se revisa antes de llamar (el servidor responde
  // 'limite_clases' igual si la cuenta no cuadra).
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const { plan, cargando: cargandoPlan } = useMiPlan();
  const muro = useMuro();
  const [clasesActuales, setClasesActuales] = useState<number | null>(null);
  useEffect(() => {
    if (!colegioId || !uid) return;
    let cancelled = false;
    void rosterRepository
      .getCursosByProfesor(colegioId, uid)
      .then((list) => {
        if (!cancelled) setClasesActuales(list.length);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [colegioId, uid]);

  const onCreate = async () => {
    if (!nombre.trim()) {
      showMessage(t('createClass.nombreRequired'));
      return;
    }
    if (!grado) {
      showMessage(t('createClass.gradoRequired'));
      return;
    }
    if (!cargandoPlan && clasesActuales !== null && !puedeCrearClase(plan, clasesActuales)) {
      muro.abrir('clases');
      return;
    }
    setBusy(true);
    try {
      const res = await adminService.crearMiCurso({ nombre: nombre.trim(), grado });
      showMessage(t('createClass.created'), undefined, 'success');
      router.replace(
        `/(staff)/gestionar/${res.cursoId}?nombre=${encodeURIComponent(nombre.trim())}` as Href
      );
    } catch (e) {
      const motivo = motivoDeError(e);
      if (motivo) {
        muro.abrir(motivo);
        return;
      }
      showMessage(t('admin.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const listo = nombre.trim().length > 0 && grado !== null;

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[styles.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado
          atras="/(staff)/clases"
          titulo={t('createClass.title')}
          subtitulo={t('createClass.subtitle')}
        />

        <Tarjeta>
          <View style={styles.previa}>
            {grado ? (
              <InsigniaGrado grado={grado} tono="marca" />
            ) : (
              <View style={[styles.insigniaVacia, { borderColor: colors.materials.border }]} />
            )}
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={[
                  styles.previaNombre,
                  { color: nombre.trim() ? colors.text.primary : colors.text.quaternary },
                ]}
                numberOfLines={2}
              >
                {nombre.trim() || t('createClass.nombrePlaceholder')}
              </Text>
              <Text style={[styles.previaSub, { color: colors.text.tertiary }]}>
                {grado ? t('profe.grado', { grado }) : t('profe.eligeGrado')}
              </Text>
            </View>
          </View>
        </Tarjeta>

        <Campo
          etiqueta={t('createClass.nombre')}
          value={nombre}
          onChangeText={setNombre}
          placeholder={t('createClass.nombrePlaceholder')}
          maxLength={60}
        />

        <View style={{ gap: 10 }}>
          <Text style={[styles.etiqueta, { color: colors.text.secondary }]}>
            {t('createClass.grado')}
          </Text>
          <View style={styles.grados}>
            {GRADOS.map((g) => (
              <Chip
                key={g}
                grande
                texto={`${g}°`}
                seleccionado={grado === g}
                onPress={() => setGrado(g)}
              />
            ))}
          </View>
        </View>

        <BotonChunky
          texto={t('createClass.create')}
          icono="checkmark"
          cargando={busy}
          deshabilitado={!listo}
          onPress={() => void onCreate()}
          style={{ marginTop: 6 }}
        />
      </ContextScrollView>
      {muro.hoja}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 64, gap: 18 },
  previa: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  insigniaVacia: { width: 52, height: 52, borderRadius: 17, borderWidth: 2, borderStyle: 'dashed' },
  previaNombre: { fontSize: 20, lineHeight: 24, fontWeight: '900' },
  previaSub: { fontSize: 14, fontWeight: '700' },
  etiqueta: { fontSize: 14, fontWeight: '800' },
  grados: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
