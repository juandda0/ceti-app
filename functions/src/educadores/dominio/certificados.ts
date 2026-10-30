/**
 * Fase 8 — certificados de participación e insignias del profe.
 *
 * Certificado (plan Piloto o más, `certificados`): da constancia de que un
 * estudiante conquistó en su clase los mundos que eligió el profe. Lleva un
 * código público (`CETI-XXXX-XXXX`) que cualquiera revisa en
 * `/certificado/{código}` sin cuenta. Cita las normas vigentes con
 * `normasPara(tipo)` (sin el Decreto 457, que es solo antecedente) y dice que
 * Ceti no es una entidad certificadora: nunca promete obligatoriedad.
 *
 * - `certificados/{código}`: la verificación pública (solo el servidor).
 * - `cursos/{k}/estudiantes/{uid}/certificados/{código}`: la copia que ven el
 *   estudiante y los profes de la clase.
 *
 * Insignias: 8 fijas que el profe da con un motivo corto opcional, en
 * `estudiantes/{uid}/insignias/{id}`. Todos los planes. Puro: sin Firebase.
 */
import { normasPara, type Norma } from './normativa';

export const ALFABETO_CODIGO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX_CERTIFICADOS_POR_VEZ = 60;
export const MAX_MUNDOS_CERTIFICADO = 12;

/** `CETI-XXXX-XXXX` a partir de 8 bytes al azar (sin 0/O ni 1/I/L). */
export function codigoCertificado(bytes: ArrayLike<number>): string {
  const c = Array.from({ length: 8 }, (_, i) => ALFABETO_CODIGO[(bytes[i] ?? 0) % ALFABETO_CODIGO.length]).join('');
  return `CETI-${c.slice(0, 4)}-${c.slice(4)}`;
}

export function esCodigoCertificado(v: unknown): v is string {
  return typeof v === 'string' && /^CETI-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(v);
}

/** Lo que se muestra al verificar un código, sin datos de contacto. */
export interface CertificadoPublico {
  codigo: string;
  nombre: string;
  clase: string;
  institucion: string;
  tipoEntidad: string | null;
  mundos: string[];
  desempenos: number;
  desde: number;
  hasta: number;
  profe: string;
  emitidoAt: number;
  revocadoAt: number | null;
}

/** Lo que se guarda (la verificación pública más a quién y de dónde es). */
export interface CertificadoGuardado extends CertificadoPublico {
  colegioId: string;
  cursoId: string;
  uid: string;
  emitidoPor: string;
}

export function publicoDe(c: CertificadoGuardado): CertificadoPublico {
  return {
    codigo: c.codigo,
    nombre: c.nombre,
    clase: c.clase,
    institucion: c.institucion,
    tipoEntidad: c.tipoEntidad,
    mundos: [...c.mundos],
    desempenos: c.desempenos,
    desde: c.desde,
    hasta: c.hasta,
    profe: c.profe,
    emitidoAt: c.emitidoAt,
    revocadoAt: c.revocadoAt,
  };
}

/** ¿Conquistó todos los mundos pedidos? Devuelve los que le faltan. */
export function faltantes(conquistados: ReadonlySet<string> | readonly string[], requeridos: readonly string[]): string[] {
  const set = conquistados instanceof Set ? conquistados : new Set(conquistados);
  return requeridos.filter((w) => !set.has(w));
}

/** Desempeños del MEN trabajados: con al menos una respuesta registrada. */
export function desempenosTrabajados(porDesempeno: Record<string, { respuestas?: number }> | null | undefined): number {
  return Object.values(porDesempeno ?? {}).filter((v) => (v?.respuestas ?? 0) > 0).length;
}

/** Las normas que cita el certificado: las vigentes para ese tipo de entidad. */
export function normasDelCertificado(tipoEntidad: string | null | undefined): readonly Norma[] {
  return normasPara(tipoEntidad).filter((n) => n.vigencia === null);
}

export function textoNormas(tipoEntidad: string | null | undefined): string {
  return normasDelCertificado(tipoEntidad)
    .map((n) => n.nombre)
    .join('; ');
}

// ─── Insignias ───────────────────────────────────────────────────────────────

export const INSIGNIAS = [
  'ahorro_estrella',
  'constancia',
  'gran_pregunta',
  'ayudo_companero',
  'gran_avance',
  'pensamiento_critico',
  'lider_grupo',
  'clase_en_vivo',
] as const;
export type InsigniaId = (typeof INSIGNIAS)[number];

/** Icono (Ionicons) y color de cada insignia; el nombre va en es.json. */
export const ESTILO_INSIGNIA: Record<InsigniaId, { icono: string; color: string }> = {
  ahorro_estrella: { icono: 'star', color: '#2F9E5B' },
  constancia: { icono: 'calendar', color: '#2F7BE5' },
  gran_pregunta: { icono: 'help-circle', color: '#D9901A' },
  ayudo_companero: { icono: 'heart', color: '#E5484D' },
  gran_avance: { icono: 'trending-up', color: '#FF8A1F' },
  pensamiento_critico: { icono: 'bulb', color: '#8E5BD8' },
  lider_grupo: { icono: 'flag', color: '#1FA3A3' },
  clase_en_vivo: { icono: 'flash', color: '#C2410C' },
};

export const MAX_MOTIVO_INSIGNIA = 120;

export function esInsignia(v: unknown): v is InsigniaId {
  return typeof v === 'string' && (INSIGNIAS as readonly string[]).includes(v);
}

export interface InsigniaDada {
  insignia: InsigniaId;
  motivo: string | null;
  dadaPor: string;
  dadaPorNombre: string;
  dadaAt: number;
}

export function armarInsignia(insignia: InsigniaId, motivo: string, profe: { uid: string; nombre: string }, ahora: number): InsigniaDada {
  const m = motivo.trim().replace(/\s+/g, ' ').slice(0, MAX_MOTIVO_INSIGNIA);
  return { insignia, motivo: m || null, dadaPor: profe.uid, dadaPorNombre: profe.nombre.slice(0, 80), dadaAt: ahora };
}
