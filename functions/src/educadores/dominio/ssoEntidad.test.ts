import { dominioDeCorreo, limpiarDominio, puedeAgregarDominio, tocaInvitacionPorDominio } from './ssoEntidad';

const admin = { correo: 'diana@sanmateo.edu.co', verificado: true };
describe('dominios de la institución (F9)', () => {
  it('lee el dominio', () => {
    expect(dominioDeCorreo('Diana@SanMateo.edu.co')).toBe('sanmateo.edu.co');
    expect(dominioDeCorreo('sin-arroba')).toBeNull();
    expect(limpiarDominio(' @https://SanMateo.edu.co/ ')).toBe('sanmateo.edu.co');
    expect(limpiarDominio('no es dominio')).toBeNull();
  });
  it('solo el dominio del propio correo verificado, nunca uno público ni de otra entidad', () => {
    expect(puedeAgregarDominio('sanmateo.edu.co', admin, [], null, 'sm')).toEqual({ ok: true, dominio: 'sanmateo.edu.co' });
    expect(puedeAgregarDominio('gmail.com', { correo: 'x@gmail.com', verificado: true }, [], null, 'sm')).toEqual({ ok: false, error: 'publico' });
    expect(puedeAgregarDominio('otro.edu.co', admin, [], null, 'sm')).toEqual({ ok: false, error: 'no_es_tuyo' });
    expect(puedeAgregarDominio('sanmateo.edu.co', { ...admin, verificado: false }, [], null, 'sm')).toEqual({ ok: false, error: 'sin_verificar' });
    expect(puedeAgregarDominio('sanmateo.edu.co', admin, ['sanmateo.edu.co'], 'sm', 'sm')).toEqual({ ok: false, error: 'ya_esta' });
    expect(puedeAgregarDominio('sanmateo.edu.co', admin, [], 'otra', 'sm')).toEqual({ ok: false, error: 'de_otra' });
  });
  it('a quién le llega la invitación', () => {
    const base = { correo: 'jorge@sanmateo.edu.co', verificado: true, colegioActual: 'personal', entidadDelDominio: 'sm', yaInvitado: false, rechazada: false };
    expect(tocaInvitacionPorDominio(base)).toBe(true);
    expect(tocaInvitacionPorDominio({ ...base, verificado: false })).toBe(false);
    expect(tocaInvitacionPorDominio({ ...base, colegioActual: 'sm' })).toBe(false);
    expect(tocaInvitacionPorDominio({ ...base, rechazada: true })).toBe(false);
    expect(tocaInvitacionPorDominio({ ...base, entidadDelDominio: null })).toBe(false);
  });
});
