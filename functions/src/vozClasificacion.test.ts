import {
  clasificarTexto,
  parseClasificacion,
  parseClasificaciones,
  parseItem,
  DESCRIPCION_MAX,
  SYSTEM_PROMPT,
  type ModelCaller,
} from './vozClasificacion';

function mockCaller(json: string): ModelCaller {
  return jest.fn().mockResolvedValue(json) as unknown as ModelCaller;
}

const base = {
  intencion: 'movimiento',
  tipo: 'gasto',
  monto: 1000,
  descripcion: 'algo',
  categoria: 'comida',
  confianza: 0.9,
  offsetDias: 0,
};

const NO_ENTENDIDO = {
  intencion: 'no_entendido',
  tipo: 'gasto',
  monto: 0,
  descripcion: '',
  categoria: 'otros',
  confianza: 0,
  offsetDias: 0,
};

describe('clasificarTexto (v2, devuelve lista)', () => {
  it('caso feliz: envuelve/normaliza el shape v2', async () => {
    const call = mockCaller(
      JSON.stringify({
        movimientos: [
          { ...base, tipo: 'gasto', monto: 5000, descripcion: 'helado', confianza: 0.97 },
        ],
      })
    );
    const result = await clasificarTexto('gasté cinco mil en un helado', call);
    expect(result).toEqual([
      {
        intencion: 'movimiento',
        tipo: 'gasto',
        monto: 5000,
        descripcion: 'helado',
        categoria: 'comida',
        confianza: 0.97,
        offsetDias: 0,
      },
    ]);
    expect(call).toHaveBeenCalledWith(expect.any(String), 'gasté cinco mil en un helado');
  });

  it('objeto plano legacy → lista de 1', async () => {
    const result = await clasificarTexto('x', mockCaller(JSON.stringify(base)));
    expect(result).toHaveLength(1);
    expect(result[0].offsetDias).toBe(0);
  });

  it('lanza si el modelo devuelve JSON malformado', async () => {
    await expect(clasificarTexto('x', mockCaller('{no es json'))).rejects.toThrow();
  });
});

describe('parseClasificaciones', () => {
  it('array de 3 ítems → 3 clasificaciones', () => {
    const raw = { movimientos: [base, { ...base, monto: 2000 }, { ...base, monto: 3000 }] };
    expect(parseClasificaciones(raw)).toHaveLength(3);
  });

  it('7 ítems → cap a 5', () => {
    const raw = { movimientos: Array.from({ length: 7 }, (_, i) => ({ ...base, monto: i + 1 })) };
    expect(parseClasificaciones(raw)).toHaveLength(5);
  });

  it('array vacío → rechazo canónico', () => {
    expect(parseClasificaciones({ movimientos: [] })).toEqual([NO_ENTENDIDO]);
  });

  it('objeto plano legacy → lista de 1 con offsetDias 0', () => {
    expect(parseClasificaciones(base)).toEqual([base]);
  });

  it('descarta ítems inválidos sin tumbar los válidos', () => {
    const raw = { movimientos: [base, { ...base, monto: -5 }, { ...base, tipo: 'x' }] };
    expect(parseClasificaciones(raw)).toHaveLength(1);
  });

  it('todos inválidos → rechazo canónico', () => {
    const raw = {
      movimientos: [
        { ...base, monto: -5 },
        { ...base, tipo: 'x' },
      ],
    };
    expect(parseClasificaciones(raw)).toEqual([NO_ENTENDIDO]);
  });

  it('en lote descarta no_entendido y crear_meta; en single los conserva', () => {
    const raw = {
      movimientos: [
        base,
        { ...base, intencion: 'no_entendido' },
        { ...base, intencion: 'crear_meta' },
      ],
    };
    const multi = parseClasificaciones(raw);
    expect(multi).toHaveLength(1);
    expect(multi[0].intencion).toBe('movimiento');

    expect(parseClasificaciones({ ...base, intencion: 'crear_meta' })[0].intencion).toBe(
      'crear_meta'
    );
    expect(parseClasificaciones({ ...base, intencion: 'no_entendido' })).toEqual([NO_ENTENDIDO]);
  });
});

describe('parseItem — fecha relativa', () => {
  it('offsetDias ausente → 0', () => {
    const { offsetDias: _o, ...sinFecha } = base;
    expect(parseItem(sinFecha)?.offsetDias).toBe(0);
  });
  it('preserva -1 y -30, clampa -45 a -30', () => {
    expect(parseItem({ ...base, offsetDias: -1 })?.offsetDias).toBe(-1);
    expect(parseItem({ ...base, offsetDias: -30 })?.offsetDias).toBe(-30);
    expect(parseItem({ ...base, offsetDias: -45 })?.offsetDias).toBe(-30);
  });
  it('nunca futuro ni no-entero', () => {
    expect(parseItem({ ...base, offsetDias: 3 })?.offsetDias).toBe(0);
    expect(parseItem({ ...base, offsetDias: 1.5 })?.offsetDias).toBe(0);
    expect(parseItem({ ...base, offsetDias: 'ayer' })?.offsetDias).toBe(0);
  });
  it('diaSemana válido se preserva (sin tilde); inválido se descarta', () => {
    expect(parseItem({ ...base, diaSemana: 'viernes' })?.diaSemana).toBe('viernes');
    expect(parseItem({ ...base, diaSemana: 'miércoles' })?.diaSemana).toBe('miercoles');
    expect(parseItem({ ...base, diaSemana: 'febrero' })?.diaSemana).toBeUndefined();
  });
});

describe('parseClasificacion (compat de un ítem)', () => {
  it('normaliza categoría desconocida a otros con confianza penalizada', () => {
    const result = parseClasificacion({ ...base, categoria: 'apuestas' });
    expect(result.categoria).toBe('otros');
    expect(result.confianza).toBeLessThanOrEqual(0.5);
  });

  it('conserva crear_meta y abonar_meta', () => {
    expect(parseClasificacion({ ...base, intencion: 'crear_meta' }).intencion).toBe('crear_meta');
    expect(parseClasificacion({ ...base, intencion: 'abonar_meta' }).intencion).toBe('abonar_meta');
  });

  it('degrada intención desconocida a movimiento', () => {
    expect(parseClasificacion({ ...base, intencion: 'transferir' }).intencion).toBe('movimiento');
  });

  it('no_entendido cortocircuita a rechazo neutro aunque tipo/monto sean basura', () => {
    expect(
      parseClasificacion({
        intencion: 'no_entendido',
        tipo: 'lo_que_sea',
        monto: -999,
        descripcion: 'esto no importa',
        categoria: 'apuestas',
        confianza: 0.9,
      })
    ).toEqual(NO_ENTENDIDO);
  });

  it('lanza con tipo o monto inválido', () => {
    expect(() => parseClasificacion({ ...base, tipo: 'prestamo' })).toThrow();
    expect(() => parseClasificacion({ ...base, monto: -100 })).toThrow();
    expect(() => parseClasificacion({ ...base, monto: 10.5 })).toThrow();
    expect(() => parseClasificacion({ ...base, monto: '5000' })).toThrow();
  });

  it('clampa la confianza y recorta la descripción', () => {
    expect(parseClasificacion({ ...base, confianza: 1.7 }).confianza).toBe(1);
    expect(parseClasificacion({ ...base, confianza: -0.2 }).confianza).toBe(0);
    expect(parseClasificacion({ ...base, descripcion: 'x'.repeat(400) }).descripcion).toHaveLength(
      DESCRIPCION_MAX
    );
  });
});

describe('SYSTEM_PROMPT — guardas anti-regresión', () => {
  it('describe el shape array, las fechas y la jerga', () => {
    for (const token of [
      'movimientos',
      'offsetDias',
      'diaSemana',
      'lucas',
      'barras',
      'billete',
      'quincena',
      'máximo 5',
    ]) {
      expect(SYSTEM_PROMPT).toContain(token);
    }
  });
});
