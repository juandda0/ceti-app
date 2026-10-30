/**
 * Crear la entidad (Fase 6): el colegio del profe pasa a ser la entidad y él,
 * su primer admin. Después invita a sus colegas y pide la cotización.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ScreenWrapper from '@shared/components/ScreenWrapper';
import ContextScrollView from '@shared/components/motion/ContextScrollView';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { showMessage } from '@shared/lib/dialogs';
import { TIPOS_ENTIDAD, limpiarNombreEntidad, type TipoEntidad } from '@/functions/src/educadores/dominio';
import { Aviso, BotonChunky, Campo, Chip, Encabezado, Seccion, tapsConTeclado } from '@features/dashboard/components/profe/kit';
import { entidadRepository } from '../data/entidadRepository';

export default function CrearEntidadScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<TipoEntidad>('colegio');
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    setGuardando(true);
    try {
      await entidadRepository.crear(nombre, tipo);
      showMessage(t('entidad.crear.listo'), t('entidad.crear.listoTexto'), 'success');
      router.replace('/(staff)/entidad/profes' as Href);
    } catch (e) {
      showMessage(t('entidad.error'), e instanceof Error ? e.message : String(e), 'error');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ScreenWrapper>
      <ContextScrollView
        contentContainerStyle={[st.page, { paddingTop: insets.top + 12 }]}
        keyboardShouldPersistTaps={tapsConTeclado}
        showsVerticalScrollIndicator={false}
      >
        <Encabezado atras="/(staff)/colegio" sobretitulo={t('entidad.sobre')} titulo={t('entidad.crear.titulo')} subtitulo={t('entidad.crear.subtitulo')} />
        <Campo etiqueta={t('entidad.crear.nombre')} value={nombre} onChangeText={setNombre} placeholder={t('entidad.crear.nombreEjemplo')} maxLength={80} />
        <Seccion texto={t('entidad.crear.tipo')} />
        <View style={st.chips}>
          {TIPOS_ENTIDAD.map((x) => (
            <Chip key={x} texto={t(`entidad.tipo.${x}`)} seleccionado={tipo === x} onPress={() => setTipo(x)} />
          ))}
        </View>
        <Text style={[st.ayuda, { color: colors.text.tertiary }]}>{t(`entidad.crear.ayuda_${tipo}`)}</Text>
        <Aviso icono="information-circle" tono="azul" texto={t('entidad.crear.aviso')} />
        <BotonChunky
          texto={t('entidad.crear.cta')}
          icono="business"
          cargando={guardando}
          deshabilitado={!limpiarNombreEntidad(nombre)}
          onPress={() => void crear()}
        />
      </ContextScrollView>
    </ScreenWrapper>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 80, gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ayuda: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
});
