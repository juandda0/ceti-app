import type {
  MovimientoCategoria,
  MovimientoIntencion,
  MovimientoTipo,
} from '@features/savings/store/useMovimientosStore';

export interface ClasificacionMovimiento {
  intencion: MovimientoIntencion;
  tipo: MovimientoTipo;
  monto: number;
  descripcion: string;
  categoria: MovimientoCategoria;
  confianza: number;
  offsetDias: number;
  diaSemana?: string;
}

const NO_ENTENDIDO: ClasificacionMovimiento = {
  intencion: 'no_entendido',
  tipo: 'gasto',
  monto: 0,
  descripcion: '',
  categoria: 'otros',
  confianza: 0,
  offsetDias: 0,
};

const multiplicadores: Record<string, number> = { mil: 1000, luca: 1000, lucas: 1000 };

function montoDe(texto: string): number | null {
  const match = texto.match(/(\d+(?:[.,]\d+)?)\s*(mil|luca|lucas)?/i);
  if (!match) return null;
  const base = Number(match[1].replace(',', '.'));
  const monto = Math.round(base * (multiplicadores[match[2]?.toLowerCase()] ?? 1));
  return Number.isSafeInteger(monto) && monto > 0 ? monto : null;
}

function categoriaDe(texto: string): MovimientoCategoria {
  if (/helado|comida|almuerzo|desayuno|cena|mercado/i.test(texto)) return 'comida';
  if (/bus|taxi|transporte|metro/i.test(texto)) return 'transporte';
  if (/colegio|libro|curso|educaci[oó]n/i.test(texto)) return 'educacion';
  if (/ropa|camisa|pantal[oó]n|zapatos/i.test(texto)) return 'ropa';
  if (/celular|computador|tecnolog[ií]a/i.test(texto)) return 'tecnologia';
  if (/regalo/i.test(texto)) return 'regalos';
  if (/cine|juego|entretenimiento/i.test(texto)) return 'entretenimiento';
  return 'otros';
}

function parsearUno(texto: string): ClasificacionMovimiento {
  const monto = montoDe(texto);
  if (monto === null) return NO_ENTENDIDO;
  return {
    intencion: 'movimiento',
    tipo: /ahorr|guard|recib|apart/i.test(texto) ? 'ahorro' : 'gasto',
    monto,
    descripcion: texto.trim().slice(0, 140),
    categoria: categoriaDe(texto),
    confianza: 1,
    offsetDias: /\bayer\b/i.test(texto) ? -1 : /\b(?:antier|anteayer)\b/i.test(texto) ? -2 : 0,
  };
}

export function parsearRegistroVoz(texto: string): ClasificacionMovimiento[] {
  const partes = texto
    .slice(0, 300)
    .split(/\s+(?:y luego|luego|y)\s+/i)
    .map((parte) => parte.trim())
    .filter(Boolean)
    .slice(0, 5);
  if (partes.length === 0) return [{ ...NO_ENTENDIDO }];
  const items = partes.map(parsearUno);
  return items.some((item) => item.intencion === 'no_entendido') ? [{ ...NO_ENTENDIDO }] : items;
}
