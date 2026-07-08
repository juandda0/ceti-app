import {
  clasificarTexto,
  parseClasificacion,
  DESCRIPCION_MAX,
  type AnthropicLike,
} from './vozClasificacion';

function mockClient(text: string | undefined): AnthropicLike {
  return {
    messages: {
      create: jest.fn().mockResolvedValue({
        content: text === undefined ? [] : [{ type: 'text', text }],
      }),
    },
  };
}

describe('clasificarTexto', () => {
  it('devuelve la clasificación validada en el caso feliz', async () => {
    const client = mockClient(
      JSON.stringify({
        tipo: 'gasto',
        monto: 5000,
        descripcion: 'helado',
        categoria: 'comida',
        confianza: 0.97,
      })
    );
    const result = await clasificarTexto('gasté cinco mil en un helado', client);
    expect(result).toEqual({
      tipo: 'gasto',
      monto: 5000,
      descripcion: 'helado',
      categoria: 'comida',
      confianza: 0.97,
    });
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-haiku-4-5',
        messages: [{ role: 'user', content: 'gasté cinco mil en un helado' }],
      })
    );
  });

  it('lanza si el modelo devuelve JSON malformado', async () => {
    await expect(clasificarTexto('x', mockClient('{no es json'))).rejects.toThrow();
  });

  it('lanza si el modelo no devuelve texto', async () => {
    await expect(clasificarTexto('x', mockClient(undefined))).rejects.toThrow(
      'El modelo no devolvió texto.'
    );
  });
});

describe('parseClasificacion', () => {
  const base = {
    tipo: 'gasto',
    monto: 1000,
    descripcion: 'algo',
    categoria: 'comida',
    confianza: 0.9,
  };

  it('normaliza categoría desconocida a otros con confianza penalizada', () => {
    const result = parseClasificacion({ ...base, categoria: 'apuestas' });
    expect(result.categoria).toBe('otros');
    expect(result.confianza).toBeLessThanOrEqual(0.5);
  });

  it('lanza con tipo inválido', () => {
    expect(() => parseClasificacion({ ...base, tipo: 'prestamo' })).toThrow();
  });

  it('lanza con monto negativo, no entero o gigante', () => {
    expect(() => parseClasificacion({ ...base, monto: -100 })).toThrow();
    expect(() => parseClasificacion({ ...base, monto: 10.5 })).toThrow();
    expect(() => parseClasificacion({ ...base, monto: 200_000_000 })).toThrow();
    expect(() => parseClasificacion({ ...base, monto: '5000' })).toThrow();
  });

  it('clampa la confianza a [0, 1]', () => {
    expect(parseClasificacion({ ...base, confianza: 1.7 }).confianza).toBe(1);
    expect(parseClasificacion({ ...base, confianza: -0.2 }).confianza).toBe(0);
  });

  it('recorta la descripción larga', () => {
    const result = parseClasificacion({ ...base, descripcion: 'x'.repeat(400) });
    expect(result.descripcion).toHaveLength(DESCRIPCION_MAX);
  });
});
