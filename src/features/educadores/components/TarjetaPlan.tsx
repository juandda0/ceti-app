/**
 * Fila "Tu plan" del Perfil del profe: el plan con su estado y la entrada a
 * SuscripcionScreen (cambiar, pausar, cancelar, pagos, exportar, soporte).
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { claveEstado } from '@/functions/src/educadores/dominio';
import { Pill, Tarjeta, type Tono } from '@features/dashboard/components/profe/kit';
import { useMiPlan } from '../hooks/useMiPlan';

const TONO_PLAN: Record<string, Tono> = {
  cadete: 'neutro',
  piloto: 'marca',
  comandante: 'morado',
  nave: 'azul',
};

export default function TarjetaPlan() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const router = useRouter();
  const { plan, sub, porColegio, diasPrueba } = useMiPlan();
  const nombre = t(`educadores.planes.nombre.${plan}`);
  const estado = porColegio ? null : claveEstado(sub, Date.now());
  const detalle = porColegio
    ? t('educadores.suscripcion.porColegio')
    : diasPrueba > 0
      ? t('educadores.suscripcion.pruebaQueda', { count: diasPrueba })
      : estado
        ? t(`educadores.estado.${estado}`)
        : null;

  return (
    <Tarjeta
      onPress={() => router.push('/(staff)/suscripcion' as Href)}
      accessibilityLabel={`${t('educadores.suscripcion.filaPerfil')}: ${nombre}`}
    >
      <View style={styles.fila}>
        <View style={[styles.icono, { backgroundColor: colors.fill.brandSubtle }]}>
          <Ionicons name="rocket" size={18} color={colors.brand.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.etiqueta, { color: colors.text.tertiary }]}>
            {t('educadores.suscripcion.filaPerfil').toUpperCase()}
          </Text>
          <View style={styles.planFila}>
            <Pill texto={nombre} tono={TONO_PLAN[plan] ?? 'marca'} icono="sparkles" />
            {detalle ? (
              <Text style={[styles.detalle, { color: colors.text.secondary }]} numberOfLines={1}>
                {detalle}
              </Text>
            ) : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  etiqueta: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  planFila: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  detalle: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
});
