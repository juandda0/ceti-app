import {
  buildCuratedConfig,
  isWorldAccessible,
  isWorldVisible,
  resolveClassWorlds,
} from './classConfig';
import type { CursoConfigMundos } from '@shared/types/tenancy';

function config(partial: Partial<CursoConfigMundos>): CursoConfigMundos {
  return {
    mundos: [],
    version: 1,
    updatedAt: 1,
    updatedByUid: 'prof1',
    ...partial,
  };
}

const none = () => false;
const completedSet = (ids: string[]) => (worldId: string) => ids.includes(worldId);

describe('resolveClassWorlds', () => {
  it('sin config → 6 mundos default en orden canónico, solo el primero desbloqueado', () => {
    const { worlds } = resolveClassWorlds(null, none);
    expect(worlds.map((w) => w.worldId)).toEqual([
      'world_1',
      'world_2',
      'world_3',
      'world_4',
      'world_5',
      'world_6',
    ]);
    expect(worlds.map((w) => w.unlocked)).toEqual([true, false, false, false, false, false]);
  });

  it('config malformada (mundos vacío, cache viejo) → defaults', () => {
    const { worlds } = resolveClassWorlds(config({ mundos: [] }), none);
    expect(worlds).toHaveLength(6);
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
});

describe('isWorldVisible (guard real de la saga — RQ-PR10 CA4)', () => {
  it('sin config → los 5 default son visibles, un cw_ no', () => {
    expect(isWorldVisible(null, 'world_4')).toBe(true);
    expect(isWorldVisible(null, 'cw_abc')).toBe(false);
  });

  it('mundo removido/desactivado deja de ser visible (no depende del progreso)', () => {
    const cfg = config({
      mundos: [
        { worldId: 'world_1', activo: true },
        { worldId: 'world_2', activo: false },
      ],
    });
    expect(isWorldVisible(cfg, 'world_1')).toBe(true);
    expect(isWorldVisible(cfg, 'world_2')).toBe(false);
    expect(isWorldVisible(cfg, 'world_3')).toBe(false);
  });

  it('mundo custom activo en la config es visible', () => {
    const cfg = config({ mundos: [{ worldId: 'cw_x', activo: true }] });
    expect(isWorldVisible(cfg, 'cw_x')).toBe(true);
  });
});

describe('buildCuratedConfig (regresión B1: curar la lista no borra overrides)', () => {
  it('preserva overrides al reordenar/toggle', () => {
    const cfg = config({
      mundos: [{ worldId: 'world_1', activo: true }],
      overrides: { world_1: { mc: true, teoria: true }, cw_x: { mc: true } },
      version: 7,
    });
    const next = buildCuratedConfig(cfg, [{ worldId: 'world_1', activo: false }], 'prof1', 999);
    expect(next.overrides).toEqual({ world_1: { mc: true, teoria: true }, cw_x: { mc: true } });
    expect(next.version).toBe(8);
    expect(next.updatedAt).toBe(999);
    expect(next.updatedByUid).toBe('prof1');
  });

  it('sin config previa arranca en version 1 y sin overrides', () => {
    const next = buildCuratedConfig(null, [{ worldId: 'world_1', activo: true }], 'prof1', 5);
    expect(next.version).toBe(1);
    expect(next.overrides).toBeUndefined();
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
});
