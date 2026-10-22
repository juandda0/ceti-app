import { createHash } from 'node:crypto';
import { HttpsError } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import {
  aplicarPagoAprobado,
  DIA_MS,
  ErrorSuscripcion,
  FUNDADOR,
  nuevaSuscripcion,
  type Suscripcion,
} from './dominio';
import { aDoc } from './plan';
import {
  aHttps,
  conservaFundador,
  correrCiclo,
  cotizar,
  crearCheckout,
  gestionar,
  leerMedio,
  normalizarCelular,
  procesarEventoWompi,
  suscribir,
  urlRetornoValida,
  type Dependencias,
  type PagoServidor,
} from './suscripciones';
import type { ClienteWompi, Transaccion } from './wompi';

// ---- Firestore en memoria (lo justo para este módulo) ----

type Datos = Record<string, unknown>;
const clon = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function firestoreFalso() {
  const docs = new Map<string, Datos>();
  let auto = 0;
  const idDe = (path: string) => path.split('/').pop() as string;

  function snap(path: string) {
    const d = docs.get(path);
    return { id: idDe(path), exists: d !== undefined, ref: ref(path), data: () => clon(d) };
  }
  function ref(path: string) {
    return {
      id: idDe(path),
      path,
      get: async () => snap(path),
      set: async (data: Datos, opts?: { merge?: boolean }) => {
        docs.set(path, opts?.merge ? { ...(docs.get(path) ?? {}), ...clon(data) } : clon(data));
      },
      create: async (data: Datos) => {
        if (docs.has(path)) throw new Error('ALREADY_EXISTS');
        docs.set(path, clon(data));
      },
      update: async (data: Datos) => {
        if (!docs.has(path)) throw new Error('NOT_FOUND');
        docs.set(path, { ...docs.get(path), ...clon(data) });
      },
    };
  }
  type Ref = ReturnType<typeof ref>;

  function consulta(col: string, filtros: [string, string, unknown][] = [], orden: [string | null, string][] = [], lim = Infinity, despues: string | null = null) {
    return {
      where: (campo: string, op: string, valor: unknown) => consulta(col, [...filtros, [campo, op, valor]], orden, lim, despues),
      orderBy: (campo: unknown, dir = 'asc') =>
        consulta(col, filtros, [...orden, [typeof campo === 'string' ? campo : null, dir]], lim, despues),
      limit: (n: number) => consulta(col, filtros, orden, n, despues),
      startAfter: (s: { id: string }) => consulta(col, filtros, orden, lim, s.id),
      get: async () => {
        let lista = [...docs.keys()]
          .filter((p) => p.startsWith(`${col}/`) && !p.slice(col.length + 1).includes('/'))
          .map((p) => snap(p))
          .filter((s) =>
            filtros.every(([campo, op, valor]) => {
              const v = (s.data() as Datos)[campo];
              return op === 'in' ? (valor as unknown[]).includes(v) : v === valor;
            })
          );
        for (const [campo, dir] of [...orden].reverse()) {
          lista = lista.sort((a, b) => {
            const va = campo ? ((a.data() as Datos)[campo] as number) : a.id;
            const vb = campo ? ((b.data() as Datos)[campo] as number) : b.id;
            const c = va < vb ? -1 : va > vb ? 1 : 0;
            return dir === 'desc' ? -c : c;
          });
        }
        if (despues !== null) lista = lista.filter((s) => s.id > despues);
        const resultado = lista.slice(0, lim);
        return { docs: resultado, size: resultado.length, empty: resultado.length === 0 };
      },
    };
  }

  const db = {
    collection: (col: string) => ({
      doc: (id?: string) => ref(`${col}/${id ?? `auto${++auto}`}`),
      add: async (data: Datos) => {
        const r = ref(`${col}/auto${++auto}`);
        await r.set(data);
        return r;
      },
      ...consulta(col),
    }),
    doc: (path: string) => ref(path),
    runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) =>
      fn({
        get: (r: Ref) => r.get(),
        set: (r: Ref, d: Datos, o?: { merge?: boolean }) => void r.set(d, o),
        update: (r: Ref, d: Datos) => void r.update(d),
        create: (r: Ref, d: Datos) => void r.create(d),
      }),
  };
  return {
    db: db as unknown as Firestore,
    docs,
    leer: (path: string) => clon(docs.get(path)) as Datos | undefined,
    poner: (path: string, d: Datos) => docs.set(path, clon(d)),
    coleccion: (col: string) =>
      [...docs.entries()].filter(([p]) => p.startsWith(`${col}/`)).map(([p, d]): Datos & { id: string } => ({ ...d, id: idDe(p) })),
  };
}

// ---- utilidades ----

const AHORA = Date.UTC(2026, 9, 22, 11); // 22 oct 2026, 06:00 en Bogotá
const SECRETO_EVENTOS = 'test_events_x';

function wompiFalso(resultado: Partial<Transaccion> & { lanza?: unknown } = {}) {
  const cobros: { fuentePagoId: string; referencia: string; montoCop: number }[] = [];
  const cliente: ClienteWompi = {
    tokenAceptacion: jest.fn().mockResolvedValue({ acceptanceToken: 'acc', personalAuthToken: null }),
    tokenNequi: jest.fn().mockResolvedValue('nequi_tok'),
    crearFuentePago: jest.fn().mockResolvedValue({ id: '777', estado: 'AVAILABLE' }),
    cobrarConFuente: jest.fn(async (p) => {
      cobros.push(p);
      if (resultado.lanza) throw resultado.lanza;
      return { id: resultado.id ?? `tx_${cobros.length}`, estado: resultado.estado ?? 'APPROVED', metodo: resultado.metodo ?? 'NEQUI' };
    }),
  };
  return { cliente, cobros };
}

function crearDeps(f: ReturnType<typeof firestoreFalso>, extra: Partial<Dependencias> = {}) {
  const w = wompiFalso();
  const facturar = jest.fn().mockResolvedValue(undefined);
  const deps: Dependencias = {
    db: f.db,
    ahora: () => AHORA,
    wompi: () => w.cliente,
    llavePublica: () => 'pub_test',
    secretoIntegridad: () => 'integ',
    secretoEventos: () => SECRETO_EVENTOS,
    perfil: async () => ({ email: 'profe@example.com', nombre: 'Marta' }),
    correoOps: () => 'ops@ceti.co',
    facturar,
    urlRetorno: () => 'https://ceti.app/pago',
    ...extra,
  };
  return { deps, facturar, wompi: w };
}

function evento(tx: { id: string; status: string; reference: string; amount_in_cents: number; payment_method_type?: string }, secreto = SECRETO_EVENTOS) {
  const props = ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'];
  const timestamp = 1761130000;
  const checksum = createHash('sha256')
    .update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${secreto}`)
    .digest('hex');
  return {
    event: 'transaction.updated',
    data: { transaction: { payment_method_type: 'CARD', ...tx } },
    environment: 'test',
    signature: { properties: props, checksum },
    timestamp,
  };
}

function subActiva(uid: string, extra: Partial<Suscripcion> = {}, cuando = AHORA - 40 * DIA_MS): Suscripcion {
  const base = aplicarPagoAprobado(nuevaSuscripcion(uid, cuando - DIA_MS), {
    plan: 'piloto',
    ciclo: 'mensual',
    montoCop: 24_900,
    fundador: false,
    fuentePagoId: '555',
    metodo: 'nequi',
    ahora: cuando,
  });
  return { ...base, ...extra };
}

function pago(f: ReturnType<typeof firestoreFalso>, ref: string) {
  return f.leer(`pagos/${ref}`) as unknown as PagoServidor;
}

beforeEach(() => {
  for (const m of ['error', 'warn', 'info'] as const) jest.spyOn(console, m).mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

// ---- puras ----

test('referencias, celulares y URL de retorno', () => {
  expect(normalizarCelular('+57 300 123 4567')).toBe('3001234567');
  expect(normalizarCelular('6011234567')).toBeNull();
  expect(urlRetornoValida('https://ceti.app/x', 'd')).toBe('https://ceti.app/x');
  expect(urlRetornoValida('http://localhost:8081/pago', 'd')).toBe('http://localhost:8081/pago');
  expect(urlRetornoValida('javascript:alert(1)', 'd')).toBe('d');
  expect(urlRetornoValida('http://malo.co', 'd')).toBe('d');
  expect(leerMedio({ tipo: 'CARD', token: 'tok_test_1_abc' })).toEqual({ tipo: 'CARD', token: 'tok_test_1_abc' });
  expect(() => leerMedio({ tipo: 'CARD', token: '4242424242424242' })).toThrow(HttpsError);
  expect(() => leerMedio({ tipo: 'PSE' })).toThrow(HttpsError);
});

test('aHttps traduce errores del dominio con su código', () => {
  let err: unknown;
  try {
    aHttps(new ErrorSuscripcion('limite_pausas', 'Puedes pausar 2 veces al año.'));
  } catch (e) {
    err = e;
  }
  expect(err).toBeInstanceOf(HttpsError);
  expect(err).toMatchObject({ code: 'failed-precondition', message: 'Puedes pausar 2 veces al año.', details: { codigo: 'limite_pausas' } });
});

test('conservaFundador sigue la regla de continuidad del dominio', () => {
  const s = subActiva('u', { fundador: true }, AHORA - 5 * DIA_MS);
  expect(conservaFundador(s, 'piloto', 'mensual', AHORA)).toBe(true);
  expect(conservaFundador(s, 'piloto', 'anioEscolar', AHORA)).toBe(false);
  expect(conservaFundador({ ...s, estado: 'gratis' }, 'piloto', 'mensual', AHORA)).toBe(false);
});

// ---- cotizar y checkout ----

describe('cotizar', () => {
  test('tarifa fundador mientras queden cupos, solo Piloto mensual', async () => {
    const f = firestoreFalso();
    f.poner('fundadores/contador', { usados: 10 });
    await expect(cotizar(f.db, 'u1', 'piloto', 'mensual', AHORA)).resolves.toEqual({
      montoCop: FUNDADOR.pilotoMensual,
      fundador: true,
      cuposFundador: FUNDADOR.cupos - 10,
    });
    await expect(cotizar(f.db, 'u1', 'comandante', 'mensual', AHORA)).resolves.toMatchObject({ montoCop: 49_900, fundador: false });
    await expect(cotizar(f.db, 'u1', 'piloto', 'anioEscolar', AHORA)).resolves.toMatchObject({ montoCop: 199_000, fundador: false });
    f.poner('fundadores/contador', { usados: FUNDADOR.cupos });
    await expect(cotizar(f.db, 'u1', 'piloto', 'mensual', AHORA)).resolves.toEqual({
      montoCop: 24_900,
      fundador: false,
      cuposFundador: 0,
    });
  });

  test('un fundador vigente conserva su precio aunque no queden cupos', async () => {
    const f = firestoreFalso();
    f.poner('fundadores/contador', { usados: FUNDADOR.cupos });
    f.poner('suscripciones/u1', aDoc(subActiva('u1', { fundador: true, precioCop: 19_900 }, AHORA - 5 * DIA_MS)));
    await expect(cotizar(f.db, 'u1', 'piloto', 'mensual', AHORA)).resolves.toMatchObject({ montoCop: 19_900, fundador: true });
  });
});

test('crearCheckout deja el pago pendiente y arma la URL firmada', async () => {
  const f = firestoreFalso();
  const { deps } = crearDeps(f);
  const r = await crearCheckout(deps, {
    uid: 'abcdefghijklmn',
    email: 'profe@example.com',
    plan: 'piloto',
    ciclo: 'mensual',
    redirectUrl: 'javascript:x',
  });
  expect(r.referencia).toBe(`ceti_abcdefgh_${AHORA}`);
  expect(r).toMatchObject({ montoCop: 19_900, fundador: true });
  const p = new URL(r.url).searchParams;
  expect(p.get('amount-in-cents')).toBe('1990000');
  expect(p.get('redirect-url')).toBe('https://ceti.app/pago');
  expect(pago(f, r.referencia)).toMatchObject({
    uid: 'abcdefghijklmn',
    estado: 'pendiente',
    tipo: 'checkout',
    plan: 'piloto',
    ciclo: 'mensual',
    montoCop: 19_900,
    fundador: true,
    creadoAt: AHORA,
  });
});

test('crearCheckout sin llaves no crea nada', async () => {
  const f = firestoreFalso();
  const { deps } = crearDeps(f, { llavePublica: () => '' });
  await expect(
    crearCheckout(deps, { uid: 'u1', email: null, plan: 'piloto', ciclo: 'mensual' })
  ).rejects.toMatchObject({ details: { codigo: 'pagos_no_configurados' } });
  expect(f.coleccion('pagos')).toHaveLength(0);
});

// ---- webhook ----

describe('procesarEventoWompi', () => {
  async function checkoutPendiente(f: ReturnType<typeof firestoreFalso>, deps: Dependencias) {
    return crearCheckout(deps, { uid: 'u1', email: 'profe@example.com', plan: 'piloto', ciclo: 'mensual' });
  }

  test('firma inválida → 401 sin tocar nada', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    const ev = evento({ id: 'tx1', status: 'APPROVED', reference: 'x', amount_in_cents: 1 }, 'otro_secreto');
    await expect(procesarEventoWompi(deps, ev)).resolves.toEqual({ status: 401, resultado: 'firma_invalida' });
    expect(f.docs.size).toBe(0);
  });

  test('APPROVED activa el plan, cuenta el cupo fundador, factura y manda recibo; el reenvío es idempotente', async () => {
    const f = firestoreFalso();
    const { deps, facturar } = crearDeps(f);
    const { referencia } = await checkoutPendiente(f, deps);
    const ev = evento({ id: 'tx1', status: 'APPROVED', reference: referencia, amount_in_cents: 1_990_000 });

    await expect(procesarEventoWompi(deps, ev)).resolves.toEqual({ status: 200, resultado: 'aprobado' });
    const sub = f.leer('suscripciones/u1') as Datos;
    expect(sub).toMatchObject({ estado: 'activa', plan: 'piloto', ciclo: 'mensual', fundador: true, precioCop: 19_900, metodo: 'tarjeta', planVigente: 'piloto' });
    expect(sub.vigenteHasta).toBe(sub.finPeriodo);
    expect(f.leer('fundadores/contador')).toMatchObject({ usados: 1 });
    expect(pago(f, referencia)).toMatchObject({ estado: 'aprobado', wompiTxId: 'tx1', metodo: 'tarjeta' });
    expect(f.leer('eventosPago/tx1_APPROVED')).toMatchObject({ resultado: 'aprobado' });
    expect(facturar).toHaveBeenCalledWith(
      expect.objectContaining({ id: referencia, montoCop: 19_900, plan: 'piloto' }),
      { email: 'profe@example.com', nombre: 'Marta' }
    );
    const correos = f.coleccion('mail');
    expect(correos).toHaveLength(1);
    expect(correos[0]).toMatchObject({ to: 'profe@example.com' });
    expect((correos[0].message as Datos).subject).toContain('Recibo');

    // Reenvío del mismo evento y otro evento APPROVED del mismo pago.
    await expect(procesarEventoWompi(deps, ev)).resolves.toEqual({ status: 200, resultado: 'duplicado' });
    const otro = evento({ id: 'tx1b', status: 'APPROVED', reference: referencia, amount_in_cents: 1_990_000 });
    await expect(procesarEventoWompi(deps, otro)).resolves.toEqual({ status: 200, resultado: 'ya_aplicado' });
    expect(f.leer('fundadores/contador')).toMatchObject({ usados: 1 });
    expect(facturar).toHaveBeenCalledTimes(1);
    expect(f.coleccion('mail')).toHaveLength(1);
  });

  test('un monto distinto al cotizado no se aplica', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    const { referencia } = await checkoutPendiente(f, deps);
    const ev = evento({ id: 'tx2', status: 'APPROVED', reference: referencia, amount_in_cents: 100 });
    await expect(procesarEventoWompi(deps, ev)).resolves.toEqual({ status: 200, resultado: 'monto_no_coincide' });
    expect(pago(f, referencia)).toMatchObject({ estado: 'pendiente', alerta: 'monto_no_coincide' });
    expect(f.leer('suscripciones/u1')).toBeUndefined();
  });

  test('DECLINED de un checkout solo marca el pago', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    const { referencia } = await checkoutPendiente(f, deps);
    const ev = evento({ id: 'tx3', status: 'DECLINED', reference: referencia, amount_in_cents: 1_990_000 });
    await expect(procesarEventoWompi(deps, ev)).resolves.toEqual({ status: 200, resultado: 'rechazado' });
    expect(pago(f, referencia)).toMatchObject({ estado: 'rechazado', motivo: 'DECLINED' });
    expect(f.coleccion('mail')).toHaveLength(0);
  });

  test('DECLINED de una renovación deja la suscripción en mora y avisa', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    const sub = subActiva('u1');
    f.poner('suscripciones/u1', aDoc(sub));
    f.poner('pagos/ren_u1_1', {
      uid: 'u1', referencia: 'ren_u1_1', plan: 'piloto', ciclo: 'mensual', montoCop: 24_900, estado: 'pendiente',
      metodo: 'nequi', tipo: 'recurrente', creadoAt: AHORA, email: 'profe@example.com', fundador: false,
      renovacion: true, fuentePagoId: '555', wompiTxId: 'tx4', actualizadoAt: AHORA,
    });
    const ev = evento({ id: 'tx4', status: 'DECLINED', reference: 'ren_u1_1', amount_in_cents: 2_490_000 });
    await procesarEventoWompi(deps, ev);
    expect(f.leer('suscripciones/u1')).toMatchObject({ estado: 'en_mora', intentosFallidos: 1 });
    const correos = f.coleccion('mail');
    expect(correos).toHaveLength(1);
    expect((correos[0].message as Datos).subject).toBe('No pudimos cobrar tu plan Piloto');
    // Reenvío: no vuelve a sumar intentos.
    await procesarEventoWompi(deps, ev);
    expect(f.leer('suscripciones/u1')).toMatchObject({ intentosFallidos: 1 });
  });

  test('eventos que no son de transacción se ignoran con 200', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    const ev = { ...evento({ id: 't', status: 'APPROVED', reference: 'r', amount_in_cents: 1 }), event: 'nequi_token.updated' };
    await expect(procesarEventoWompi(deps, ev)).resolves.toEqual({ status: 200, resultado: 'ignorado' });
  });
});

// ---- suscribir con medio ----

describe('suscribir', () => {
  test('Nequi aprobado de inmediato: guarda la fuente, activa y es idempotente con el webhook', async () => {
    const f = firestoreFalso();
    const { deps, wompi, facturar } = crearDeps(f);
    f.poner('suscripciones/u1', aDoc(nuevaSuscripcion('u1', AHORA - 2 * DIA_MS)));
    const r = await suscribir(deps, {
      uid: 'u1',
      email: 'profe@example.com',
      plan: 'comandante',
      ciclo: 'anioEscolar',
      medio: { tipo: 'NEQUI', telefono: '3001234567' },
    });
    expect(r).toEqual({ ok: true, referencia: `ceti_u1_${AHORA}` });
    expect(wompi.cliente.tokenNequi).toHaveBeenCalledWith('3001234567');
    expect(wompi.cobros[0]).toMatchObject({ fuentePagoId: '777', montoCop: 399_000 });
    expect(f.leer('suscripciones/u1')).toMatchObject({
      estado: 'activa', plan: 'comandante', ciclo: 'anioEscolar', fuentePagoId: '777', metodo: 'nequi', pruebaHasta: null,
    });
    expect(pago(f, r.referencia)).toMatchObject({ tipo: 'recurrente', estado: 'aprobado', renovacion: false, wompiTxId: 'tx_1' });

    const ev = evento({ id: 'tx_1', status: 'APPROVED', reference: r.referencia, amount_in_cents: 39_900_000 });
    await expect(procesarEventoWompi(deps, ev)).resolves.toMatchObject({ resultado: 'ya_aplicado' });
    expect(facturar).toHaveBeenCalledTimes(1);
  });

  test('rechazo inmediato: error con código y sin plan', async () => {
    const f = firestoreFalso();
    const w = wompiFalso({ estado: 'DECLINED' });
    const { deps } = crearDeps(f, { wompi: () => w.cliente });
    const err = await suscribir(deps, {
      uid: 'u1', email: 'profe@example.com', plan: 'piloto', ciclo: 'mensual', medio: { tipo: 'CARD', token: 'tok_1' },
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'failed-precondition', details: { codigo: 'pago_rechazado' } });
    expect(f.leer('suscripciones/u1')).toMatchObject({ estado: 'prueba', fuentePagoId: '777', metodo: 'tarjeta' });
    expect(f.coleccion('pagos')[0]).toMatchObject({ estado: 'rechazado' });
    expect(f.leer('fundadores/contador')).toBeUndefined();
  });

  test('sin correo no se puede cobrar', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    await expect(
      suscribir(deps, { uid: 'u1', email: null, plan: 'piloto', ciclo: 'mensual', medio: { tipo: 'CARD', token: 'tok_1' } })
    ).rejects.toMatchObject({ details: { codigo: 'sin_correo' } });
  });
});

// ---- gestionar ----

describe('gestionar', () => {
  test('cancelar dentro del retracto: reembolso pendiente y aviso a operaciones', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    f.poner('suscripciones/u1', aDoc(subActiva('u1', {}, AHORA - DIA_MS)));
    f.poner('pagos/ceti_u1_1', {
      uid: 'u1', referencia: 'ceti_u1_1', plan: 'piloto', ciclo: 'mensual', montoCop: 24_900, estado: 'aprobado',
      metodo: 'nequi', tipo: 'checkout', creadoAt: AHORA - DIA_MS, email: 'profe@example.com', fundador: false,
      renovacion: false, fuentePagoId: null, wompiTxId: 'tx9', actualizadoAt: AHORA,
    });
    const r = await gestionar(deps, { uid: 'u1', email: 'profe@example.com', accion: 'cancelar' });
    expect(r).toEqual({ ok: true, estado: 'gratis', reembolso: true, accesoHasta: AHORA });
    expect(pago(f, 'dev_ceti_u1_1')).toMatchObject({
      tipo: 'reembolso', estado: 'reembolso_pendiente', montoCop: 24_900, pagoOriginalId: 'ceti_u1_1', uid: 'u1',
    });
    expect(pago(f, 'ceti_u1_1')).toMatchObject({ reembolsoId: 'dev_ceti_u1_1' });
    const correos = f.coleccion('mail');
    expect(correos).toHaveLength(1);
    expect(correos[0]).toMatchObject({ to: 'ops@ceti.co' });
    expect(f.leer('suscripciones/u1')).toMatchObject({ estado: 'gratis', planVigente: 'cadete' });
  });

  test('cancelar fuera del retracto conserva el plan hasta el fin del periodo', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    const sub = subActiva('u1', {}, AHORA - 20 * DIA_MS);
    f.poner('suscripciones/u1', aDoc(sub));
    const r = await gestionar(deps, { uid: 'u1', email: null, accion: 'cancelar' });
    expect(r).toEqual({ ok: true, estado: 'cancelada', reembolso: false, accesoHasta: sub.finPeriodo });
    expect(f.coleccion('pagos')).toHaveLength(0);
  });

  test('pausar sin fecha usa la sugerida y no pasa del máximo', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    f.poner('suscripciones/u1', aDoc(subActiva('u1', {}, AHORA - 10 * DIA_MS)));
    const r = await gestionar(deps, { uid: 'u1', email: null, accion: 'pausar' });
    expect(r).toMatchObject({ estado: 'pausada', reembolso: false, accesoHasta: null });
    const s = f.leer('suscripciones/u1') as Datos;
    // 22 oct no está en vacaciones de fin de año: un mes.
    expect(s.pausadaHasta).toBe(Date.UTC(2026, 10, 22, 11));
    // Periodo del 12 oct al 12 nov: quedan 21 días pagados.
    expect(s.diasCongelados).toBe(21);
  });

  test('errores del dominio salen como ErrorSuscripcion', async () => {
    const f = firestoreFalso();
    const { deps } = crearDeps(f);
    f.poner('suscripciones/u1', aDoc(nuevaSuscripcion('u1', AHORA)));
    await expect(gestionar(deps, { uid: 'u1', email: null, accion: 'pausar' })).rejects.toMatchObject({
      codigo: 'pausa_no_permitida',
    });
    await expect(gestionar(deps, { uid: 'nadie', email: null, accion: 'cancelar' })).rejects.toBeInstanceOf(ErrorSuscripcion);
  });

  test('reanudar sin días congelados cobra el periodo nuevo', async () => {
    const f = firestoreFalso();
    const { deps, wompi } = crearDeps(f);
    const base = subActiva('u1', {}, AHORA - 60 * DIA_MS);
    f.poner('suscripciones/u1', aDoc({ ...base, estado: 'pausada', pausadaHasta: AHORA + 10 * DIA_MS, diasCongelados: 0, finPeriodo: AHORA - 30 * DIA_MS }));
    const r = await gestionar(deps, { uid: 'u1', email: null, accion: 'reanudar' });
    expect(r.estado).toBe('activa');
    expect(wompi.cobros).toHaveLength(1);
    expect(f.leer('suscripciones/u1')).toMatchObject({ estado: 'activa', finPeriodo: Date.UTC(2026, 10, 22, 11) });
  });
});

// ---- ciclo diario ----

describe('correrCiclo', () => {
  test('cobra, avisa, pagina y sigue aunque una suscripción falle', async () => {
    const f = firestoreFalso();
    const { deps, wompi } = crearDeps(f, {
      perfil: async (uid) => {
        if (uid === 'b_rota') throw new Error('auth caída');
        return { email: `${uid}@example.com`, nombre: null };
      },
    });
    // a: Piloto mensual vencido hoy con Nequi → cobrar.
    f.poner('suscripciones/a_cobra', aDoc(subActiva('a_cobra', {}, AHORA - 31 * DIA_MS)));
    // b: igual, pero falla al leer su perfil.
    f.poner('suscripciones/b_rota', aDoc(subActiva('b_rota', {}, AHORA - 31 * DIA_MS)));
    // c: prueba que termina en 2 días → aviso.
    f.poner('suscripciones/c_prueba', aDoc(nuevaSuscripcion('c_prueba', AHORA - 12 * DIA_MS)));
    // d: gratis → ni se revisa.
    f.poner('suscripciones/d_gratis', aDoc({ ...nuevaSuscripcion('d_gratis', AHORA - 30 * DIA_MS), estado: 'gratis' }));

    const r = await correrCiclo(deps, 2);
    expect(r).toEqual({ revisadas: 3, errores: 1 });

    expect(wompi.cobros).toHaveLength(1);
    expect(wompi.cobros[0]).toMatchObject({ fuentePagoId: '555', montoCop: 24_900, referencia: `ren_a_cobra_${AHORA}` });
    const renovado = f.leer('suscripciones/a_cobra') as Datos;
    expect(renovado).toMatchObject({ estado: 'activa' });
    expect(renovado.finPeriodo as number).toBeGreaterThan(AHORA + 25 * DIA_MS);
    expect(pago(f, `ren_a_cobra_${AHORA}`)).toMatchObject({ tipo: 'recurrente', renovacion: true, estado: 'aprobado' });

    const correos = f.coleccion('mail');
    const asuntos = correos.map((c) => (c.message as Datos).subject as string);
    expect(asuntos.some((s) => s.startsWith('Tu prueba de Piloto termina'))).toBe(true);
    expect(asuntos.some((s) => s.startsWith('Recibo'))).toBe(true);
    expect((f.leer('suscripciones/c_prueba') as Datos).avisosEnviados).toHaveLength(1);

    // Al día siguiente no repite el aviso ni cobra de nuevo.
    await correrCiclo(deps, 2);
    expect(f.coleccion('mail').length).toBe(correos.length);
    expect(wompi.cobros).toHaveLength(1);
  });

  test('un cobro pendiente bloquea otro cobro al día siguiente', async () => {
    const f = firestoreFalso();
    const w = wompiFalso({ estado: 'PENDING' });
    let ahora = AHORA;
    const { deps } = crearDeps(f, { wompi: () => w.cliente, ahora: () => ahora });
    f.poner('suscripciones/u1', aDoc(subActiva('u1', {}, AHORA - 31 * DIA_MS)));
    await correrCiclo(deps);
    ahora = AHORA + DIA_MS;
    await correrCiclo(deps);
    expect(w.cobros).toHaveLength(1);
  });

  test('si Wompi no responde, la renovación entra en mora sin correo de rechazo', async () => {
    const f = firestoreFalso();
    const w = wompiFalso({ lanza: new Error('timeout') });
    const { deps } = crearDeps(f, { wompi: () => w.cliente });
    f.poner('suscripciones/u1', aDoc(subActiva('u1', {}, AHORA - 31 * DIA_MS)));
    await expect(correrCiclo(deps)).resolves.toEqual({ revisadas: 1, errores: 0 });
    expect(f.leer('suscripciones/u1')).toMatchObject({ estado: 'en_mora', intentosFallidos: 1 });
    expect(f.coleccion('pagos')[0]).toMatchObject({ estado: 'rechazado', motivo: 'sin_respuesta' });
    expect(f.coleccion('mail')).toHaveLength(0);
  });
});
