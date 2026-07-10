import {
  clasificarTexto,
  parseClasificacion,
  DESCRIPCION_MAX,
  type ModelCaller,
} from './vozClasificacion';

function mockCaller(json: string): ModelCaller {
  return jest.fn().mockResolvedValue(json) as unknown as ModelCaller;
}

describe('clasificarTexto', () => {
  it('devuelve la clasificación validada en el caso feliz', async () => {
    const call = mockCaller(
      JSON.stringify({
        intencion: 'movimiento',
        tipo: 'gasto',
        monto: 5000,
        descripcion: 'helado',
        categoria: 'comida',
        confianza: 0.97,
      })
    );
    const result = await clasificarTexto('gasté cinco mil en un helado', call);
    expect(result).toEqual({
      intencion: 'movimiento',
      tipo: 'gasto',
      monto: 5000,
      descripcion: 'helado',
      categoria: 'comida',
      confianza: 0.97,
    });
    // El caller recibe (systemPrompt, userText) — el texto del usuario intacto.
    expect(call).toHaveBeenCalledWith(expect.any(String), 'gasté cinco mil en un helado');
  });

  it('lanza si el modelo devuelve JSON malformado', async () => {
    await expect(clasificarTexto('x', mockCaller('{no es json'))).rejects.toThrow();
  });
});

describe('parseClasificacion', () => {
  const base = {
    intencion: 'movimiento',
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

  it('conserva la intención crear_meta y abonar_meta', () => {
    expect(parseClasificacion({ ...base, intencion: 'crear_meta' }).intencion).toBe('crear_meta');
    expect(parseClasificacion({ ...base, intencion: 'abonar_meta' }).intencion).toBe('abonar_meta');
  });

  it('degrada intención desconocida (o ausente) a movimiento', () => {
    expect(parseClasificacion({ ...base, intencion: 'transferir' }).intencion).toBe('movimiento');
    const { intencion: _omit, ...sinIntencion } = base;
    expect(parseClasificacion(sinIntencion).intencion).toBe('movimiento');
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
