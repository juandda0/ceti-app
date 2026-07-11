import {
  buildItemUserText,
  generarBorrador,
  generarItem,
  parseBorradorMundo,
  parseItemBorrador,
  type BorradorMc,
} from './mundoBorrador';
import { ModelApiError, type ModelCaller } from './vozClasificacion';

const validRaw = {
  nombre: 'La Feria del Trueque',
  subtitle: 'Negociar con cabeza',
  descripcion: 'Aprende a comparar precios y negociar.',
  teoria: [
    { titulo: 'Comparar', cuerpo: 'Antes de comprar, compara al menos dos opciones.' },
    { titulo: 'Negociar', cuerpo: 'Negociar es buscar un acuerdo justo.', ejemplo: 'En la plaza.' },
  ],
  mc: Array.from({ length: 6 }, (_, i) => ({
    enunciado: `Pregunta de opción múltiple número ${i + 1}`,
    opciones: ['a', 'b', 'c', 'd'],
    correctIndex: i % 4,
    explicacion: 'Porque sí.',
  })),
  vf: Array.from({ length: 5 }, (_, i) => ({
    enunciado: `Afirmación número ${i + 1} sobre el tema`,
    respuesta: i % 2 === 0,
  })),
  ordenar: Array.from({ length: 4 }, (_, i) => ({
    enunciado: `Ordena los pasos del caso ${i + 1}`,
    elementosCorrectos: ['paso uno', 'paso dos', 'paso tres'],
  })),
  eligeCamino: [
    {
      enunciado: 'Te ofrecen dos formas de pago',
      opcionA: { texto: 'De contado', consecuencia: 'Pagas menos en total.' },
      opcionB: { texto: 'A cuotas', consecuencia: 'Pagas más pero por partes.' },
    },
  ],
};

describe('parseBorradorMundo', () => {
  it('acepta un borrador válido completo', () => {
    const b = parseBorradorMundo(validRaw);
    expect(b.mc).toHaveLength(6);
    expect(b.vf).toHaveLength(5);
    expect(b.ordenar).toHaveLength(4);
    expect(b.teoria).toHaveLength(2);
    expect(b.eligeCamino).toHaveLength(1);
  });

  it('descarta ítems inválidos (MC con correctIndex fuera de rango)', () => {
    const raw = {
      ...validRaw,
      mc: [
        ...validRaw.mc,
        { enunciado: 'Pregunta rota con índice malo', opciones: ['a', 'b', 'c'], correctIndex: 7 },
      ],
    };
    expect(parseBorradorMundo(raw).mc).toHaveLength(6);
  });

  it('lanza si una sección queda por debajo del mínimo de activación (R9)', () => {
    expect(() => parseBorradorMundo({ ...validRaw, mc: validRaw.mc.slice(0, 2) })).toThrow(
      /insuficiente/
    );
  });

  it('lanza si la raíz no es un objeto', () => {
    expect(() => parseBorradorMundo('hola')).toThrow();
  });

  it('trunca strings largos y omite explicaciones vacías', () => {
    const raw = {
      ...validRaw,
      vf: validRaw.vf.map((q) => ({ ...q, enunciado: 'x'.repeat(1000), explicacion: '   ' })),
    };
    const b = parseBorradorMundo(raw);
    expect(b.vf[0].enunciado).toHaveLength(400);
    expect(b.vf[0].explicacion).toBeUndefined();
  });
});

describe('generarBorrador', () => {
  it('propaga ModelApiError cuando el modelo no devuelve JSON', async () => {
    const call: ModelCaller = jest.fn().mockResolvedValue('esto no es json');
    await expect(generarBorrador({ nombre: 'x', tema: 'y', grado: '9' }, call)).rejects.toThrow(
      ModelApiError
    );
  });

  it('pasa solo nombre/tema/grado al modelo (nunca PII, RQ-CN06 CA2)', async () => {
    const call = jest.fn().mockResolvedValue(JSON.stringify(validRaw)) as unknown as ModelCaller;
    await generarBorrador({ nombre: 'Feria', tema: 'trueque', grado: '10' }, call);
    const [, userText] = (call as unknown as jest.Mock).mock.calls[0];
    expect(userText).toBe('NOMBRE: Feria\nTEMA: trueque\nGRADO: 10');
  });
});

describe('parseItemBorrador', () => {
  const mcRaw = {
    enunciado: 'Una pregunta válida de prueba',
    opciones: ['a', 'b', 'c'],
    correctIndex: 1,
  };

  it('acepta un ítem envuelto en { item: {...} }', () => {
    const item = parseItemBorrador('mc', { item: mcRaw }) as BorradorMc;
    expect(item.correctIndex).toBe(1);
    expect(item.opciones).toHaveLength(3);
  });

  it('acepta el ítem sin envolver', () => {
    const item = parseItemBorrador('mc', mcRaw) as BorradorMc;
    expect(item.enunciado).toContain('pregunta');
  });

  it('lanza si el ítem es inválido para el tipo (correctIndex fuera de rango)', () => {
    expect(() => parseItemBorrador('mc', { ...mcRaw, correctIndex: 9 })).toThrow(/Ítem inválido/);
  });

  it('lanza si la raíz no es un objeto', () => {
    expect(() => parseItemBorrador('vf', 'nope')).toThrow();
  });
});

describe('buildItemUserText', () => {
  it('incluye teoría y previas como contexto para preguntas', () => {
    const text = buildItemUserText({
      tipo: 'mc',
      nombre: 'Feria',
      descripcion: 'sobre trueque',
      grado: '9',
      esPrimera: false,
      teoria: ['Comparar: mira dos opciones'],
      previas: ['¿Qué es comparar precios?'],
      detalle: 'enfoque en descuentos',
    });
    expect(text).toContain('PRIMERA PIEZA: no');
    expect(text).toContain('ENFOQUE PEDIDO: enfoque en descuentos');
    expect(text).toContain('TEORÍA DEL MUNDO');
    expect(text).toContain('PREGUNTAS YA EXISTENTES');
  });

  it('ignora la teoría al generar teoría (evita redundancia) y marca la primera', () => {
    const text = buildItemUserText({
      tipo: 'teoria',
      nombre: 'Feria',
      descripcion: 'sobre trueque',
      grado: '9',
      esPrimera: true,
      teoria: ['no debería aparecer'],
      previas: ['Comparar'],
    });
    expect(text).toContain('PRIMERA PIEZA: sí');
    expect(text).not.toContain('TEORÍA DEL MUNDO');
    expect(text).toContain('TÍTULOS DE TEORÍA YA EXISTENTES');
  });
});

describe('generarItem', () => {
  it('propaga ModelApiError cuando el modelo no devuelve JSON', async () => {
    const call: ModelCaller = jest.fn().mockResolvedValue('no json');
    await expect(
      generarItem({ tipo: 'vf', nombre: 'x', descripcion: 'y', grado: '9', esPrimera: true }, call)
    ).rejects.toThrow(ModelApiError);
  });

  it('devuelve el ítem validado del tipo pedido', async () => {
    const call = jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({ item: { enunciado: 'Ahorrar siempre conviene', respuesta: true } })
      ) as unknown as ModelCaller;
    const item = await generarItem(
      { tipo: 'vf', nombre: 'Feria', descripcion: 'trueque', grado: '10', esPrimera: false },
      call
    );
    expect(item).toEqual({ enunciado: 'Ahorrar siempre conviene', respuesta: true });
  });
});
