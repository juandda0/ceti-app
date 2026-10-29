/**
 * El cofre de una zona, quieto: cerrado (por ganar), abierto con monedas (recién ganado) o
 * reclamado (abierto y vacío). `gris` lo pinta en blanco y negro (el mapa así muestra los que
 * aún no se reclaman). Las piezas salen de scripts/marca/cofre/cofre.py.
 */
import Svg, { G, Path } from 'react-native-svg';
import { LADO_COFRE, PIEZAS, type Forma } from '@features/orbita/components/cofre/piezas';

export type EstadoCofre = 'cerrado' | 'abierto' | 'reclamado';
export type CapaCofre = keyof typeof PIEZAS;

const CAPAS: Record<EstadoCofre, readonly CapaCofre[]> = {
  cerrado: ['tapaCerrada', 'cuerpo', 'franja', 'candado'],
  abierto: ['tapaAbierta', 'interior', 'monedas', 'cuerpo', 'franja'],
  reclamado: ['tapaAbierta', 'interior', 'cuerpo', 'franja'],
};

/** El mismo color en gris (luminancia). */
function aGris(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const l = Math.round(0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = l.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

/** Las formas de una o varias capas, en la caja del cofre (sirve para animarlas por separado). */
export function CapasCofre({
  capas,
  size,
  gris = false,
}: {
  capas: readonly CapaCofre[];
  size: number;
  gris?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LADO_COFRE} ${LADO_COFRE}`}>
      {capas.map((capa) => (
        <G key={capa}>
          {(PIEZAS[capa] as readonly Forma[]).map(([d, color], i) => (
            <Path key={i} d={d} fill={gris ? aGris(color) : color} />
          ))}
        </G>
      ))}
    </Svg>
  );
}

export default function Cofre({ estado, size, gris }: { estado: EstadoCofre; size: number; gris?: boolean }) {
  return <CapasCofre capas={CAPAS[estado]} size={size} gris={gris} />;
}
