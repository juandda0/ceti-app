import { parsearRegistroVoz } from '@features/savings/data/vozParser';

describe('parsearRegistroVoz', () => {
  it('clasifica un gasto con miles y categoría conocida', () => {
    expect(parsearRegistroVoz('gasté 5 mil en un helado')).toEqual([
      expect.objectContaining({
        intencion: 'movimiento',
        tipo: 'gasto',
        monto: 5000,
        categoria: 'comida',
      }),
    ]);
  });

  it('clasifica ahorro y fecha relativa', () => {
    expect(parsearRegistroVoz('ayer ahorré 20 lucas')).toEqual([
      expect.objectContaining({ tipo: 'ahorro', monto: 20000, offsetDias: -1 }),
    ]);
  });

  it('separa hasta cinco movimientos unidos por y/luego', () => {
    expect(parsearRegistroVoz('gasté 2 mil en bus y luego 5 mil en comida')).toHaveLength(2);
  });

  it('no inventa datos cuando falta el monto', () => {
    expect(parsearRegistroVoz('compré un helado')).toEqual([
      expect.objectContaining({ intencion: 'no_entendido', monto: 0, confianza: 0 }),
    ]);
  });
});
