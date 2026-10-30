/**
 * Adelanto de una herramienta de pago para quien no la tiene: qué ganaría, en
 * una línea, y "Ver <plan>" (el plan más barato que la incluye: Piloto casi
 * siempre, Comandante para el resumen de acudientes) con el motivo para que la
 * pantalla de planes abra en la comparación correcta. Nunca reemplaza el avance
 * básico de la clase.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { planMinimoPara, type Funcion } from '@/functions/src/educadores/dominio';
import { BotonChunky, Pill, Tarjeta } from '@features/dashboard/components/profe/kit';

type IconName = keyof typeof Ionicons.glyphMap;

export function rutaPlanes(motivo: Funcion): Href {
  return `/(staff)/planes?motivo=${motivo}` as Href;
}

export default function TarjetaBloqueada({
  titulo,
  valor,
  motivo,
  icono = 'sparkles',
}: {
  titulo: string;
  /** El valor en una línea: lo que la herramienta le diría hoy. */
  valor: string;
  motivo: Funcion;
  icono?: IconName;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const plan = t(`educadores.planes.nombre.${planMinimoPara(motivo)}`);
  return (
    <Tarjeta style={styles.tarjeta}>
      <View style={styles.cabeza}>
        <View style={[styles.icono, { backgroundColor: colors.fill.purpleSubtle }]}>
          <Ionicons name={icono} size={18} color={colors.system.purple} />
        </View>
        <Text style={[styles.titulo, { color: colors.text.primary }]} numberOfLines={2}>
          {titulo}
        </Text>
        <Pill texto={plan} icono="lock-closed" tono="morado" />
      </View>
      <Text style={[styles.valor, { color: colors.text.secondary }]}>{valor}</Text>
      <BotonChunky
        texto={t('educadores.teaser.verPlan', { plan })}
        icono="rocket-outline"
        variante="secundario"
        color={colors.system.purple}
        compacto
        onPress={() => router.push(rutaPlanes(motivo))}
      />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  tarjeta: { gap: 12 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icono: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titulo: { flex: 1, fontSize: 16, fontWeight: '900' },
  valor: { fontSize: 15, lineHeight: 21, fontWeight: '600' },
});
