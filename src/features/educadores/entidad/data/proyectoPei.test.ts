import { calcularPanelEntidad, dominiosDeCurso, periodosDelAnio } from '@/functions/src/educadores/dominio';
import { mundosDeAmbito, mundosPorPeriodo, proyectoPeiHtml } from './proyectoPei';

const AHORA = Date.parse('2026-10-30T12:00:00-05:00');

function panel() {
  const progreso = Array.from({ length: 6 }, (_, i) => ({ uid: `e${i}`, competencia: 'presupuesto', mastery: 0.4, updatedAt: AHORA }));
  return calcularPanelEntidad(
    [2, 10].map((g) => ({
      id: `k${g}`,
      nombre: `${g}°A`,
      grado: String(g),
      profesorUids: ['p'],
      estudiantes: 6,
      estudiantesActivos: 6,
      ultimaActividad: AHORA,
      comunicados7d: 0,
      familiasConResumen: 0,
      ...dominiosDeCurso(progreso, new Set(progreso.map((p) => p.uid))),
    })),
    [{ uid: 'p', nombre: 'Laura', rol: 'admin' }],
    AHORA
  );
}

describe('borrador del proyecto pedagógico (PEI)', () => {
  it('reparte los 6 mundos entre los periodos en orden', () => {
    expect(mundosPorPeriodo(4)).toEqual([['world_1', 'world_2'], ['world_3'], ['world_4', 'world_5'], ['world_6']]);
    expect(mundosPorPeriodo(2)).toEqual([['world_1', 'world_2', 'world_3'], ['world_4', 'world_5', 'world_6']]);
    expect(mundosDeAmbito('politicaEconomica')).toEqual(['Constelación del País']);
  });

  it('arma los pasos de la Tabla 15 con los datos de la entidad y deja lo demás por ajustar', () => {
    const html = proyectoPeiHtml(panel(), {
      entidad: 'Colegio <San> Mateo',
      anio: 2026,
      periodos: periodosDelAnio(null, 2026),
      generado: AHORA,
    });
    for (const t of [
      'Colegio &lt;San&gt; Mateo',
      'no es una asignatura nueva',
      '2. Análisis del contexto',
      '3. Problemática priorizada',
      'Grados 1-3',
      'Grados 10-11',
      'Diferencia deseos y necesidades',
      'Periodo 1',
      'Prueba de entrada en la primera semana.',
      'Presupuesto (40 %)',
      'Decreto 1517 de 2021',
      '[POR AJUSTAR]',
    ]) {
      expect(html).toContain(t);
    }
    expect(html).not.toMatch(/\be[0-5]\b/);
  });
});
