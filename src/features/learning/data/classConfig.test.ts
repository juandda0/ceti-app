import { isWorldAccessible, resolveClassWorlds } from './classConfig';
import type { CursoConfigMundos } from '@shared/types/tenancy';

function config(partial: Partial<CursoConfigMundos>): CursoConfigMundos {
  return {
    mundos: [],
    modoEnfocado: { activo: false },
    version: 1,
    updatedAt: 1,
    updatedByUid: 'prof1',
    ...partial,
  };
}

const none = () => false;
const completedSet = (ids: string[]) => (worldId: string) => ids.includes(worldId);

describe('resolveClassWorlds', () => {
  it('sin config → 5 mundos default en orden canónico, solo el primero desbloqueado', () => {
    const { worlds, enfocadoWorldId } = resolveClassWorlds(null, none);
    expect(worlds.map((w) => w.worldId)).toEqual([
      'world_1',
      'world_2',
      'world_3',
      'world_4',
      'world_5',
    ]);
    expect(worlds.map((w) => w.unlocked)).toEqual([true, false, false, false, false]);
    expect(enfocadoWorldId).toBeNull();
  });

  it('config malformada (mundos vacío, cache viejo) → defaults', () => {
    const { worlds } = resolveClassWorlds(config({ mundos: [] }), none);
    expect(worlds).toHaveLength(5);
  });

  it('respeta orden custom y el desbloqueo sigue ese orden', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_3', activo: true },
        { worldId: 'world_1', activo: true },
        { worldId: 'world_2', activo: true },
      ],
    });
    const { worlds } = resolveClassWorlds(cfg, completedSet(['world_3']));
    expect(worlds.map((w) => w.worldId)).toEqual(['world_3', 'world_1', 'world_2']);
    // world_3 completado → world_1 (siguiente en el orden) se desbloquea.
    expect(worlds.map((w) => w.unlocked)).toEqual([true, true, false]);
  });

  it('mundos inactivos desaparecen y no cuentan en la cadena de desbloqueo', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_1', activo: true },
        { worldId: 'world_2', activo: false },
        { worldId: 'world_3', activo: true },
      ],
    });
    const { worlds } = resolveClassWorlds(cfg, completedSet(['world_1']));
    expect(worlds.map((w) => w.worldId)).toEqual(['world_1', 'world_3']);
    // world_2 inactivo no bloquea: world_3 se desbloquea con world_1 completado.
    expect(worlds[1].unlocked).toBe(true);
  });

  it('lo completado nunca se re-bloquea al reordenar (RQ-PR10 CA5)', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_5', activo: true },
        { worldId: 'world_2', activo: true },
      ],
    });
    // world_2 fue completado cuando iba de segundo en otro orden.
    const { worlds } = resolveClassWorlds(cfg, completedSet(['world_2']));
    expect(worlds).toEqual([
      { worldId: 'world_5', unlocked: true },
      { worldId: 'world_2', unlocked: true },
    ]);
  });

  it('todos los mundos desactivados → lista vacía (estado vacío en UI)', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_1', activo: false },
        { worldId: 'world_2', activo: false },
      ],
    });
    expect(resolveClassWorlds(cfg, none).worlds).toEqual([]);
  });

  it('modo enfocado sirve solo ese mundo, desbloqueado aunque haya anteriores sin completar', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_1', activo: true },
        { worldId: 'world_2', activo: true },
        { worldId: 'world_3', activo: true },
      ],
      modoEnfocado: { activo: true, worldId: 'world_3' },
    });
    const { worlds, enfocadoWorldId } = resolveClassWorlds(cfg, none);
    expect(worlds).toEqual([{ worldId: 'world_3', unlocked: true }]);
    expect(enfocadoWorldId).toBe('world_3');
  });

  it('modo enfocado sobre un mundo inactivo/inexistente se ignora (defensivo)', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_1', activo: true },
        { worldId: 'world_2', activo: false },
      ],
      modoEnfocado: { activo: true, worldId: 'world_2' },
    });
    const { worlds, enfocadoWorldId } = resolveClassWorlds(cfg, none);
    expect(worlds.map((w) => w.worldId)).toEqual(['world_1']);
    expect(enfocadoWorldId).toBeNull();
  });
});

describe('isWorldAccessible (guard de saga / salida suave)', () => {
  it('mundo removido de la clase deja de ser accesible', () => {
    const cfg = config({ mundos: [{ worldId: 'world_1', activo: true }] });
    expect(isWorldAccessible(cfg, 'world_2', none)).toBe(false);
    expect(isWorldAccessible(cfg, 'world_1', none)).toBe(true);
  });

  it('mundo bloqueado por orden no es accesible; completado sí', () => {
    expect(isWorldAccessible(null, 'world_3', none)).toBe(false);
    expect(isWorldAccessible(null, 'world_3', completedSet(['world_3']))).toBe(true);
  });

  it('en modo enfocado solo el mundo enfocado es accesible', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_1', activo: true },
        { worldId: 'world_2', activo: true },
      ],
      modoEnfocado: { activo: true, worldId: 'world_2' },
    });
    expect(isWorldAccessible(cfg, 'world_1', completedSet(['world_1']))).toBe(false);
    expect(isWorldAccessible(cfg, 'world_2', none)).toBe(true);
  });
});
