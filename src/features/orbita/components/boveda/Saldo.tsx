/**
 * Saldo de la Bóveda: el total grande, en qué está repartido y el interés de
 * los lunes (el último que pagó y el que viene), con el tope explicado.
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { MonedaCeti } from '@features/orbita/components/iconos';
import {
  TASA_BOVEDA,
  TOPE_INTERES,
  interesSemana,
  totalCetis,
  type EstadoBoveda,
} from '@features/orbita/domain/boveda';
import { lunesDe, sumarDias } from '@features/orbita/domain/tiempo';
import { CIAN, VERDE, VERDE_SUAVE, comun, fechaCorta, formato } from './comun';

export default function Saldo({ boveda, hoy }: { boveda: EstadoBoveda; hoy: string }) {
  const { t } = useTranslation();
  const total = totalCetis(boveda);
  const enCdt = boveda.cdts.reduce((s, c) => s + c.monto, 0);
  const proximo = interesSemana(boveda.boveda);
  const proximoLunes = sumarDias(lunesDe(hoy), 7);
  const pago = boveda.ultimoPago;
  const pagoEsDeHoy = pago?.lunes === hoy;
  const tasa = Math.round(TASA_BOVEDA * 100);

  return (
    <View style={st.raiz}>
      <Text style={st.overline}>{t('orbita.boveda.overline')}</Text>
      <View style={st.total} accessibilityLabel={t('orbita.boveda.totalA11y', { cetis: formato(total) })}>
        <MonedaCeti size={34} />
        <Text style={[st.totalNum, comun.num]}>{formato(total)}</Text>
      </View>

      {pago ? (
        <View style={st.pago}>
          <Ionicons name="trending-up" size={16} color={VERDE} />
          <Text style={st.pagoTexto}>
            {pagoEsDeHoy
              ? t('orbita.boveda.pagoHoy', { cetis: formato(pago.monto), tasa })
              : t('orbita.boveda.pagoLunes', { cetis: formato(pago.monto), fecha: fechaCorta(pago.lunes) })}
          </Text>
        </View>
      ) : null}

      <View style={st.desglose}>
        <Parte color={ESPACIO.oro} etiqueta={t('orbita.boveda.bolsillo')} valor={boveda.bolsillo} />
        <Parte color={VERDE} etiqueta={t('orbita.boveda.enBoveda')} valor={boveda.boveda} />
        <Parte color={CIAN} etiqueta={t('orbita.boveda.enCdt')} valor={enCdt} />
      </View>

      <View style={st.proximo}>
        <Ionicons name="calendar-outline" size={18} color={ESPACIO.textoSuave} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={st.proximoTexto}>
            {proximo > 0
              ? t('orbita.boveda.proximoPago', { cetis: formato(proximo), fecha: fechaCorta(proximoLunes) })
              : t('orbita.boveda.proximoCero')}
          </Text>
          <Text style={comun.nota}>
            {boveda.boveda > TOPE_INTERES
              ? t('orbita.boveda.topePasado', { tope: formato(TOPE_INTERES), tasa })
              : t('orbita.boveda.tope', { tope: formato(TOPE_INTERES), tasa })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Parte({ color, etiqueta, valor }: { color: string; etiqueta: string; valor: number }) {
  return (
    <View style={st.parte}>
      <View style={[st.punto, { backgroundColor: color }]} />
      <Text style={st.parteEtiqueta} numberOfLines={1}>
        {etiqueta}
      </Text>
      <Text style={[st.parteValor, comun.num]} numberOfLines={1} adjustsFontSizeToFit>
        {formato(valor)}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  raiz: { gap: 12 },
  overline: {
    color: ESPACIO.textoSuave,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  total: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  totalNum: { color: ESPACIO.texto, fontSize: 46, fontWeight: '900', letterSpacing: -1 },
  pago: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: VERDE_SUAVE,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pagoTexto: { color: VERDE, fontSize: 13, fontWeight: '800' },
  desglose: { flexDirection: 'row', gap: 8 },
  parte: {
    flex: 1,
    backgroundColor: ESPACIO.superficieBaja,
    borderWidth: 1,
    borderColor: ESPACIO.linea,
    borderRadius: 16,
    padding: 10,
    gap: 4,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  parteEtiqueta: { color: ESPACIO.textoSuave, fontSize: 12, fontWeight: '700' },
  parteValor: { color: ESPACIO.texto, fontSize: 18, fontWeight: '900' },
  proximo: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  proximoTexto: { color: ESPACIO.texto, fontSize: 14, fontWeight: '800' },
});
