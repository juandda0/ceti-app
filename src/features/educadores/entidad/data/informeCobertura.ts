/**
 * Informe de cobertura de la educación económica y financiera (Fase 6): la
 * evidencia que la entidad presenta en su PEI, a la Secretaría de Educación o en
 * una auditoría. Cita las normas por su nombre, el periodo, los grados o
 * programas y los ámbitos y competencias de las orientaciones del MEN. Solo
 * cifras de grupo. PDF (HTML para imprimir) y .xlsx. Puro.
 */
import type { Hoja } from '@shared/lib/export/xlsx';
import {
  AMBITOS_MEN,
  COMPETENCIAS_MEN,
  MIN_GRUPO,
  NOMBRE_COMPETENCIA_MEN,
  NOMBRE_EJE_MEN,
  NORMAS_EEF,
  fechaBogota,
  type CeldaCobertura,
  type PanelEntidad,
} from '@/functions/src/educadores/dominio';

export interface ContextoInforme {
  entidad: string;
  tipo: string;
  /** "Segundo trimestre 2026" o "Todo el historial". */
  periodo: string;
  generado: number;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const pct = (x: number | null) => (x == null ? '' : `${Math.round(x * 100)} %`);

function fecha(ms: number): string {
  const [a, m, d] = fechaBogota(ms).split('-');
  return `${d}/${m}/${a}`;
}

function celda(c: CeldaCobertura): string {
  if (c.estudiantes === 0) return 'Sin trabajar';
  return c.dominio == null ? `${c.estudiantes} est.` : `${c.estudiantes} est. · ${pct(c.dominio)}`;
}

export const NOTA_ALINEACION =
  'La relación entre los mundos de Ceti y los ámbitos y competencias es una alineación hecha por Ceti a partir del contenido de cada mundo; no es un concepto del Ministerio de Educación.';

export function nombrePeriodo(p: { nombre: string; desde: string; hasta: string } | null): string {
  if (!p) return 'Todo el historial';
  const f = (iso: string) => iso.split('-').reverse().join('/');
  return `${p.nombre} (${f(p.desde)} a ${f(p.hasta)})`;
}

export function hojasInformeCobertura(panel: PanelEntidad, ctx: ContextoInforme): Hoja[] {
  const r = panel.resumen;
  return [
    {
      nombre: 'Resumen',
      filas: [
        ['Informe de cobertura de educación económica y financiera'],
        ['Entidad', ctx.entidad],
        ['Tipo', ctx.tipo],
        ['Periodo', ctx.periodo],
        ['Generado', fecha(ctx.generado)],
        [],
        ['Clases', r.clases],
        ['Estudiantes', r.estudiantes],
        ['Estudiantes activos (30 días)', r.estudiantesActivos],
        ['Profes', r.profes],
        ['Ámbitos de las orientaciones del MEN trabajados', `${panel.ambitosCubiertos.length} de ${AMBITOS_MEN.length}`],
        [],
        ['Marco normativo'],
        ...NORMAS_EEF.map((n) => [n.nombre, n.alcance]),
        [],
        [NOTA_ALINEACION],
        [`Cifras de grupo: un grupo con menos de ${MIN_GRUPO} estudiantes con datos no muestra su dominio.`],
      ],
    },
    {
      nombre: 'Ámbitos por grado',
      filas: [
        ['Grado o programa', 'Grupo de grados MEN', 'Estudiantes', ...AMBITOS_MEN.map((a) => `${NOMBRE_EJE_MEN[a.eje]}: ${a.nombre}`)],
        ...panel.cobertura.flatMap((f) => [
          [f.etiqueta, f.grupoMen ?? '', f.estudiantes, ...AMBITOS_MEN.map((a) => f.ambitos[a.id].estudiantes)],
          [`${f.etiqueta} · dominio`, '', '', ...AMBITOS_MEN.map((a) => pct(f.ambitos[a.id].dominio))],
        ]),
      ],
    },
    {
      nombre: 'Competencias por grado',
      filas: [
        ['Grado o programa', ...COMPETENCIAS_MEN.flatMap((c) => [`${NOMBRE_COMPETENCIA_MEN[c]} · estudiantes`, `${NOMBRE_COMPETENCIA_MEN[c]} · dominio`])],
        ...panel.cobertura.map((f) => [
          f.etiqueta,
          ...COMPETENCIAS_MEN.flatMap((c) => [f.competencias[c].estudiantes, pct(f.competencias[c].dominio)]),
        ]),
      ],
    },
  ];
}

export function informeCoberturaHtml(panel: PanelEntidad, ctx: ContextoInforme): string {
  const r = panel.resumen;
  const cab = AMBITOS_MEN.map((a) => `<th>${esc(a.nombre)}<br><small>${esc(NOMBRE_EJE_MEN[a.eje])}</small></th>`).join('');
  const filas = panel.cobertura
    .map(
      (f) =>
        `<tr><td><b>${esc(f.etiqueta)}</b>${f.grupoMen ? `<br><small>Grados ${f.grupoMen}</small>` : ''}<br><small>${f.estudiantes} est.</small></td>${AMBITOS_MEN.map(
          (a) => `<td class="${f.ambitos[a.id].estudiantes > 0 ? 'si' : 'no'}">${esc(celda(f.ambitos[a.id]))}</td>`
        ).join('')}</tr>`
    )
    .join('');
  const comp = panel.cobertura
    .map(
      (f) =>
        `<tr><td><b>${esc(f.etiqueta)}</b></td>${COMPETENCIAS_MEN.map(
          (c) => `<td class="${f.competencias[c].estudiantes > 0 ? 'si' : 'no'}">${esc(celda(f.competencias[c]))}</td>`
        ).join('')}</tr>`
    )
    .join('');
  const normas = NORMAS_EEF.map((n) => `<li><b>${esc(n.nombre)}.</b> ${esc(n.alcance)}</li>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cobertura EEF · ${esc(ctx.entidad)}</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#16161a;margin:32px;font-size:12px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 6px}
.meta{color:#555;margin:0 0 14px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #ccc;padding:5px;text-align:left;vertical-align:top}
th{background:#f3f0ec;font-size:10px}td.si{background:#e4f4ea}td.no{color:#999}small{color:#666}ul{margin:4px 0;padding-left:18px}.nota{color:#555;font-size:11px}
.cifras{display:flex;gap:18px;margin:8px 0}.cifras div{border:1px solid #ddd;border-radius:6px;padding:8px 12px}.cifras b{font-size:16px;display:block}</style></head><body>
<h1>Informe de cobertura de educación económica y financiera</h1>
<p class="meta">${esc(ctx.entidad)} · ${esc(ctx.tipo)} · Periodo: ${esc(ctx.periodo)} · Generado el ${fecha(ctx.generado)} con Ceti</p>
<div class="cifras"><div><b>${panel.ambitosCubiertos.length} de ${AMBITOS_MEN.length}</b>ámbitos trabajados</div><div><b>${r.clases}</b>clases</div><div><b>${r.estudiantes}</b>estudiantes</div><div><b>${pct(r.adopcion)}</b>activos en 30 días</div></div>
<h2>Marco normativo</h2><ul>${normas}</ul>
<h2>Ámbitos conceptuales por grado o programa</h2>
<p class="nota">Orientaciones pedagógicas para la educación económica y financiera del MEN (Documento 26, versión 2022): ejes Economía, Finanzas y Gestión del riesgo. Cada celda: estudiantes con avance y dominio promedio.</p>
<table><thead><tr><th>Grado o programa</th>${cab}</tr></thead><tbody>${filas}</tbody></table>
<h2>Competencias de la educación económica y financiera</h2>
<table><thead><tr><th>Grado o programa</th>${COMPETENCIAS_MEN.map((c) => `<th>${esc(NOMBRE_COMPETENCIA_MEN[c])}</th>`).join('')}</tr></thead><tbody>${comp}</tbody></table>
<p class="nota">${esc(NOTA_ALINEACION)} Cifras de grupo: un grupo con menos de ${MIN_GRUPO} estudiantes con datos no muestra su dominio, y ningún dato identifica a un estudiante.</p>
</body></html>`;
}
