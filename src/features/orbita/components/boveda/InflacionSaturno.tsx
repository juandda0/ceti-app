/**
 * La inflación de Saturno: cuánto falta y por qué la Bóveda le gana. Usa el
 * precio del escudo como ejemplo concreto de "lo mismo cuesta más".
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { TASA_BOVEDA } from '@features/orbita/domain/boveda';
import {
  INFLACION_POR_TEMPORADA,
  SEMANAS_POR_TEMPORADA,
  diasParaInflacion,
  precioEscudo,
} from '@features/orbita/domain/economia';
import { sumarDias } from '@features/orbita/domain/tiempo';
import { SATURNO, Tarjeta, comun, fechaCorta } from './comun';

function Saturno({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={6.5} fill={SATURNO} />
      <Ellipse cx={12} cy={12} rx={11} ry={3.2} fill="none" stroke="#C99A4E" strokeWidth={1.8} transform="rotate(-18 12 12)" />
    </Svg>
  );
}

export default function InflacionSaturno({ hoy }: { hoy: string }) {
  const { t } = useTranslation();
  const dias = diasParaInflacion(hoy);
  const fecha = sumarDias(hoy, dias);
  const antes = precioEscudo(hoy);
  const despues = precioEscudo(fecha);
  const inflacion = Math.round(INFLACION_POR_TEMPORADA * 100);
  const rendimiento = Math.round((Math.pow(1 + TASA_BOVEDA, SEMANAS_POR_TEMPORADA) - 1) * 100);

  return (
    <Tarjeta titulo={t('orbita.boveda.inflacionTitulo')} icono={<Saturno />}>
      <View style={st.cuenta}>
        <Text style={[st.dias, comun.num]}>{dias}</Text>
        <View style={{ flex: 1 }}>
          <Text style={st.diasEtiqueta}>{t('orbita.boveda.inflacionDias', { count: dias })}</Text>
          <Text style={comun.nota}>{t('orbita.boveda.inflacionFecha', { fecha: fechaCorta(fecha), pct: inflacion })}</Text>
        </View>
      </View>
      <Text style={comun.sub}>
        {despues > antes
          ? t('orbita.boveda.inflacionEjemplo', { antes, despues })
          : t('orbita.boveda.inflacionEjemploSinCambio', { pct: inflacion })}
      </Text>
      <View style={st.comparar}>
        <Barra etiqueta={t('orbita.boveda.inflacionPrecios')} pct={inflacion} max={rendimiento} color={SATURNO} />
        <Barra etiqueta={t('orbita.boveda.inflacionBoveda')} pct={rendimiento} max={rendimiento} color="#5FD39A" />
      </View>
      <Text style={comun.nota}>
        {t('orbita.boveda.inflacionPorQue', { semanas: SEMANAS_POR_TEMPORADA, rendimiento, inflacion })}
      </Text>
    </Tarjeta>
  );
}

function Barra({ etiqueta, pct, max, color }: { etiqueta: string; pct: number; max: number; color: string }) {
  return (
    <View style={st.barraFila}>
      <Text style={st.barraEtiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
      <View style={st.barra}>
        <View style={[st.barraLlena, { width: `${(pct / max) * 100}%`, backgroundColor: color }]} />
      </View>
      <Text style={[st.barraPct, { color }]}>+{pct} %</Text>
    </View>
  );
}

const st = StyleSheet.create({
  cuenta: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dias: { color: SATURNO, fontSize: 40, fontWeight: '900', minWidth: 48, textAlign: 'center' },
  diasEtiqueta: { color: ESPACIO.texto, fontSize: 15, fontWeight: '800' },
  comparar: { gap: 8 },
  barraFila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barraEtiqueta: { width: 92, color: ESPACIO.textoSuave, fontSize: 12, fontWeight: '700' },
  barra: { flex: 1, height: 10, borderRadius: 5, backgroundColor: ESPACIO.linea, overflow: 'hidden' },
  barraLlena: { height: '100%', borderRadius: 5 },
  barraPct: { width: 48, textAlign: 'right', fontSize: 13, fontWeight: '900' },
});
