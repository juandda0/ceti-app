/**
 * Proyección de 8 semanas en la Bóveda: cada barra es el saldo de un lunes;
 * la parte verde es lo que ganaron tus Cetis solos (interés compuesto).
 */
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ESPACIO } from '@features/learning/components/galaxia/espacio';
import { proyectar, type EstadoBoveda } from '@features/orbita/domain/boveda';
import { Tarjeta, VERDE, comun, formato } from './comun';

const SEMANAS = 8;
const EJEMPLO = 500;
const ALTO = 120;

export default function Proyeccion({ boveda }: { boveda: EstadoBoveda }) {
  const { t } = useTranslation();
  const todo = boveda.bolsillo + boveda.boveda;
  const base = todo > 0 ? todo : EJEMPLO;
  const saldos = Array.from({ length: SEMANAS + 1 }, (_, s) => proyectar(base, s));
  const final = saldos[SEMANAS];
  const ganado = final - base;

  return (
    <Tarjeta
      titulo={t('orbita.boveda.proyeccionTitulo')}
      icono={<Ionicons name="bar-chart" size={17} color={VERDE} />}
    >
      <Text style={comun.sub}>
        {todo > 0
          ? t('orbita.boveda.proyeccionSi', { cetis: formato(base), semanas: SEMANAS })
          : t('orbita.boveda.proyeccionEjemplo', { cetis: formato(base), semanas: SEMANAS })}
      </Text>

      <View
        style={st.grafica}
        accessible
        accessibilityLabel={t('orbita.boveda.proyeccionA11y', {
          cetis: formato(base),
          final: formato(final),
          semanas: SEMANAS,
        })}
      >
        {saldos.map((saldo, s) => {
          const alto = (saldo / final) * ALTO;
          const altoBase = (base / final) * ALTO;
          const ultimo = s === SEMANAS;
          return (
            <View key={s} style={st.columna}>
              {ultimo ? <Text style={st.valorFinal}>{formato(final)}</Text> : null}
              <View style={[st.barra, { height: alto }]}>
                <View style={[st.interes, { height: Math.max(0, alto - altoBase) }]} />
                <View style={[st.base, { height: altoBase }]} />
              </View>
              <Text style={[st.semana, ultimo && { color: ESPACIO.texto }]}>
                {s === 0 ? t('orbita.boveda.hoy') : `S${s}`}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={st.leyenda}>
        <View style={st.leyendaItem}>
          <View style={[st.punto, { backgroundColor: ESPACIO.lineaSuave }]} />
          <Text style={comun.nota}>{t('orbita.boveda.proyeccionGuardas')}</Text>
        </View>
        <View style={st.leyendaItem}>
          <View style={[st.punto, { backgroundColor: VERDE }]} />
          <Text style={comun.nota}>{t('orbita.boveda.proyeccionInteres')}</Text>
        </View>
      </View>

      <Text style={st.conclusion}>
        {t('orbita.boveda.proyeccionGanas', { cetis: formato(ganado), semanas: SEMANAS })}
      </Text>
    </Tarjeta>
  );
}

const st = StyleSheet.create({
  grafica: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: ALTO + 40,
    paddingTop: 8,
  },
  columna: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  valorFinal: { color: VERDE, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] },
  barra: { width: '100%', maxWidth: 28, borderRadius: 6, overflow: 'hidden' },
  interes: { backgroundColor: VERDE },
  base: { backgroundColor: ESPACIO.lineaSuave },
  semana: { color: ESPACIO.textoApagado, fontSize: 10, fontWeight: '800' },
  leyenda: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  leyendaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  punto: { width: 10, height: 10, borderRadius: 3 },
  conclusion: { color: ESPACIO.texto, fontSize: 14, fontWeight: '800' },
});
