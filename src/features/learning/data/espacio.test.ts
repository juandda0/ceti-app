import { claveNivel, claveProgreso } from './espacio';

describe('claves de espacio', () => {
  it('Mi galaxia conserva las claves de siempre', () => {
    expect(claveProgreso('u1', null)).toBe('u1');
    expect(claveNivel('world_1', undefined)).toBe('world_1');
  });

  it('cada clase tiene su propio avance', () => {
    expect(claveProgreso('u1', 'k1')).toBe('u1@k1');
    expect(claveProgreso('u1', 'k1')).not.toBe(claveProgreso('u1', 'k2'));
    expect(claveNivel('world_1', 'k1')).toBe('k1/world_1');
  });
});
