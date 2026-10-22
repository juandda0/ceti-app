/**
 * Bitácora del domingo, versión compacta, arriba de la pestaña Clases: lo que
 * dice Ceti de la semana, tres cifras y un solo botón con el siguiente paso.
 * "Ver todo" abre la Bitácora completa. Sin clases no se muestra: la pestaña ya
 * invita a crear la primera.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Bounceable from '@shared/components/Bounceable';
import { useThemeColors } from '@shared/hooks/useThemeColors';
import { CetiAnimation } from '@features/animations';
import { formatoMinutosCorto } from '@/functions/src/educadores/dominio';
import {
  BotonChunky,
  Esqueleto,
  Tarjeta,
  paletaTono,
  type Tono,
} from '@features/dashboard/components/profe/kit';
import { useBitacora } from '../hooks/useBitacora';
import { animacionDeTono, rangoSemana, vozCeti } from './vozBitacora';
import { textoPaso } from './textoPaso';

function Mini({ valor, etiqueta, tono }: { valor: string; etiqueta: string; tono: Tono }) {
  const colors = useThemeColors();
  const { fondo, tinta } = paletaTono(colors, tono);
  return (
    <View
      style={[styles.mini, { backgroundColor: fondo }]}
      accessible
      accessibilityLabel={`${etiqueta}: ${valor}`}
    >
      <Text style={[styles.miniValor, { color: tinta }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
      <Text style={[styles.miniEtiqueta, { color: colors.text.secondary }]} numberOfLines={2}>
        {etiqueta}
      </Text>
    </View>
  );
}

export default function BitacoraTarjeta() {
  const { t } = useTranslation();
  const router = useRouter();
  const colors = useThemeColors();
  const { estado, resultado } = useBitacora();

  if (estado === 'cargando') return <Esqueleto filas={1} alto={150} />;
  // Sin datos (error) o sin clases: la pestaña Clases ya resuelve ese caso.
  if (!resultado || resultado.bitacora.cursos === 0) return null;

  const { bitacora: b, destino } = resultado;
  const pctActivos = Math.round(b.pctActivos * 100);

  return (
    <Tarjeta style={styles.tarjeta} acento={colors.brand.primary}>
      <View style={styles.cabeza}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.sobre, { color: colors.brand.primary }]}>
            {t('educadores.bitacora.sobretitulo').toUpperCase()}
          </Text>
          <Text style={[styles.semana, { color: colors.text.tertiary }]}>
            {rangoSemana(b.generadaAt)}
          </Text>
        </View>
        <Bounceable
          onPress={() => router.push('/(staff)/bitacora' as Href)}
          accessibilityRole="button"
          accessibilityLabel={t('educadores.bitacora.verTodo')}
          activeScale={0.94}
          hitSlop={8}
          style={[styles.verTodo, { backgroundColor: colors.materials.highlight }]}
        >
          <Text style={[styles.verTodoTexto, { color: colors.text.primary }]}>
            {t('educadores.bitacora.verTodo')}
          </Text>
          <Ionicons name="chevron-forward" size={14} color={colors.text.primary} />
        </Bounceable>
      </View>

      <View style={styles.voz}>
        <CetiAnimation id={animacionDeTono(b.tono)} size={56} />
        <Text style={[styles.vozTexto, { color: colors.text.primary }]}>{vozCeti(t, b)}</Text>
      </View>

      <View style={styles.minis}>
        <Mini
          valor={b.estudiantes === 0 ? '—' : `${pctActivos}%`}
          etiqueta={t('educadores.bitacora.activos')}
          tono={pctActivos >= 80 ? 'verde' : pctActivos >= 50 ? 'naranja' : 'rojo'}
        />
        <Mini
          valor={String(b.alertas.length)}
          etiqueta={t('educadores.bitacora.alertasCorto', { count: b.alertas.length })}
          tono={b.alertas.length > 0 ? 'naranja' : 'verde'}
        />
        <Mini
          valor={`≈${formatoMinutosCorto(b.minutosAhorrados)}`}
          etiqueta={t('educadores.bitacora.ahorradoCorto')}
          tono="azul"
        />
      </View>

      <BotonChunky
        texto={textoPaso(t, b, destino)}
        icono="arrow-forward"
        compacto
        onPress={() => router.push(destino.ruta as Href)}
      />
    </Tarjeta>
  );
}

const styles = StyleSheet.create({
  tarjeta: { gap: 14 },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sobre: { fontSize: 12, fontWeight: '900', letterSpacing: 1.3 },
  semana: { fontSize: 13, fontWeight: '700' },
  verTodo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
  },
  verTodoTexto: { fontSize: 13, fontWeight: '800' },
  voz: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vozTexto: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  minis: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 10, gap: 2 },
  miniValor: { fontSize: 20, fontWeight: '900' },
  miniEtiqueta: { fontSize: 12, fontWeight: '700' },
});
