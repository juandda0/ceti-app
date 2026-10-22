import { createHash } from 'node:crypto';
import {
  aCentavos,
  clienteWompi,
  ErrorWompi,
  firmaIntegridad,
  metodoDesdeWompi,
  urlCheckout,
  verificarEvento,
  type FetchWompi,
} from './wompi';

describe('firmaIntegridad', () => {
  test('coincide con el ejemplo de la documentación de Wompi', () => {
    expect(
      firmaIntegridad('sk8-438k4-xmxm392-sn2m', 2490000, 'COP', 'prod_integrity_Z5mMke9x0k8gpErbDqwrJXMqsI6SFli6')
    ).toBe('37c8407747e595535433ef8f6a811d853cd943046624a0ec04662b17bbf33bf5');
  });

  test('COP entero → centavos', () => {
    expect(aCentavos(24_900)).toBe(2_490_000);
  });
});

describe('urlCheckout', () => {
  test('lleva todos los parámetros del Web Checkout', () => {
    const url = new URL(
      urlCheckout({
        llavePublica: 'pub_test_x',
        referencia: 'ceti_abc_1',
        montoCop: 24_900,
        secretoIntegridad: 'secreto',
        redirectUrl: 'https://ceti.app/pago',
        email: 'profe@example.com',
      })
    );
    expect(url.origin + url.pathname).toBe('https://checkout.wompi.co/p/');
    const p = url.searchParams;
    expect(p.get('public-key')).toBe('pub_test_x');
    expect(p.get('currency')).toBe('COP');
    expect(p.get('amount-in-cents')).toBe('2490000');
    expect(p.get('reference')).toBe('ceti_abc_1');
    expect(p.get('signature:integrity')).toBe(firmaIntegridad('ceti_abc_1', 2490000, 'COP', 'secreto'));
    expect(p.get('redirect-url')).toBe('https://ceti.app/pago');
    expect(p.get('customer-data:email')).toBe('profe@example.com');
  });

  test('omite redirect y correo si no vienen', () => {
    const p = new URL(
      urlCheckout({ llavePublica: 'k', referencia: 'r', montoCop: 1, secretoIntegridad: 's' })
    ).searchParams;
    expect(p.has('redirect-url')).toBe(false);
    expect(p.has('customer-data:email')).toBe(false);
  });
});

describe('verificarEvento', () => {
  const SECRETO = 'prod_events_OcHnIzeBl5socpwByQ4hA52Em3USQ93Z';
  // Vector calculado aparte: sha256('1234-1610641025-49201' + 'APPROVED' + '4490000' + '1530291411' + secreto).
  const CHECKSUM = '5a18ec5e8fdb7df463e9f94774cba8f583ba21bd04a09ceff2ea68a4bc0aefbe';
  const evento = (checksum = CHECKSUM, status = 'APPROVED') => ({
    event: 'transaction.updated',
    data: { transaction: { id: '1234-1610641025-49201', status, amount_in_cents: 4490000, reference: 'r' } },
    environment: 'prod',
    signature: {
      properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'],
      checksum,
    },
    timestamp: 1530291411,
  });

  test('acepta la firma correcta (también en mayúsculas)', () => {
    expect(verificarEvento(evento(), SECRETO)).toBe(true);
    expect(verificarEvento(evento(CHECKSUM.toUpperCase()), SECRETO)).toBe(true);
  });

  test('rechaza un evento alterado, otro secreto o sin firma', () => {
    expect(verificarEvento(evento(CHECKSUM, 'DECLINED'), SECRETO)).toBe(false);
    expect(verificarEvento(evento(), 'otro')).toBe(false);
    expect(verificarEvento(evento('abc'), SECRETO)).toBe(false);
    expect(verificarEvento({ ...evento(), signature: undefined }, SECRETO)).toBe(false);
    expect(verificarEvento(null, SECRETO)).toBe(false);
    expect(verificarEvento(evento(), '')).toBe(false);
  });

  test('el vector es sha256 de la concatenación', () => {
    const cadena = '1234-1610641025-49201APPROVED44900001530291411' + SECRETO;
    expect(createHash('sha256').update(cadena).digest('hex')).toBe(CHECKSUM);
  });
});

describe('clienteWompi', () => {
  type Llamada = { url: string; init?: RequestInit };

  function fetchFalso(respuestas: { status?: number; body: unknown }[]) {
    const llamadas: Llamada[] = [];
    const f: FetchWompi = async (url, init) => {
      llamadas.push({ url, init });
      const r = respuestas.shift();
      if (!r) throw new Error('sin respuesta preparada');
      const status = r.status ?? 200;
      return { ok: status < 400, status, json: async () => r.body } as Response;
    };
    return { f, llamadas };
  }

  const base = {
    entorno: 'sandbox' as const,
    llavePublica: 'pub_test_1',
    llavePrivada: 'prv_test_1',
    secretoIntegridad: 'integ',
  };

  test('tokenAceptacion lee el token presignado del comercio', async () => {
    const { f, llamadas } = fetchFalso([
      {
        body: {
          data: {
            presigned_acceptance: { acceptance_token: 'acc_1' },
            presigned_personal_data_auth: { acceptance_token: 'per_1' },
          },
        },
      },
    ]);
    const w = clienteWompi({ ...base, fetch: f });
    await expect(w.tokenAceptacion()).resolves.toEqual({ acceptanceToken: 'acc_1', personalAuthToken: 'per_1' });
    expect(llamadas[0].url).toBe('https://sandbox.wompi.co/v1/merchants/pub_test_1');
    expect((llamadas[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer pub_test_1');
  });

  test('tokenNequi espera hasta que el profe aprueba en Nequi', async () => {
    const { f, llamadas } = fetchFalso([
      { body: { data: { id: 'nequi_tok_1', status: 'PENDING' } } },
      { body: { data: { id: 'nequi_tok_1', status: 'PENDING' } } },
      { body: { data: { id: 'nequi_tok_1', status: 'APPROVED' } } },
    ]);
    const esperar = jest.fn().mockResolvedValue(undefined);
    const w = clienteWompi({ ...base, fetch: f, esperar });
    await expect(w.tokenNequi('3001234567')).resolves.toBe('nequi_tok_1');
    expect(llamadas[0].url).toBe('https://sandbox.wompi.co/v1/tokens/nequi');
    expect(JSON.parse(String(llamadas[0].init?.body))).toEqual({ phone_number: '3001234567' });
    expect(llamadas[2].url).toBe('https://sandbox.wompi.co/v1/tokens/nequi/nequi_tok_1');
    expect(esperar).toHaveBeenCalledTimes(2);
  });

  test('tokenNequi falla si se rechaza o si no llega respuesta', async () => {
    const rechazo = fetchFalso([
      { body: { data: { id: 't', status: 'PENDING' } } },
      { body: { data: { id: 't', status: 'DECLINED' } } },
    ]);
    await expect(
      clienteWompi({ ...base, fetch: rechazo.f, esperar: async () => undefined }).tokenNequi('3001234567')
    ).rejects.toMatchObject({ codigo: 'nequi_rechazado' });

    const pendientes = Array.from({ length: 30 }, () => ({ body: { data: { id: 't', status: 'PENDING' } } }));
    const lento = fetchFalso(pendientes);
    await expect(
      clienteWompi({
        ...base,
        fetch: lento.f,
        esperar: async () => undefined,
        esperaNequiMs: 9_000,
        intervaloNequiMs: 3_000,
      }).tokenNequi('3001234567')
    ).rejects.toMatchObject({ codigo: 'nequi_sin_respuesta' });
    expect(lento.llamadas).toHaveLength(4);
  });

  test('crearFuentePago usa la llave privada y el token de aceptación', async () => {
    const { f, llamadas } = fetchFalso([{ body: { data: { id: 3891, status: 'AVAILABLE' } } }]);
    const w = clienteWompi({ ...base, fetch: f });
    const fuente = await w.crearFuentePago({
      tipo: 'NEQUI',
      token: 'nequi_tok_1',
      email: 'profe@example.com',
      aceptacion: { acceptanceToken: 'acc_1', personalAuthToken: null },
    });
    expect(fuente).toEqual({ id: '3891', estado: 'AVAILABLE' });
    expect(llamadas[0].url).toBe('https://sandbox.wompi.co/v1/payment_sources');
    expect((llamadas[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer prv_test_1');
    expect(JSON.parse(String(llamadas[0].init?.body))).toEqual({
      type: 'NEQUI',
      token: 'nequi_tok_1',
      customer_email: 'profe@example.com',
      acceptance_token: 'acc_1',
    });
  });

  test('cobrarConFuente firma el cobro en centavos', async () => {
    const { f, llamadas } = fetchFalso([
      { body: { data: { id: 'tx_1', status: 'PENDING', payment_method_type: 'CARD' } } },
    ]);
    const w = clienteWompi({ ...base, fetch: f });
    const tx = await w.cobrarConFuente({
      fuentePagoId: '3891',
      referencia: 'ren_abc_1',
      montoCop: 19_900,
      email: 'profe@example.com',
    });
    expect(tx).toEqual({ id: 'tx_1', estado: 'PENDING', metodo: 'CARD' });
    expect(llamadas[0].url).toBe('https://sandbox.wompi.co/v1/transactions');
    expect(JSON.parse(String(llamadas[0].init?.body))).toEqual({
      amount_in_cents: 1_990_000,
      currency: 'COP',
      signature: firmaIntegridad('ren_abc_1', 1_990_000, 'COP', 'integ'),
      customer_email: 'profe@example.com',
      payment_method: { installments: 1 },
      reference: 'ren_abc_1',
      payment_source_id: 3891,
    });
  });

  test('un error HTTP se vuelve ErrorWompi sin el cuerpo completo', async () => {
    const { f } = fetchFalso([{ status: 422, body: { error: { type: 'INPUT_VALIDATION_ERROR', messages: { x: 1 } } } }]);
    const w = clienteWompi({ ...base, fetch: f });
    const err = await w
      .cobrarConFuente({ fuentePagoId: '1', referencia: 'r', montoCop: 1, email: 'e@x.co' })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ErrorWompi);
    expect(err).toMatchObject({ codigo: 'http', status: 422 });
    expect((err as Error).message).toBe('Wompi respondió 422 (INPUT_VALIDATION_ERROR).');
  });

  test('sin llave no llama a la red', async () => {
    const { f, llamadas } = fetchFalso([]);
    const w = clienteWompi({ ...base, llavePrivada: '', fetch: f });
    await expect(
      w.cobrarConFuente({ fuentePagoId: '1', referencia: 'r', montoCop: 1, email: 'e@x.co' })
    ).rejects.toMatchObject({ codigo: 'no_configurado' });
    expect(llamadas).toHaveLength(0);
  });
});

test('metodoDesdeWompi', () => {
  expect(metodoDesdeWompi('CARD')).toBe('tarjeta');
  expect(metodoDesdeWompi('NEQUI')).toBe('nequi');
  expect(metodoDesdeWompi('PSE')).toBe('pse');
  expect(metodoDesdeWompi('BANCOLOMBIA_TRANSFER')).toBe('otro');
  expect(metodoDesdeWompi(null)).toBe('otro');
});
