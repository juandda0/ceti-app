import type { Firestore } from 'firebase-admin/firestore';
import { cuerpoAlegra, emitirFactura, nombreItem, type CredencialesAlegra, type PagoFacturable } from './facturacion';

function dbFalsa() {
  const docs = new Map<string, Record<string, unknown>>();
  const ref = (path: string) => ({
    get: async () => ({ exists: docs.has(path), data: () => docs.get(path) }),
    set: async (d: Record<string, unknown>, o?: { merge?: boolean }) => {
      docs.set(path, o?.merge ? { ...(docs.get(path) ?? {}), ...d } : d);
    },
    update: async (d: Record<string, unknown>) => {
      docs.set(path, { ...(docs.get(path) ?? {}), ...d });
    },
  });
  const db = { collection: (c: string) => ({ doc: (id: string) => ref(`${c}/${id}`) }) };
  return { db: db as unknown as Firestore, docs };
}

const PAGO: PagoFacturable = {
  id: 'ceti_u1_1',
  uid: 'u1',
  referencia: 'ceti_u1_1',
  plan: 'piloto',
  ciclo: 'mensual',
  montoCop: 24_900,
};
const CLIENTE = { email: 'profe@example.com', nombre: 'Marta' };
const CRED: CredencialesAlegra = { usuario: 'ops@ceti.co', token: 'tk', clienteId: '1', itemId: '2', ivaId: '3' };
const AHORA = Date.UTC(2026, 9, 22, 15);

beforeEach(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());

test('nombre del ítem', () => {
  expect(nombreItem('piloto', 'mensual')).toBe('Ceti Piloto mensual');
  expect(nombreItem('comandante', 'anioEscolar')).toBe('Ceti Comandante Año escolar');
});

test('el cuerpo separa base e IVA del 19 %', () => {
  const c = cuerpoAlegra(PAGO, CLIENTE, CRED, AHORA) as { items: { price: number; name: string; tax: unknown }[]; date: string };
  expect(c.date).toBe('2026-10-22');
  expect(c.items[0]).toMatchObject({ name: 'Ceti Piloto mensual', price: 20_924, quantity: 1, tax: [{ id: 3 }] });
});

test('sin Alegra la factura queda pendiente para hacerla a mano', async () => {
  const { db, docs } = dbFalsa();
  const fetch = jest.fn();
  await expect(emitirFactura(PAGO, CLIENTE, { db, credenciales: null, fetch, ahora: AHORA })).resolves.toEqual({
    estado: 'pendiente',
    error: 'alegra_no_configurado',
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(docs.get('facturas/ceti_u1_1')).toMatchObject({
    estado: 'pendiente',
    montoCop: 24_900,
    baseCop: 20_924,
    ivaCop: 3_976,
    item: 'Ceti Piloto mensual',
    email: 'profe@example.com',
  });
});

test('con Alegra emite con basic auth y guarda el número', async () => {
  const { db, docs } = dbFalsa();
  const fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 201,
    json: async () => ({ id: 99, numberTemplate: { fullNumber: 'FE-12' }, pdf: 'https://alegra/fe12.pdf' }),
  });
  docs.set('pagos/ceti_u1_1', { estado: 'aprobado' });
  await expect(emitirFactura(PAGO, CLIENTE, { db, credenciales: CRED, fetch, ahora: AHORA })).resolves.toEqual({
    estado: 'emitida',
    error: null,
  });
  const [url, init] = fetch.mock.calls[0];
  expect(url).toBe('https://api.alegra.com/api/v1/invoices');
  expect(init.headers.Authorization).toBe(`Basic ${Buffer.from('ops@ceti.co:tk').toString('base64')}`);
  expect(JSON.parse(init.body).items[0].name).toBe('Ceti Piloto mensual');
  expect(docs.get('facturas/ceti_u1_1')).toMatchObject({ estado: 'emitida', alegraId: 99, numero: 'FE-12' });
  expect(docs.get('pagos/ceti_u1_1')).toMatchObject({ facturaUrl: 'https://alegra/fe12.pdf' });

  // Idempotente: no vuelve a emitir.
  await emitirFactura(PAGO, CLIENTE, { db, credenciales: CRED, fetch, ahora: AHORA });
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('si Alegra falla, queda pendiente con el error', async () => {
  const { db, docs } = dbFalsa();
  const fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ message: 'cliente inválido' }) });
  await expect(emitirFactura(PAGO, CLIENTE, { db, credenciales: CRED, fetch, ahora: AHORA })).resolves.toEqual({
    estado: 'pendiente',
    error: 'Alegra respondió 400: cliente inválido',
  });
  expect(docs.get('facturas/ceti_u1_1')).toMatchObject({ estado: 'pendiente', error: 'Alegra respondió 400: cliente inválido' });

  const caida = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
  await expect(emitirFactura(PAGO, CLIENTE, { db, credenciales: CRED, fetch: caida, ahora: AHORA })).resolves.toMatchObject({
    estado: 'pendiente',
  });
});

test('sin los ids de Alegra no llama', async () => {
  const { db } = dbFalsa();
  const fetch = jest.fn();
  const r = await emitirFactura(PAGO, CLIENTE, { db, credenciales: { ...CRED, itemId: '' }, fetch, ahora: AHORA });
  expect(r.estado).toBe('pendiente');
  expect(fetch).not.toHaveBeenCalled();
});
