/**
 * Fase 5 — resumen semanal para acudientes. El gancho del tutor: el papá ve el
 * avance sin tener cuenta. Sin notas ni aciertos: solo avance (lecciones y
 * mundos) y constancia (días que entró y minutos). El profe lo activa por clase
 * (plan Comandante o Nave) y solo sale para estudiantes con la autorización de
 * datos ya confirmada (Ley 1581).
 *
 * Llega por un enlace privado (sin cuenta) que el profe comparte, y si el profe
 * guarda el correo del acudiente con su autorización, también por correo cada
 * domingo. Puro.
 */
import { fechaBogota } from './calendario';
import type { Funcion } from './planes';

export const FUNCION_ACUDIENTES: Funcion = 'resumenAcudientes';
/** Versión del texto de autorización que confirma el profe al guardar un correo. */
export const POLITICA_CORREO_ACUDIENTE = 'acudiente-correo-2026-10';
export const SEMANAS_CONSTANCIA = 4;
export const CORREO_MAX = 120;

const DIA_MS = 24 * 60 * 60 * 1000;

export type EstadoMundoAcudiente = 'conquistado' | 'en_curso' | 'sin_empezar';

export interface IntentoAcudiente {
  finAt: number;
  duracionMs: number;
  tipo: 'leccion' | 'jefe';
  resultado: 'completado' | 'perdido';
}

export interface ResumenAcudiente {
  nombre: string;
  clase: string;
  profe: string | null;
  /** Últimos 7 días, contando hoy. */
  semana: {
    desde: string;
    hasta: string;
    diasActivos: number;
    minutos: number;
    lecciones: number;
    jefesGanados: number;
  };
  /** Días activos por semana, de la más vieja a la actual. */
  constancia: { desde: string; dias: number }[];
  mundos: { nombre: string; estado: EstadoMundoAcudiente }[];
  conquistados: number;
}

/** Solo el primer nombre: el resumen viaja por WhatsApp o correo. */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || 'Tu estudiante';
}

export function correoValido(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length <= CORREO_MAX &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())
  );
}

export function construirResumenAcudiente(input: {
  nombre: string;
  clase: string;
  profe: string | null;
  intentos: readonly IntentoAcudiente[];
  /** Días (YYYY-MM-DD, Bogotá) en que abrió la clase o avanzó un mundo. */
  diasConVisita: readonly string[];
  mundos: readonly { nombre: string; empezado: boolean; conquistado: boolean }[];
  ahora: number;
}): ResumenAcudiente {
  const { ahora } = input;
  const diasActivos = new Set<string>([
    ...input.diasConVisita,
    ...input.intentos.map((i) => fechaBogota(i.finAt)),
  ]);
  const inicioSemana = (semanasAtras: number) => ahora - (semanasAtras * 7 + 6) * DIA_MS;
  const diasEntre = (desde: number, hasta: number) => {
    const d = new Set<string>();
    for (let t = desde; t <= hasta; t += DIA_MS) d.add(fechaBogota(t));
    return d;
  };

  const estaSemana = diasEntre(inicioSemana(0), ahora);
  const intentosSemana = input.intentos.filter(
    (i) => i.finAt >= inicioSemana(0) && i.finAt <= ahora
  );

  const constancia = Array.from({ length: SEMANAS_CONSTANCIA }, (_, k) => {
    const atras = SEMANAS_CONSTANCIA - 1 - k;
    const desde = inicioSemana(atras);
    const dias = diasEntre(desde, desde + 6 * DIA_MS);
    return {
      desde: fechaBogota(desde),
      dias: [...dias].filter((d) => diasActivos.has(d)).length,
    };
  });

  const mundos = input.mundos.map((m) => ({
    nombre: m.nombre,
    estado: (m.conquistado ? 'conquistado' : m.empezado ? 'en_curso' : 'sin_empezar') as EstadoMundoAcudiente,
  }));

  return {
    nombre: primerNombre(input.nombre),
    clase: input.clase.trim() || 'su clase',
    profe: input.profe?.trim() || null,
    semana: {
      desde: fechaBogota(inicioSemana(0)),
      hasta: fechaBogota(ahora),
      diasActivos: [...estaSemana].filter((d) => diasActivos.has(d)).length,
      minutos: Math.round(intentosSemana.reduce((a, i) => a + i.duracionMs, 0) / 60000),
      lecciones: intentosSemana.filter((i) => i.tipo === 'leccion' && i.resultado === 'completado')
        .length,
      jefesGanados: intentosSemana.filter((i) => i.tipo === 'jefe' && i.resultado === 'completado')
        .length,
    },
    constancia,
    mundos,
    conquistados: mundos.filter((m) => m.estado === 'conquistado').length,
  };
}
