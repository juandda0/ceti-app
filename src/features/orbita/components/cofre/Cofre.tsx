/**
 * El cofre de una zona, quieto: cerrado (por ganar), abierto con monedas (recién ganado) o
 * reclamado (abierto y vacío). Las piezas salen de scripts/marca/cofre/cofre.py.
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

/** Las formas de una o varias capas, en la caja del cofre (sirve para animarlas por separado). */
export function CapasCofre({ capas, size }: { capas: readonly CapaCofre[]; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${LADO_COFRE} ${LADO_COFRE}`}>
      {capas.map((capa) => (
        <G key={capa}>
          {(PIEZAS[capa] as readonly Forma[]).map(([d, color], i) => (
            <Path key={i} d={d} fill={color} />
          ))}
        </G>
      ))}
    </Svg>
  );
}

export default function Cofre({ estado, size }: { estado: EstadoCofre; size: number }) {
  return <CapasCofre capas={CAPAS[estado]} size={size} />;
}
