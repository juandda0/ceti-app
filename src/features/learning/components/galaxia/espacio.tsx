/**
 * Piezas comunes de Tu Galaxia: la paleta del espacio (Aprender usa fondo azul noche en los dos temas,
 * para que se sienta viaje espacial), el fondo con estrellas y el chip de racha con el fueguito.
 */
import { memo } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle, type StyleProp } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

export const ESPACIO = {
  fondo: '#101026',
  fondoProfundo: '#0C0C22',
  superficie: '#1C1C3A',
  superficieBaja: '#15152E',
  sombra: '#0A0A1C',
  linea: '#2E2E58',
  lineaSuave: '#2C2C58',
  boton: '#1E1E3E',
  texto: '#F4F2FF',
  textoSuave: '#A9A6CC',
  textoApagado: '#8D8AB8',
  oro: '#F7C95F',
  naranja: '#FF8A1F',
  naranjaOscuro: '#C25E08',
  textoSobreNaranja: '#2B1407',
} as const;

const ESTRELLAS: readonly [number, number, number][] = [
  [0.08, 0.19, 1.5], [0.9, 0.17, 1.2], [0.54, 0.23, 1], [0.95, 0.56, 1.6], [0.05, 0.62, 1.2],
  [0.77, 0.62, 1], [0.2, 0.27, 1], [0.33, 0.85, 1.2], [0.66, 0.4, 0.9], [0.12, 0.88, 1.1],
];
const DESTELLOS: readonly [number, number][] = [[0.87, 0.3], [0.09, 0.47], [0.9, 0.82]];

/** Fondo de estrellas fijo; `ancho`/`alto` del área que cubre. */
export const FondoEstrellas = memo(function FondoEstrellas({ ancho, alto }: { ancho: number; alto: number }) {
  return (
    <Svg width={ancho} height={alto} style={StyleSheet.absoluteFill} pointerEvents="none">
      {ESTRELLAS.map(([x, y, r], i) => (
        <Circle key={i} cx={x * ancho} cy={y * alto} r={r} fill="#FFFFFF" opacity={0.55} />
      ))}
      {DESTELLOS.map(([x, y], i) => {
        const cx = x * ancho;
        const cy = y * alto;
        return (
          <Path
            key={i}
            fill={ESPACIO.oro}
            d={`M${cx} ${cy - 9} C${cx + 1} ${cy - 3} ${cx + 3} ${cy - 1} ${cx + 9} ${cy} C${cx + 3} ${cy + 1} ${cx + 1} ${cy + 3} ${cx} ${cy + 9} C${cx - 1} ${cy + 3} ${cx - 3} ${cy + 1} ${cx - 9} ${cy} C${cx - 3} ${cy - 1} ${cx - 1} ${cy - 3} ${cx} ${cy - 9} Z`}
          />
        );
      })}
    </Svg>
  );
});

const FUEGO_LLENO = require('@/assets/images/racha-llena.png');
const FUEGO_VACIO = require('@/assets/images/racha-vacia.png');

/**
 * Racha con el fueguito: lleno (naranja) si hoy ya terminó un quiz, vacío (gris) si la racha sigue
 * viva pero hoy aún no la enciende. Los dos íconos son fotogramas de `streak.fueguito`.
 */
export function ChipRacha({
  dias,
  encendidaHoy,
  style,
}: {
  dias: number;
  encendidaHoy: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { t } = useTranslation();
  const etiqueta = dias === 1 ? t('galaxia.rachaUno') : t('galaxia.racha', { dias });
  return (
    <View
      accessible
      accessibilityLabel={encendidaHoy ? t('galaxia.rachaEncendida', { etiqueta }) : t('galaxia.rachaApagada', { etiqueta })}
      style={[
        chip.base,
        { backgroundColor: encendidaHoy ? '#241A12' : ESPACIO.boton },
        style,
      ]}
    >
      <Image source={encendidaHoy ? FUEGO_LLENO : FUEGO_VACIO} style={chip.icono} />
      <Text style={[chip.texto, { color: encendidaHoy ? '#FF9F45' : '#C9C6E6' }]}>{etiqueta}</Text>
    </View>
  );
}

const chip = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingLeft: 8,
    paddingRight: 12,
    borderRadius: 999,
  },
  icono: { width: 22, height: 22 },
  texto: { fontSize: 15, fontWeight: '900' },
});
