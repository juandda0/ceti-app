/**
 * Informe de cobertura de la educación económica y financiera (Fase 6): la
 * evidencia que la entidad presenta en su PEI, a la Secretaría de Educación o en
 * una auditoría. Desde la Fase 7 trae los desempeños del MEN que logra cada
 * grado, el impacto de la prueba de entrada y salida, sirve para una sola clase
 * (profe con Piloto) y lleva el sello de un cierre de periodo. Cita las normas por su nombre, el periodo, los grados o
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
  fechaBogota,
  nombreAmbitoMen,
  normasPara,
  type Impacto,
  type Norma,
  type CeldaCobertura,
  type PanelEntidad,
} from '@/functions/src/educadores/dominio';

export interface ContextoInforme {
  entidad: string;
  /** Nombre para mostrar ("Colegio", "Universidad"…). */
  tipo: string;
  /** Tipo de entidad ('colegio' | 'universidad' | 'academia'…): decide qué normas se citan. */
  tipoId?: string | null;
  /** "Segundo trimestre 2026" o "Todo el historial". */
  periodo: string;
  generado: number;
  /** Fase 7: informe de una sola clase (el profe con Piloto). */
  clase?: string;
  /** Fase 7: copia fija de un cierre de periodo. */
  sello?: { cerradoAt: number; cerradoPorNombre: string; huella: string };
}

const pctTxt = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100)} %`);

function textoImpacto(i: Impacto): string {
  if (i.pre == null || i.post == null) return `${i.pares} est. con las dos pruebas (menos de ${MIN_GRUPO}: sin promedio)`;
  const cambio = Math.round((i.cambio ?? 0) * 100);
  return `${pctTxt(i.pre)} → ${pctTxt(i.post)} (${cambio >= 0 ? '+' : ''}${cambio} puntos) · ${i.pares} est.`;
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

/** "Nombre: alcance (vigencia)", para el PDF y el Excel. */
export function textoNorma(n: Norma): string {
  return n.vigencia ? `${n.alcance} ${n.vigencia}` : n.alcance;
}

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
        ...(ctx.clase ? [['Clase', ctx.clase]] : []),
        ['Periodo', ctx.periodo],
        ['Generado', fecha(ctx.generado)],
        ...(ctx.sello
          ? [['Cierre de periodo', `Copia fija del ${fecha(ctx.sello.cerradoAt)} (${ctx.sello.cerradoPorNombre}). Huella SHA-256: ${ctx.sello.huella}`]]
          : []),
        [],
        ['Clases', r.clases],
        ['Estudiantes', r.estudiantes],
        ['Estudiantes activos (30 días)', r.estudiantesActivos],
        ['Profes', r.profes],
        ['Ámbitos de las orientaciones del MEN trabajados', `${panel.ambitosCubiertos.length} de ${AMBITOS_MEN.length}`],
        ['Prueba de entrada y salida', panel.impacto ? textoImpacto(panel.impacto.total) : 'Sin datos'],
        [],
        ['Marco normativo'],
        ...normasPara(ctx.tipoId).map((n) => [n.nombre, textoNorma(n)]),
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
    {
      nombre: 'Desempeños por grado',
      filas: [
        ['Grado o programa', 'Ámbito', 'Desempeño (paráfrasis de Ceti)', 'Referencia', 'Estudiantes con datos', 'Lo logran', '% que lo logra'],
        ...panel.cobertura.flatMap((f) =>
          (f.desempenos ?? []).map((d) => [f.etiqueta, nombreAmbitoMen(d.ambito), `${d.id} · ${d.resumen}`, d.ref, d.estudiantes, d.logran, pct(d.logro)])
        ),
      ],
    },
    {
      nombre: 'Prueba entrada y salida',
      filas: [
        ['Grado o programa', 'Con entrada', 'Con las dos', 'Entrada', 'Salida', 'Cambio (puntos)', '% que subió'],
        ...(panel.impacto ? [{ etiqueta: 'Toda la entidad', ...panel.impacto.total }, ...panel.impacto.grupos] : []).map((g) => [
          g.etiqueta,
          g.conEntrada,
          g.pares,
          pct(g.pre),
          pct(g.post),
          g.cambio == null ? '' : Math.round(g.cambio * 100),
          pct(g.mejoran),
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
  const desempenos = panel.cobertura
    .filter((f) => (f.desempenos ?? []).length > 0)
    .map(
      (f) =>
        `<tr><td colspan="3"><b>${esc(f.etiqueta)}</b>${f.grupoMen ? ` · grados ${f.grupoMen}` : ''}</td></tr>${f.desempenos
          .map(
            (d) =>
              `<tr><td>${esc(d.resumen)}<br><small>${esc(nombreAmbitoMen(d.ambito))} · ${esc(d.id)} · ${esc(d.ref)}</small></td><td>${d.estudiantes}</td><td>${d.logro == null ? 'Grupo chico' : `${d.logran} · ${pct(d.logro)}`}</td></tr>`
          )
          .join('')}`
    )
    .join('');
  const impacto = panel.impacto;
  const filasImpacto = impacto
    ? [{ etiqueta: 'Toda la entidad', ...impacto.total }, ...impacto.grupos]
        .filter((g) => g.conEntrada > 0)
        .map((g) => `<tr><td><b>${esc(g.etiqueta)}</b></td><td>${g.conEntrada}</td><td>${esc(textoImpacto(g))}</td></tr>`)
        .join('')
    : '';
  const normas = normasPara(ctx.tipoId).map((n) => `<li><b>${esc(n.nombre)}.</b> ${esc(textoNorma(n))}</li>`).join('');
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cobertura EEF · ${esc(ctx.entidad)}</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#16161a;margin:32px;font-size:12px}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 6px}
.meta{color:#555;margin:0 0 14px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #ccc;padding:5px;text-align:left;vertical-align:top}
th{background:#f3f0ec;font-size:10px}td.si{background:#e4f4ea}td.no{color:#999}small{color:#666}ul{margin:4px 0;padding-left:18px}.nota{color:#555;font-size:11px}
.cifras{display:flex;gap:18px;margin:8px 0}.sello{border:1px solid #e0c9a8;background:#fff6ea;border-radius:6px;padding:8px 10px;font-size:11px}code{font-size:10px;word-break:break-all}.cifras div{border:1px solid #ddd;border-radius:6px;padding:8px 12px}.cifras b{font-size:16px;display:block}</style></head><body>
<h1>Informe de cobertura de educación económica y financiera</h1>
<p class="meta">${esc(ctx.entidad)} · ${esc(ctx.tipo)}${ctx.clase ? ` · Clase ${esc(ctx.clase)}` : ''} · Periodo: ${esc(ctx.periodo)} · Generado el ${fecha(ctx.generado)} con Ceti</p>
${ctx.sello ? `<p class="sello"><b>Cierre de periodo.</b> Copia fija guardada el ${fecha(ctx.sello.cerradoAt)} por ${esc(ctx.sello.cerradoPorNombre)}; no cambia después. Huella SHA-256: <code>${esc(ctx.sello.huella)}</code></p>` : ''}
${ctx.clase ? '<p class="sello">Informe de una sola clase. El de todos los grados de la institución, con la prueba de entrada y salida y los cierres de periodo, viene con el plan de la entidad.</p>' : ''}
<div class="cifras"><div><b>${panel.ambitosCubiertos.length} de ${AMBITOS_MEN.length}</b>ámbitos trabajados</div><div><b>${r.clases}</b>clases</div><div><b>${r.estudiantes}</b>estudiantes</div><div><b>${pct(r.adopcion)}</b>activos en 30 días</div></div>
<h2>Marco normativo</h2><ul>${normas}</ul>
<h2>Ámbitos conceptuales por grado o programa</h2>
<p class="nota">${ctx.tipoId === 'universidad' ? 'Como marco de referencia se usan los ámbitos de las orientaciones del MEN para la educación económica y financiera (pensadas para la básica y la media)' : 'Orientaciones pedagógicas para la educación económica y financiera del MEN (Documento 26, versión 2022)'}: ejes Economía, Finanzas y Gestión del riesgo. Cada celda: estudiantes con avance y dominio promedio.</p>
<table><thead><tr><th>Grado o programa</th>${cab}</tr></thead><tbody>${filas}</tbody></table>
<h2>Competencias de la educación económica y financiera</h2>
<table><thead><tr><th>Grado o programa</th>${COMPETENCIAS_MEN.map((c) => `<th>${esc(NOMBRE_COMPETENCIA_MEN[c])}</th>`).join('')}</tr></thead><tbody>${comp}</tbody></table>
<h2>Desempeños de las orientaciones del MEN</h2>
<p class="nota">Por grado, cuántos estudiantes respondieron al menos 2 preguntas de cada desempeño y cuántos acertaron el 60 % o más. Acumulado desde que entraron a la clase; el texto es una paráfrasis de Ceti, el oficial está en la tabla y página citadas.</p>
${desempenos ? `<table><thead><tr><th>Desempeño</th><th>Estudiantes</th><th>Lo logran</th></tr></thead><tbody>${desempenos}</tbody></table>` : '<p class="nota">Todavía no hay estudiantes con datos suficientes.</p>'}
<h2>Prueba de entrada y salida</h2>
${filasImpacto ? `<table><thead><tr><th>Grado o programa</th><th>Con entrada</th><th>Resultado</th></tr></thead><tbody>${filasImpacto}</tbody></table>` : '<p class="nota">Sin prueba de entrada y salida en este periodo.</p>'}
<p class="nota">${esc(NOTA_ALINEACION)} Cifras de grupo: un grupo con menos de ${MIN_GRUPO} estudiantes con datos no muestra su dominio, y ningún dato identifica a un estudiante.</p>
</body></html>`;
}
