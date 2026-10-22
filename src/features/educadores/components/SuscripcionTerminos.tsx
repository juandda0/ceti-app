/** "Lo importante, en corto": los términos del plan en seis líneas con viñeta. */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { PAUSA_MAX_DIAS, PAUSAS_POR_ANIO } from '@/functions/src/educadores/dominio';
import { Seccion } from '@features/dashboard/components/profe/kit';

export default function SuscripcionTerminos() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const lineas = [
    t('educadores.suscripcion.terminos.t1'),
    t('educadores.suscripcion.terminos.t2'),
    t('educadores.suscripcion.terminos.t3'),
    t('educadores.suscripcion.terminos.t4'),
    t('educadores.suscripcion.terminos.t5', { veces: PAUSAS_POR_ANIO, dias: PAUSA_MAX_DIAS }),
    t('educadores.suscripcion.terminos.t6'),
  ];
  return (
    <View style={{ gap: 10 }}>
      <Seccion texto={t('educadores.suscripcion.terminos.titulo')} />
      <View style={styles.lista} accessibilityRole="list">
        {lineas.map((linea, i) => (
          <View key={i} style={styles.fila}>
            <View style={[styles.punto, { backgroundColor: colors.text.tertiary }]} />
            <Text style={[styles.texto, { color: colors.text.secondary }]}>{linea}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lista: { gap: 8 },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  punto: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
  texto: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
