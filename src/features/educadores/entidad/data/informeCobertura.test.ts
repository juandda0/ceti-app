import { calcularPanelEntidad, dominiosDeCurso } from '@/functions/src/educadores/dominio';
import { hojasInformeCobertura, informeCoberturaHtml, nombrePeriodo } from './informeCobertura';

const AHORA = Date.parse('2026-10-30T12:00:00-05:00');

function panel() {
  const progreso = Array.from({ length: 6 }, (_, i) => ({ uid: `e${i}`, competencia: 'presupuesto', mastery: 0.8, updatedAt: AHORA }));
  return calcularPanelEntidad(
    [
      {
        id: 'k1',
        nombre: '10°A',
        grado: '10',
        profesorUids: ['p'],
        estudiantes: 6,
        estudiantesActivos: 6,
        ultimaActividad: AHORA,
        comunicados7d: 0,
        familiasConResumen: 0,
        ...dominiosDeCurso(progreso, new Set(progreso.map((p) => p.uid))),
      },
    ],
    [{ uid: 'p', nombre: 'Laura', rol: 'admin' }],
    AHORA
  );
}

describe('informe de cobertura', () => {
  const ctx = { entidad: 'Colegio <San> Mateo', tipo: 'Colegio', periodo: 'Todo el historial', generado: AHORA };

  it('cita las normas, el periodo y los ámbitos, sin nombres de estudiantes', () => {
    const html = informeCoberturaHtml(panel(), ctx);
    for (const t of ['Ley 1450 de 2011', 'Documento 26', 'Decreto 457 de 2014 (antecedente)', 'Derogado por el artículo 19 del Decreto 1517 de 2021', 'Decreto 1517 de 2021', 'CONPES 4005 de 2020', 'Presupuesto', 'Planear', 'Todo el historial', 'Grados 10-11']) {
      expect(html).toContain(t);
    }
    expect(html).toContain('Colegio &lt;San&gt; Mateo');
    expect(html).toContain('6 est. · 80 %');
    expect(html).not.toMatch(/e[0-5]\b/);
  });

  it('a una universidad no le cita las orientaciones de la básica', () => {
    const html = informeCoberturaHtml(panel(), { ...ctx, tipo: 'Universidad', tipoId: 'universidad' });
    expect(html).not.toContain('Ley 1450');
    expect(html).toContain('<b>CONPES 4005 de 2020.</b>');
  });

  it('el xlsx trae resumen, ámbitos y competencias por grado', () => {
    const hojas = hojasInformeCobertura(panel(), ctx);
    expect(hojas.map((h) => h.nombre)).toEqual(['Resumen', 'Ámbitos por grado', 'Competencias por grado']);
    expect(hojas[1].filas[1].slice(0, 3)).toEqual(['10°', '10-11', 6]);
  });

  it('nombra el periodo con sus fechas', () => {
    expect(nombrePeriodo({ nombre: 'Primer trimestre', desde: '2026-01-26', hasta: '2026-04-24' })).toBe('Primer trimestre (26/01/2026 a 24/04/2026)');
    expect(nombrePeriodo(null)).toBe('Todo el historial');
  });
});
