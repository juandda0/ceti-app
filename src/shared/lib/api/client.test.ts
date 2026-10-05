import { api, ApiError } from '@shared/lib/api/client';

jest.mock('expo-constants', () => ({ expoConfig: { extra: { apiUrl: 'http://api.test/' } } }));
jest.mock('@shared/lib/auth/tokenStore', () => ({
  tokenStore: { get: jest.fn().mockResolvedValue('tok') },
}));

function respond(status: number, body?: unknown) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === undefined ? '' : JSON.stringify(body)),
  }) as jest.Mock;
}

describe('api client', () => {
  it('adjunta el token y serializa el body', async () => {
    respond(200, { ok: true });
    await expect(api.post('/api/x', { a: 1 })).resolves.toEqual({ ok: true });
    expect(global.fetch).toHaveBeenCalledWith('http://api.test/api/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer tok' },
      body: '{"a":1}',
    });
  });

  it('convierte {code, message} del backend en ApiError', async () => {
    respond(403, { code: 'permission-denied', message: 'No eres profesor de este curso.' });
    await expect(api.get('/api/x')).rejects.toEqual(
      new ApiError(403, 'permission-denied', 'No eres profesor de este curso.')
    );
  });

  it('getOrNull: 404 es null, cualquier otro error se propaga', async () => {
    respond(404, { code: 'not-found', message: 'x' });
    await expect(api.getOrNull('/api/x')).resolves.toBeNull();
    respond(500, { code: 'internal', message: 'Error interno.' });
    await expect(api.getOrNull('/api/x')).rejects.toBeInstanceOf(ApiError);
  });

  it('respuesta vacía (204) resuelve a null', async () => {
    respond(204);
    await expect(api.del('/api/x')).resolves.toBeNull();
  });

  it('sin red lanza ApiError status 0', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as jest.Mock;
    await expect(api.get('/api/x')).rejects.toMatchObject({ status: 0, code: 'unavailable' });
  });
});
