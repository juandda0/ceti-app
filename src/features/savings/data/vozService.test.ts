import { normalizarRespuestaVoz, type RespuestaVoz } from '@features/savings/data/vozService';

// vozService importa callFunction (firebase/functions), que jest no resuelve en
// el entorno de prueba; lo mockeamos (jest lo hoista) para probar la función pura.
jest.mock('@shared/lib/firebase/functions', () => ({ callFunction: jest.fn() }));

function item(p: Partial<RespuestaVoz> = {}): RespuestaVoz {
  return {
    intencion: 'movimiento',
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'x',
    categoria: 'comida',
    confianza: 0.9,
    offsetDias: 0,
    ...p,
  };
}

describe('normalizarRespuestaVoz', () => {
  it('respuesta v2 con movimientos → devuelve el array tal cual', () => {
    const r = item({ movimientos: [item({ monto: 1 }), item({ monto: 2 })] });
    expect(normalizarRespuestaVoz(r)).toHaveLength(2);
  });

  it('respuesta plana legacy → lista de 1', () => {
    const out = normalizarRespuestaVoz(item());
    expect(out).toHaveLength(1);
    expect(out[0].offsetDias).toBe(0);
  });

  it('movimientos vacío → cae al legacy', () => {
    expect(normalizarRespuestaVoz(item({ movimientos: [] }))).toHaveLength(1);
  });

  it('el ítem legacy no arrastra la clave movimientos', () => {
    const out = normalizarRespuestaVoz(item({ movimientos: [] }));
    expect('movimientos' in out[0]).toBe(false);
  });
});
