/**
 * Borrador del proyecto pedagógico transversal de educación económica y
 * financiera para el PEI (Fase 7). Sigue los pasos de las orientaciones del MEN
 * de 2022 para un proyecto de aula o transversal (Tabla 15): contexto,
 * problemática, formulación (título, justificación ligada al PEI y al PMI,
 * objetivos, metodología) y seguimiento; y la idea de una matriz de
 * articulación entre áreas y desempeños (Anexo 2). Con los datos de Ceti llena
 * el diagnóstico, los ámbitos y desempeños por grado, el cronograma por periodo
 * del SIEE y la evaluación; lo demás queda marcado [POR AJUSTAR] para que la
 * institución lo complete y lo apruebe. Las orientaciones aclaran que el
 * proyecto no es obligatorio: el texto lo dice. Puro: HTML que sirve para PDF y
 * para Word (.doc).
 */
import {
  AMBITOS_MEN,
  NOMBRE_EJE_MEN,
  desempenosDe,
  grupoGradoMen,
  normasPara,
  type AmbitoMen,
  type GrupoGradoMen,
  type PanelEntidad,
  type PeriodoConNombre,
} from '@/functions/src/educadores/dominio';
import { ALL_COMPETENCIAS, WORLD_ORDER, WORLD_COMPETENCIAS } from '@features/learning/data/competencias';
import { WORLD_DEFS } from '@features/learning/data/worldMeta';
import { textoNorma } from './informeCobertura';

/** Áreas que Ceti sugiere articular con cada ámbito (lectura de Ceti, para ajustar). */
export const AREAS_POR_AMBITO: Record<AmbitoMen, readonly string[]> = {
  contextoEconomico: ['Ciencias sociales', 'Ciencias naturales'],
  desarrolloEconomico: ['Ciencias sociales', 'Ciencias naturales'],
  politicaEconomica: ['Ciencias sociales', 'Competencias ciudadanas'],
  contextoFinanciero: ['Matemáticas', 'Ética y valores'],
  presupuesto: ['Matemáticas'],
  ahorroInversion: ['Matemáticas'],
  manejoDeudas: ['Matemáticas', 'Ética y valores'],
  sistemaFinanciero: ['Ciencias sociales', 'Tecnología e informática'],
  analisisRiesgos: ['Ciencias naturales', 'Educación física', 'Competencias ciudadanas'],
};

const POR_AJUSTAR = '<span class="aj">[POR AJUSTAR]</span>';
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);
const pct = (x: number | null | undefined) => (x == null ? '—' : `${Math.round(x * 100)} %`);
const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

/** Los mundos de Ceti que trabajan un ámbito. */
export function mundosDeAmbito(ambito: AmbitoMen): string[] {
  return WORLD_ORDER.filter((w) => (WORLD_COMPETENCIAS[w].men.ambitos as readonly string[]).includes(ambito)).map(
    (w) => WORLD_DEFS.find((d) => d.id === w)?.name ?? w
  );
}

/** Reparte los mundos de Ceti entre los periodos, en orden (el último periodo recibe el resto). */
export function mundosPorPeriodo(periodos: number): string[][] {
  const n = Math.max(1, periodos);
  const out: string[][] = Array.from({ length: n }, () => []);
  WORLD_ORDER.forEach((w, i) => out[Math.min(n - 1, Math.floor((i * n) / WORLD_ORDER.length))].push(w));
  return out;
}

export interface ContextoPei {
  entidad: string;
  tipoId?: string | null;
  anio: number;
  periodos: readonly PeriodoConNombre[];
  generado: number;
}

/** Grupos de grados que la entidad tiene (de sus grados con clases), en orden. */
export function gruposDeLaEntidad(panel: PanelEntidad): GrupoGradoMen[] {
  const set = new Set<GrupoGradoMen>();
  for (const f of panel.cobertura) {
    const g = f.grupoMen ?? grupoGradoMen(f.etiqueta.replace('°', ''));
    if (g) set.add(g);
  }
  return (['1-3', '4-5', '6-7', '8-9', '10-11'] as const).filter((g) => set.has(g));
}

export function proyectoPeiHtml(panel: PanelEntidad, ctx: ContextoPei): string {
  const grupos = gruposDeLaEntidad(panel);
  const debiles = AMBITOS_MEN.filter((a) => !panel.ambitosCubiertos.includes(a.id)).map((a) => a.nombre);
  const conDominio = panel.cobertura.flatMap((f) =>
    AMBITOS_MEN.map((a) => ({ grado: f.etiqueta, ambito: a.nombre, dominio: f.ambitos[a.id].dominio })).filter(
      (x) => x.dominio != null && x.dominio < 0.6
    )
  );
  const imp = panel.impacto?.total;
  const reparto = mundosPorPeriodo(ctx.periodos.length);

  const diagnostico = `<ul>
<li>Clases con Ceti: ${panel.resumen.clases}; estudiantes: ${panel.resumen.estudiantes}; activos en los últimos 30 días: ${pct(panel.resumen.adopcion)}.</li>
<li>Ámbitos de las orientaciones del MEN ya trabajados: ${panel.ambitosCubiertos.length} de ${AMBITOS_MEN.length}${debiles.length ? `. Sin trabajar: ${esc(debiles.join(', '))}` : ''}.</li>
${conDominio.length ? `<li>Grados y ámbitos con dominio por debajo del 60 %: ${esc(conDominio.slice(0, 8).map((x) => `${x.grado} en ${x.ambito} (${pct(x.dominio)})`).join('; '))}.</li>` : ''}
${imp && imp.pre != null ? `<li>Prueba de entrada y salida: ${pct(imp.pre)} → ${pct(imp.post)} con ${imp.pares} estudiantes.</li>` : '<li>Prueba de entrada: aún sin aplicar. Se recomienda aplicarla al iniciar el año.</li>'}
<li>Situaciones económicas, sociales o culturales del entorno que la comunidad educativa considera relevantes: ${POR_AJUSTAR}</li>
</ul>`;

  const ambitosPorGrupo = grupos
    .map((g) => {
      const filas = AMBITOS_MEN.map((a) => {
        const ds = desempenosDe(g, a.id);
        return `<tr><td><b>${esc(a.nombre)}</b><br><small>${esc(NOMBRE_EJE_MEN[a.eje])}</small></td><td>${esc(mundosDeAmbito(a.id).join(', ') || 'Mundo propio del profe')}</td><td><ul>${ds
          .map((d) => `<li>${esc(d.resumen)} <small>(${esc(d.id)}, ${esc(d.ref)})</small></li>`)
          .join('')}</ul></td><td>${esc(AREAS_POR_AMBITO[a.id].join(', '))}</td></tr>`;
      }).join('');
      return `<h3>Grados ${g}</h3><table><thead><tr><th>Ámbito</th><th>Mundos de Ceti</th><th>Desempeños esperados</th><th>Áreas que se articulan</th></tr></thead><tbody>${filas}</tbody></table>`;
    })
    .join('');

  const cronograma = ctx.periodos
    .map((p, i) => {
      const mundos = reparto[i].map((w) => {
        const d = WORLD_DEFS.find((x) => x.id === w);
        return `${d?.name ?? w} (${ALL_COMPETENCIAS.find((c) => c.id === WORLD_COMPETENCIAS[w as keyof typeof WORLD_COMPETENCIAS].id)?.label ?? ''})`;
      });
      const hitos = [
        i === 0 ? 'Prueba de entrada en la primera semana.' : '',
        i === ctx.periodos.length - 1 ? 'Prueba de salida en las dos últimas semanas.' : '',
        'Cierre del periodo en Ceti (copia fija del informe de cobertura).',
      ].filter(Boolean);
      return `<tr><td><b>${esc(p.nombre)}</b><br><small>${fechaCorta(p.desde)} a ${fechaCorta(p.hasta)}</small></td><td>${esc(mundos.join('; '))}</td><td>${esc(hitos.join(' '))}</td><td>${POR_AJUSTAR}</td></tr>`;
    })
    .join('');

  const normas = normasPara(ctx.tipoId)
    .map((n) => `<li><b>${esc(n.nombre)}.</b> ${esc(textoNorma(n))}</li>`)
    .join('');

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Proyecto pedagógico EEF · ${esc(ctx.entidad)}</title>
<style>body{font-family:Calibri,Segoe UI,-apple-system,sans-serif;color:#16161a;margin:32px;font-size:12px;line-height:1.45}h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 6px}h3{font-size:13px;margin:14px 0 4px}
table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #bbb;padding:5px;text-align:left;vertical-align:top}th{background:#f3f0ec;font-size:11px}small{color:#555}ul{margin:4px 0;padding-left:18px}
.aj{background:#fff2a8;font-weight:bold}.meta{color:#555}.nota{color:#555;font-size:11px}</style></head><body>
<h1>Proyecto pedagógico transversal de educación económica y financiera</h1>
<p class="meta">${esc(ctx.entidad)} · Año ${ctx.anio} · Borrador generado con Ceti el ${fechaCorta(new Date(ctx.generado).toISOString().slice(0, 10))}</p>
<p class="nota">Borrador para que la institución lo ajuste y lo apruebe según su PEI. Las orientaciones del MEN (2022) aclaran que la educación económica y financiera no es una asignatura nueva ni obliga a crear un proyecto transversal: cada institución decide si la trabaja como proyecto pedagógico (de aula o transversal), articulada entre áreas o en la Cátedra de la Paz. Lo marcado ${POR_AJUSTAR} lo completa la institución.</p>

<h2>1. Título</h2>
<p>${POR_AJUSTAR} (sugerido: "Mi plata, mis recursos, mi comunidad: educación económica y financiera en ${esc(ctx.entidad)}").</p>

<h2>2. Análisis del contexto</h2>
${diagnostico}

<h2>3. Problemática priorizada</h2>
<p>${POR_AJUSTAR} La comunidad educativa prioriza una o dos situaciones por su interés o su impacto.${debiles.length ? ` Según los datos de Ceti, conviene mirar los ámbitos aún sin trabajar (${esc(debiles.join(', '))}).` : ''}</p>

<h2>4. Justificación</h2>
<p>La educación económica y financiera ayuda a que los estudiantes tomen decisiones informadas sobre los recursos que valoran: el dinero, pero también el saber, el ambiente, el bienestar y sus relaciones. Este proyecto se articula con el PEI en ${POR_AJUSTAR} (misión, visión, perfil del egresado) y con el Plan de Mejoramiento Institucional en ${POR_AJUSTAR}.</p>
<p><b>Marco normativo</b></p><ul>${normas}</ul>

<h2>5. Objetivos</h2>
<p><b>General.</b> Desarrollar en los estudiantes de ${grupos.length ? `los grados ${grupos.map((g) => g.replace('-', '° a ') + '°').join(', ')}` : 'la institución'} las competencias para decidir, administrar, planear y gestionar el riesgo sobre sus recursos, según las orientaciones del MEN.</p>
<ul>
<li>Trabajar los ${AMBITOS_MEN.length} ámbitos conceptuales de los ejes Economía, Finanzas y Gestión del riesgo en cada grupo de grados.</li>
<li>Lograr que al menos el ${POR_AJUSTAR} % de los estudiantes de cada grado alcance los desempeños de su grupo.</li>
<li>Medir el avance con una prueba de entrada y una de salida en cada grado.</li>
<li>Vincular a las familias con el resumen semanal de actividad y con ${POR_AJUSTAR}.</li>
</ul>

<h2>6. Ámbitos, desempeños y áreas por grupo de grados</h2>
<p class="nota">Desempeños de las orientaciones del MEN (Tablas 6 a 14), en paráfrasis; el texto oficial está en la tabla y página citadas. Las áreas son una sugerencia de Ceti.</p>
${ambitosPorGrupo || '<p>Sin grados con clases todavía.</p>'}

<h2>7. Metodología</h2>
<ul>
<li>Cada clase juega en Ceti los mundos de su grado (lecciones, jefe y situaciones de "Elige camino") y el profe puede crear mundos propios con los ámbitos del MEN que trabaja.</li>
<li>Frecuencia sugerida: ${POR_AJUSTAR} sesiones por semana de ${POR_AJUSTAR} minutos, en ${POR_AJUSTAR}.</li>
<li>Equipo base: docentes de ${POR_AJUSTAR}; coordinación: ${POR_AJUSTAR}.</li>
<li>Pasos de la gestión del riesgo en el aula: valorar lo que importa, identificar amenazas, caracterizar el riesgo (probabilidad e impacto) y gestionarlo.</li>
</ul>

<h2>8. Cronograma por periodo</h2>
<table><thead><tr><th>Periodo</th><th>Mundos de Ceti</th><th>Hitos</th><th>Responsables</th></tr></thead><tbody>${cronograma}</tbody></table>

<h2>9. Seguimiento y evaluación</h2>
<ul>
<li>Informe de cobertura por periodo (ámbitos, competencias y desempeños por grado), con su cierre guardado en Ceti como evidencia fija.</li>
<li>Prueba de entrada y salida por grado: cambio en puntos y porcentaje de estudiantes que mejoran.</li>
<li>Notas en la escala del SIEE desde el dominio de cada mundo.</li>
<li>Revisión del avance y de las dificultades al final de cada periodo, con propuestas de mejora: ${POR_AJUSTAR}</li>
</ul>
<p class="nota">La relación entre los mundos de Ceti y los ámbitos y desempeños es una alineación hecha por Ceti; no es un concepto del Ministerio de Educación.</p>
</body></html>`;
}
