import { groqCaller } from './modelProvider';

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

test('usa un modelo de Groq actualmente disponible para organizar registros', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"actions":[]}' } }] }),
  });
  global.fetch = fetchMock as unknown as typeof fetch;

  await groqCaller('clave-de-prueba')('sistema', 'solicitud');

  const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
  expect(JSON.parse(String(request.body))).toMatchObject({ model: 'qwen/qwen3.8-27b' });
});
