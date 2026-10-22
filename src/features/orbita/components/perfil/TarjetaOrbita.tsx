/**
 * "Tu órbita" en el Perfil: racha (y la mejor), XP de la semana y total, Cetis
 * (lleva a la Bóveda), días aprendiendo y escudos. Solo lectura.
 */
import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { Typography } from '@shared/constants/typography';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import type { ThemeColors } from '@shared/constants/colors';
import { useOrbita } from '@features/orbita/hooks/useOrbita';
import { EscudoRacha, MonedaCeti } from '@features/orbita/components/iconos';
import { xpSemana } from '@features/orbita/domain/progreso';
import { diasAprendiendo, MAX_ESCUDOS } from '@features/orbita/domain/racha';
import { totalCetis } from '@features/orbita/domain/boveda';

function formato(n: number): string {
  return n.toLocaleString('es-CO');
}

function Dato({
  icono,
  valor,
  etiqueta,
  detalle,
  colors,
}: {
  icono: ReactNode;
  valor: string;
  etiqueta: string;
  detalle?: string;
  colors: ThemeColors;
}) {
  return (
    <View style={[st.dato, { backgroundColor: colors.materials.highlight }]}>
      <View style={st.datoFila}>
        {icono}
        <Text style={[st.valor, { color: colors.text.primary }]} numberOfLines={1}>
          {valor}
        </Text>
      </View>
      <Text style={[st.etiqueta, { color: colors.text.secondary }]} numberOfLines={1}>
        {etiqueta}
      </Text>
      {detalle ? (
        <Text style={[st.detalle, { color: colors.text.tertiary }]} numberOfLines={1}>
          {detalle}
        </Text>
      ) : null}
    </View>
  );
}

export default function TarjetaOrbita() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { estado, hoy, resumen } = useOrbita();
  if (!estado || !resumen) return null;

  const cetis = totalCetis(estado.boveda);

  return (
    <View
      style={[st.tarjeta, { backgroundColor: colors.materials.base, borderColor: colors.materials.border }]}
    >
      <Text style={[st.titulo, { color: colors.text.primary }]}>{t('orbita.perfil.titulo')}</Text>

      <View style={st.rejilla}>
        <Dato
          colors={colors}
          icono={<Ionicons name="flame" size={20} color={colors.brand.primary} />}
          valor={formato(resumen.racha)}
          etiqueta={t('orbita.perfil.racha', { count: resumen.racha })}
          detalle={t('orbita.perfil.mejor', { count: estado.racha.mejor })}
        />
        <Dato
          colors={colors}
          icono={<Ionicons name="calendar" size={18} color={colors.system.teal} />}
          valor={formato(diasAprendiendo(estado.racha))}
          etiqueta={t('orbita.perfil.dias', { count: diasAprendiendo(estado.racha) })}
        />
        <Dato
          colors={colors}
          icono={<Ionicons name="flash" size={18} color={colors.gold.warm} />}
          valor={formato(xpSemana(estado.progreso, hoy))}
          etiqueta={t('orbita.perfil.xpSemana')}
        />
        <Dato
          colors={colors}
          icono={<Ionicons name="star" size={18} color={colors.gold.warm} />}
          valor={formato(estado.progreso.xpTotal)}
          etiqueta={t('orbita.perfil.xpTotal')}
        />
        <Dato
          colors={colors}
          icono={
            <View style={st.escudos}>
              {Array.from({ length: MAX_ESCUDOS }, (_, i) => (
                <EscudoRacha key={i} size={18} activo={i < resumen.escudos} />
              ))}
            </View>
          }
          valor={`${resumen.escudos}/${MAX_ESCUDOS}`}
          etiqueta={t('orbita.perfil.escudos')}
        />
        <Bounceable
          onPress={() => router.push('/boveda' as never)}
          activeScale={0.96}
          accessibilityRole="button"
          accessibilityLabel={t('orbita.perfil.cetisA11y', { cetis: formato(cetis) })}
          style={st.datoToque}
        >
          <View style={[st.dato, st.datoLleno, { backgroundColor: colors.fill.goldSubtle }]}>
            <View style={st.datoFila}>
              <MonedaCeti size={20} />
              <Text style={[st.valor, { color: colors.text.primary }]} numberOfLines={1}>
                {formato(cetis)}
              </Text>
            </View>
            <View style={st.datoFila}>
              <Text style={[st.etiqueta, st.flex, { color: colors.text.secondary }]} numberOfLines={1}>
                {t('orbita.perfil.cetis')}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
            </View>
            <Text style={[st.detalle, { color: colors.text.tertiary }]} numberOfLines={1}>
              {t('orbita.perfil.verBoveda')}
            </Text>
          </View>
        </Bounceable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tarjeta: { borderRadius: 28, borderWidth: 1, padding: 20, gap: 14 },
  titulo: { ...Typography.title3, fontWeight: '900' },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dato: { flexBasis: '47%', flexGrow: 1, borderRadius: 18, padding: 14, gap: 2, minHeight: 92 },
  datoToque: { flexBasis: '47%', flexGrow: 1 },
  datoLleno: { flexBasis: 'auto', flex: 1 },
  datoFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  valor: { fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  etiqueta: { ...Typography.footnote, fontWeight: '700' },
  detalle: { ...Typography.caption1, fontWeight: '600', fontVariant: ['tabular-nums'] },
  escudos: { flexDirection: 'row', gap: 1 },
});
