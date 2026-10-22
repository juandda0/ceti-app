import { aplicarDemoSuscripcion } from './demoSuscripcion';
import { suscripcionRepository, type SuscripcionDoc } from './suscripcionRepository';
import { tokenizarTarjeta } from './wompiTokens';
import { diasDePrueba } from '@/functions/src/educadores/dominio';

// jest.mock se eleva sobre los imports (babel-jest).
jest.mock('firebase/firestore', () => ({}));
jest.mock('@shared/lib/firebase/app', () => ({ getFirebaseClients: () => null }));
jest.mock('@shared/lib/firebase/functions', () => ({
  callFunction: jest.fn(() => Promise.reject(new Error('sin red en la demo'))),
}));

function leer(): Promise<SuscripcionDoc | null> {
  return new Promise((resolve) => {
    const off = suscripcionRepository.escucharSuscripcion('demo-profe', (s) => {
      off();
      resolve(s);
    });
  });
}

describe('demo de suscripción (/dev/profe)', () => {
  beforeEach(() => aplicarDemoSuscripcion());

  it('arranca en prueba con ~9 días, 2 pagos y sin licencia', async () => {
    const sub = await leer();
    expect(sub?.estado).toBe('prueba');
    expect(sub?.planVigente).toBe('piloto');
    expect(diasDePrueba(sub, Date.now())).toBe(9);
    expect(await suscripcionRepository.pagos('demo-profe')).toHaveLength(2);
    const licencia = await new Promise((r) => suscripcionRepository.escucharLicencia('c', r));
    expect(licencia).toBeNull();
  });

  it('cotiza con tarifa fundador solo en Piloto mensual', async () => {
    expect(await suscripcionRepository.cotizar('piloto', 'mensual')).toMatchObject({
      montoCop: 19_900,
      fundador: true,
    });
    expect(await suscripcionRepository.cotizar('piloto', 'anioEscolar')).toMatchObject({
      montoCop: 199_000,
      fundador: false,
    });
  });

  it('cancelar en prueba deja Cadete de inmediato', async () => {
    const r = await suscripcionRepository.gestionar('cancelar');
    expect(r.estado).toBe('gratis');
    expect(r.reembolso).toBe(false);
    expect((await leer())?.planVigente).toBe('cadete');
  });

  it('tokeniza sin red y sin guardar el número', async () => {
    const tok = await tokenizarTarjeta({
      numero: '4242 4242 4242 4242',
      vence: '12/30',
      cvc: '123',
      titular: 'Ana Pérez',
    });
    expect(tok).toEqual({ id: 'tok_demo_ceti', marca: 'DEMO', ultimos4: '4242' });
  });
});
