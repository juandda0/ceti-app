import {
  RACHA_INICIAL,
  calcularRacha,
  registrarPractica,
  revisarRacha,
  type EstadoRacha,
} from './racha';
import { lunesDe, sumarDias, diasIntermedios } from './tiempo';

const conDias = (dias: string[], extra: Partial<EstadoRacha> = {}): EstadoRacha => ({
  ...RACHA_INICIAL,
  dias,
  ...extra,
});

describe('tiempo', () => {
  it('suma días cruzando meses y encuentra el lunes', () => {
    expect(sumarDias('2026-10-31', 1)).toBe('2026-11-01');
    expect(lunesDe('2026-10-22')).toBe('2026-10-19'); // jueves → lunes
    expect(lunesDe('2026-10-19')).toBe('2026-10-19');
    expect(lunesDe('2026-10-25')).toBe('2026-10-19'); // domingo
    expect(diasIntermedios('2026-10-20', '2026-10-23')).toEqual(['2026-10-21', '2026-10-22']);
  });
});

describe('racha', () => {
  it('cuenta desde ayer si hoy aún no practicó', () => {
    const e = conDias(['2026-10-20', '2026-10-21']);
    expect(calcularRacha(e, '2026-10-22')).toBe(2);
    expect(calcularRacha(e, '2026-10-23')).toBe(0);
  });

  it('gasta escudos solo si cubren todo el hueco', () => {
    const e = conDias(['2026-10-19', '2026-10-20'], { escudos: 2 });
    const r = revisarRacha(e, '2026-10-23'); // faltaron 21 y 22
    expect(r.escudosUsados).toBe(2);
    expect(r.estado.escudos).toBe(0);
    expect(calcularRacha(r.estado, '2026-10-23')).toBe(4);

    const corto = revisarRacha(conDias(['2026-10-19'], { escudos: 1 }), '2026-10-22');
    expect(corto.escudosUsados).toBe(0);
    expect(corto.estado.escudos).toBe(1);
    expect(corto.rotaReparable?.perdidos).toEqual(['2026-10-20', '2026-10-21']);
  });

  it('es idempotente el mismo día', () => {
    const e = conDias(['2026-10-20'], { escudos: 2 });
    const r1 = revisarRacha(e, '2026-10-22');
    const r2 = revisarRacha(r1.estado, '2026-10-22');
    expect(r1.escudosUsados).toBe(1);
    expect(r2.escudosUsados).toBe(0);
    expect(r2.estado.escudos).toBe(1);
  });

  it('se repara con dos prácticas dentro de la ventana', () => {
    const base = conDias(['2026-10-17', '2026-10-18', '2026-10-19']);
    const rev = revisarRacha(base, '2026-10-21'); // faltó el 20
    expect(rev.rotaReparable?.valor).toBe(3);
    const p1 = registrarPractica(rev.estado, '2026-10-21');
    expect(p1.reparada).toBe(false);
    expect(p1.racha).toBe(1);
    const p2 = registrarPractica(p1.estado, '2026-10-21');
    expect(p2.reparada).toBe(true);
    expect(p2.racha).toBe(5);
  });

  it('la reparación vence después de la ventana', () => {
    const rev = revisarRacha(conDias(['2026-10-19']), '2026-10-21');
    const tarde = revisarRacha(rev.estado, '2026-10-23');
    expect(tarde.estado.rota).toBeUndefined();
  });

  it('anuncia una pérdida no reparable una sola vez', () => {
    const r1 = revisarRacha(conDias(['2026-10-10', '2026-10-11']), '2026-10-20');
    expect(r1.perdida).toBe(2);
    const r2 = revisarRacha(r1.estado, '2026-10-21');
    expect(r2.perdida).toBeUndefined();
  });

  it('cobra cada hito una sola vez', () => {
    const dias = Array.from({ length: 6 }, (_, i) => sumarDias('2026-10-01', i));
    const p = registrarPractica(conDias(dias), '2026-10-07');
    expect(p.racha).toBe(7);
    expect(p.hito).toBe(7);
    expect(registrarPractica(p.estado, '2026-10-07').hito).toBeUndefined();
  });
});

describe('rachaMasLarga', () => {
  it('encuentra el tramo seguido más largo', () => {
    const { rachaMasLarga } = jest.requireActual('./racha');
    expect(rachaMasLarga(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07'])).toBe(3);
    expect(rachaMasLarga([])).toBe(0);
  });
});
