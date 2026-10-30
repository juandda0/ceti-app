import { hojasDelAnalisis, informeHtml } from './exportarAnalisis';
import type { AnalisisClase } from './analisisClase';

const mundos = [{ id: 'world_1', nombre: 'Planeta Origen', competencia: 'dinero' }];
const analisis: AnalisisClase = {
  mapa: [
    {
      uid: 'a',
      nombre: 'Ana <Pérez>',
      celdas: { world_1: { estado: 'conquistado', acierto: 0.8 } },
      nota: 4.24,
      acierto: 0.8,
      respuestas: 10,
      ultimaActividad: null,
    },
  ],
  preguntas: [
    {
      id: 'q',
      worldId: 'world_1',
      mundo: 'Planeta Origen',
      enunciado: '¿Qué es ahorrar?',
      respuestas: 4,
      estudiantes: 4,
      facilidad: 0.25,
      discriminacion: 0.456,
      erradaMasElegida: { texto: 'Gastar', veces: 3 },
      dificil: true,
      revisar: false,
    },
  ],
  semanas: [{ inicio: 0, activos: 1, respuestas: 10, minutos: 5 }],
  activosSemana: 1,
  sinEntrar7: [],
  tareas: [],
  grupos: { sinEntrar7: [], bajoTres: [] },
};

describe('exportar el análisis', () => {
  it('cuatro hojas con encabezados y valores redondeados', () => {
    const hojas = hojasDelAnalisis(analisis, mundos);
    expect(hojas.map((h) => h.nombre)).toEqual(['Estudiantes', 'Preguntas', 'Actividad', 'Tareas']);
    expect(hojas[0].filas[1]).toEqual(['Ana <Pérez>', 4.2, 'Alto', 80, 10, '', 'Conquistado', 80]);
    expect(hojas[1].filas[1]).toEqual([
      'Planeta Origen',
      '¿Qué es ahorrar?',
      4,
      4,
      25,
      0.46,
      'Gastar',
      3,
      'Sí',
      '',
    ]);
  });

  it('el informe escapa el texto', () => {
    const html = informeHtml(analisis, mundos, {
      curso: '10°B',
      periodo: 'Periodo 4',
      generado: 0,
    });
    expect(html).toContain('Ana &lt;Pérez&gt;');
    expect(html).toContain('Gastar (3)');
    expect(html).toContain('<td>4,2</td>');
  });
});
