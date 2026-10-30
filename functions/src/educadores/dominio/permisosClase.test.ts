import { cambiarPermiso, permisoEnClase, puedeEnClase, soloCalificarSin } from './permisosClase';

const curso = { profesorUids: ['creador', 'jorge', 'ana'], soloCalificar: ['jorge'] };

describe('permisos de la clase (F9)', () => {
  it('el creador siempre edita, aunque figure en soloCalificar', () => {
    expect(permisoEnClase({ profesorUids: ['creador'], soloCalificar: ['creador'] }, 'creador')).toBe('edita');
  });

  it('distingue edita, califica y fuera de la clase', () => {
    expect(permisoEnClase(curso, 'ana')).toBe('edita');
    expect(permisoEnClase(curso, 'jorge')).toBe('califica');
    expect(permisoEnClase(curso, 'otro')).toBeNull();
    expect(permisoEnClase(undefined, 'jorge')).toBeNull();
  });

  it('quien califica ve, califica e insignias, pero no edita ni opera', () => {
    for (const a of ['ver', 'calificar', 'retroalimentar', 'insignias', 'responderMuro'] as const) {
      expect(puedeEnClase(curso, 'jorge', a)).toBe(true);
    }
    for (const a of ['contenido', 'lista', 'claseVivo', 'certificados', 'grupos', 'comunicar', 'profes'] as const) {
      expect(puedeEnClase(curso, 'jorge', a)).toBe(false);
      expect(puedeEnClase(curso, 'ana', a)).toBe(true);
    }
    expect(puedeEnClase(curso, 'otro', 'ver')).toBe(false);
  });

  it('cambiar el permiso', () => {
    expect(cambiarPermiso(curso, 'ana', 'califica')).toEqual({ ok: true, soloCalificar: ['jorge', 'ana'] });
    expect(cambiarPermiso(curso, 'jorge', 'edita')).toEqual({ ok: true, soloCalificar: [] });
    expect(cambiarPermiso(curso, 'creador', 'califica')).toEqual({ ok: false, error: 'es_creador' });
    expect(cambiarPermiso(curso, 'otro', 'califica')).toEqual({ ok: false, error: 'no_esta' });
  });

  it('limpia uids que ya no están y nunca deja la clase sin editor', () => {
    expect(cambiarPermiso({ profesorUids: ['c', 'x'], soloCalificar: ['viejo'] }, 'x', 'califica')).toEqual({
      ok: true,
      soloCalificar: ['x'],
    });
    // Con un creador ausente de la lista (datos viejos) sigue habiendo editor: el primero.
    expect(cambiarPermiso({ profesorUids: ['c'], soloCalificar: [] }, 'c', 'califica')).toEqual({
      ok: false,
      error: 'es_creador',
    });
  });

  it('soloCalificarSin', () => {
    expect(soloCalificarSin(curso, 'jorge')).toEqual([]);
    expect(soloCalificarSin({}, 'jorge')).toEqual([]);
  });
});
