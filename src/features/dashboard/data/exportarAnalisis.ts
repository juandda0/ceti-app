/**
 * Exportar el análisis de la clase (Fase 3): un Excel con cuatro hojas
 * (Estudiantes, Preguntas, Actividad, Tareas) y un informe HTML que se imprime
 * como PDF. Puro.
 */
import { ETIQUETA_DESEMPENO, desempenoDeNota, type EscalaSiee } from '@/functions/src/educadores/dominio';
import type { Hoja } from '@shared/lib/export/xlsx';
import type { AnalisisClase } from '@features/dashboard/data/analisisClase';
import type { EstadoMundo, MundoDeLaClase } from '@features/dashboard/data/fichaEstudiante';

const ESTADO: Record<EstadoMundo, string> = {
  conquistado: 'Conquistado',
  en_curso: 'En curso',
  sin_empezar: 'Sin empezar',
};
const pct = (v: number | null) => (v == null ? null : Math.round(v * 100));
const fecha = (t: number | null) => (t == null ? '' : new Date(t).toLocaleDateString('es-CO'));
const nota = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export function hojasDelAnalisis(a: AnalisisClase, mundos: MundoDeLaClase[], escala?: EscalaSiee): Hoja[] {
  return [
    {
      nombre: 'Estudiantes',
      filas: [
        [
          'Estudiante',
          'Nota',
          'Desempeño',
          '% aciertos',
          'Respuestas',
          'Última actividad',
          ...mundos.flatMap((m) => [m.nombre, `${m.nombre} %`]),
        ],
        ...a.mapa.map((f) => [
          f.nombre,
          nota(f.nota),
          f.nota == null ? '' : ETIQUETA_DESEMPENO[desempenoDeNota(f.nota, escala)],
          pct(f.acierto),
          f.respuestas,
          fecha(f.ultimaActividad),
          ...mundos.flatMap((m) => [
            ESTADO[f.celdas[m.id]?.estado ?? 'sin_empezar'],
            pct(f.celdas[m.id]?.acierto ?? null),
          ]),
        ]),
      ],
    },
    {
      nombre: 'Preguntas',
      filas: [
        [
          'Mundo',
          'Pregunta',
          'Respuestas',
          'Estudiantes',
          '% aciertos',
          'Discriminación',
          'Respuesta errada más elegida',
          'Veces',
          'Difícil',
          'Revisar',
        ],
        ...a.preguntas.map((p) => [
          p.mundo,
          p.enunciado,
          p.respuestas,
          p.estudiantes,
          pct(p.facilidad),
          p.discriminacion == null ? null : Math.round(p.discriminacion * 100) / 100,
          p.erradaMasElegida?.texto ?? '',
          p.erradaMasElegida?.veces ?? null,
          p.dificil ? 'Sí' : '',
          p.revisar ? 'Sí' : '',
        ]),
      ],
    },
    {
      nombre: 'Actividad',
      filas: [
        ['Semana (desde el lunes)', 'Estudiantes activos', 'Respuestas', 'Minutos'],
        ...a.semanas.map((s) => [fecha(s.inicio), s.activos, s.respuestas, s.minutos]),
        [],
        ['Sin entrar hace 7 días', 'Última actividad'],
        ...a.sinEntrar7.map((s) => [s.nombre, fecha(s.ultimaActividad) || 'Nunca']),
      ],
    },
    {
      nombre: 'Tareas',
      filas: [
        ['Mundo', 'Fecha límite', 'A tiempo', 'Tarde', 'Sin hacer', 'Quiénes no la han hecho'],
        ...a.tareas.map((t) => [
          t.mundo,
          fecha(t.deadline),
          t.aTiempo.length,
          t.tarde.length,
          t.sinHacer.length,
          t.sinHacer.map((s) => s.nombre).join(', '),
        ]),
      ],
    },
  ];
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Informe imprimible (PDF) con lo esencial de cada vista. */
export function informeHtml(
  a: AnalisisClase,
  mundos: MundoDeLaClase[],
  { curso, periodo, generado }: { curso: string; periodo: string; generado: number }
): string {
  const celda = (v: string | number | null) => `<td>${v == null ? '—' : esc(String(v))}</td>`;
  const tabla = (cab: string[], filas: (string | number | null)[][]) =>
    `<table><thead><tr>${cab.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${filas
      .map((f) => `<tr>${f.map(celda).join('')}</tr>`)
      .join('')}</tbody></table>`;
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(curso)} · ${esc(periodo)}</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1E1A18;margin:24px;font-size:11px}
  h1{font-size:20px;margin:0 0 4px} h2{font-size:14px;margin:20px 0 6px;color:#C25E08}
  p.meta{color:#6B625C;margin:0 0 12px}
  table{border-collapse:collapse;width:100%;margin-bottom:8px}
  th,td{border:1px solid #E4DED8;padding:4px 6px;text-align:left;vertical-align:top}
  th{background:#F3F0EC;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
</style></head><body>
<h1>${esc(curso)}</h1>
<p class="meta">${esc(periodo)} · generado el ${esc(new Date(generado).toLocaleDateString('es-CO'))} con Ceti</p>
<h2>Estudiantes</h2>
${tabla(
  [
    'Estudiante',
    'Nota',
    '% aciertos',
    'Respuestas',
    'Última actividad',
    ...mundos.map((m) => m.nombre),
  ],
  a.mapa.map((f) => [
    f.nombre,
    f.nota == null ? null : String(nota(f.nota)).replace('.', ','),
    pct(f.acierto),
    f.respuestas,
    fecha(f.ultimaActividad) || 'Nunca',
    ...mundos.map((m) => {
      const c = f.celdas[m.id];
      return c ? `${ESTADO[c.estado]}${c.acierto == null ? '' : ` · ${pct(c.acierto)} %`}` : null;
    }),
  ])
)}
<h2>Preguntas más difíciles</h2>
${tabla(
  ['Mundo', 'Pregunta', '% aciertos', 'Respuesta errada más elegida', 'Revisar'],
  a.preguntas
    .slice(0, 15)
    .map((p) => [
      p.mundo,
      p.enunciado,
      pct(p.facilidad),
      p.erradaMasElegida ? `${p.erradaMasElegida.texto} (${p.erradaMasElegida.veces})` : null,
      p.revisar ? 'Sí' : '',
    ])
)}
<h2>Actividad por semana</h2>
${tabla(
  ['Semana', 'Activos', 'Respuestas', 'Minutos'],
  a.semanas.map((s) => [fecha(s.inicio), s.activos, s.respuestas, s.minutos])
)}
<h2>Tareas</h2>
${tabla(
  ['Mundo', 'Fecha límite', 'A tiempo', 'Tarde', 'Sin hacer'],
  a.tareas.map((t) => [
    t.mundo,
    fecha(t.deadline),
    t.aTiempo.length,
    t.tarde.length,
    t.sinHacer.map((s) => s.nombre).join(', ') || '0',
  ])
)}
</body></html>`;
}
