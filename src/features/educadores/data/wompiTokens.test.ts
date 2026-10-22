import {
  cuerpoTokenTarjeta,
  entornoWompi,
  ErrorWompi,
  tokenizarTarjeta,
  urlBaseWompi,
} from './wompiTokens';

const FORM = {
  numero: '4242 4242 4242 4242',
  vence: '08/28',
  cvc: '123',
  titular: '  Ana Pérez ',
};

function respuesta(status: number, cuerpo?: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () =>
      cuerpo === undefined ? Promise.reject(new Error('sin json')) : Promise.resolve(cuerpo),
  } as unknown as Response;
}

function fetchFalso(res: Response | (() => never)) {
  return jest.fn((..._args: Parameters<typeof fetch>) =>
    typeof res === 'function' ? Promise.reject(new Error('offline')) : Promise.resolve(res)
  ) as jest.Mock & typeof fetch;
}

async function codigoDe(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorWompi);
    return (e as ErrorWompi).codigo;
  }
  throw new Error('no lanzó');
}

describe('cuerpoTokenTarjeta', () => {
  it('arma el cuerpo de Wompi sin espacios y con el titular recortado', () => {
    expect(cuerpoTokenTarjeta(FORM)).toEqual({
      number: '4242424242424242',
      exp_month: '08',
      exp_year: '28',
      cvc: '123',
      card_holder: 'Ana Pérez',
    });
  });

  it('lanza "datos" con un vencimiento inválido', () => {
    expect(() => cuerpoTokenTarjeta({ ...FORM, vence: '13/28' })).toThrow(ErrorWompi);
    try {
      cuerpoTokenTarjeta({ ...FORM, vence: '8/2' });
    } catch (e) {
      expect((e as ErrorWompi).codigo).toBe('datos');
    }
  });
});

describe('entorno y URL', () => {
  it('sandbox por defecto; production solo si se pide', () => {
    expect(entornoWompi(undefined)).toBe('sandbox');
    expect(entornoWompi('otro')).toBe('sandbox');
    expect(entornoWompi('production')).toBe('production');
    expect(urlBaseWompi('sandbox')).toBe('https://sandbox.wompi.co/v1');
    expect(urlBaseWompi('production')).toBe('https://production.wompi.co/v1');
  });
});

describe('tokenizarTarjeta', () => {
  it('éxito: POST a /tokens/cards con Bearer y devuelve id, marca y últimos 4', async () => {
    const f = fetchFalso(
      respuesta(201, {
        status: 'CREATED',
        data: { id: 'tok_test_1', brand: 'VISA', last_four: '4242' },
      })
    );
    const token = await tokenizarTarjeta(FORM, {
      llave: 'pub_test_abc',
      entorno: 'sandbox',
      fetchImpl: f,
    });
    expect(token).toEqual({ id: 'tok_test_1', marca: 'VISA', ultimos4: '4242' });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://sandbox.wompi.co/v1/tokens/cards');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer pub_test_abc');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual(cuerpoTokenTarjeta(FORM));
  });

  it('usa la URL de production cuando se pide', async () => {
    const f = fetchFalso(respuesta(201, { data: { id: 'tok_prod_1' } }));
    const token = await tokenizarTarjeta(FORM, {
      llave: 'pub_prod_abc',
      entorno: 'production',
      fetchImpl: f,
    });
    expect((f.mock.calls[0] as [string])[0]).toBe('https://production.wompi.co/v1/tokens/cards');
    // Sin brand/last_four en la respuesta: los calcula localmente.
    expect(token).toEqual({ id: 'tok_prod_1', marca: 'visa', ultimos4: '4242' });
  });

  it('422 → "datos"', async () => {
    const f = fetchFalso(respuesta(422, { error: { type: 'INPUT_VALIDATION_ERROR' } }));
    expect(await codigoDe(tokenizarTarjeta(FORM, { llave: 'pub_test_x', fetchImpl: f }))).toBe(
      'datos'
    );
  });

  it('500 → "rechazada" (también sin JSON)', async () => {
    const f = fetchFalso(respuesta(500));
    expect(await codigoDe(tokenizarTarjeta(FORM, { llave: 'pub_test_x', fetchImpl: f }))).toBe(
      'rechazada'
    );
  });

  it('200 sin id → "rechazada"', async () => {
    const f = fetchFalso(respuesta(200, { data: {} }));
    expect(await codigoDe(tokenizarTarjeta(FORM, { llave: 'pub_test_x', fetchImpl: f }))).toBe(
      'rechazada'
    );
  });

  it('fetch que lanza → "red"', async () => {
    const f = fetchFalso(() => {
      throw new Error('offline');
    });
    expect(await codigoDe(tokenizarTarjeta(FORM, { llave: 'pub_test_x', fetchImpl: f }))).toBe(
      'red'
    );
  });

  it('sin llave → "sin_llave" y no llama a la red', async () => {
    const antes = process.env.EXPO_PUBLIC_WOMPI_PUBLIC_KEY;
    delete process.env.EXPO_PUBLIC_WOMPI_PUBLIC_KEY;
    try {
      const f = fetchFalso(respuesta(201, { data: { id: 'tok' } }));
      expect(await codigoDe(tokenizarTarjeta(FORM, { fetchImpl: f }))).toBe('sin_llave');
      expect(f).not.toHaveBeenCalled();
    } finally {
      if (antes !== undefined) process.env.EXPO_PUBLIC_WOMPI_PUBLIC_KEY = antes;
    }
  });

  it('el mensaje del error no lleva datos de la tarjeta', async () => {
    expect.assertions(3);
    const f = fetchFalso(respuesta(422, {}));
    try {
      await tokenizarTarjeta(FORM, { llave: 'pub_test_x', fetchImpl: f });
    } catch (e) {
      const m = (e as Error).message;
      expect(m).not.toContain('4242');
      expect(m).not.toContain('123');
      expect(m).not.toContain('Ana');
    }
  });
});
