/**
 * Tipos para los bancos de contenido EligeCamino y Micro-teoría.
 *
 * Los campos van en español para reflejar el shape del documento JSON
 * generado por el pipeline de authoring-time (R7, R8).
 *
 * Contratos de colecciones (read-only; servidos por el backend desde content/):
 *  - bancosEligeCamino/{grado}_{worldId}
 *  - microteoria/{grado}_{worldId}
 *
 * R5: la elección en EligeCamino NO se persiste por estudiante.
 * R7: sin adaptación ML en runtime; selección determinista por seedKey.
 */

import type { Grado, WorldId } from './quiz.types';

// ─── EligeCamino ─────────────────────────────────────────────────────────────

export interface Opcion {
  texto: string;
  consecuencia: string;
}

export interface Situacion {
  id: string;
  enunciado: string;
  opcionA: Opcion;
  opcionB: Opcion;
}

export interface EligeCaminoBank {
  bancoId: string;
  grado: Grado;
  worldId: WorldId;
  situaciones: Situacion[];
  pendiente_validacion_docente: boolean;
}

// ─── Micro-teoría ─────────────────────────────────────────────────────────────

export interface MicroteoriaCard {
  titulo: string;
  cuerpo: string;
  ejemplo?: string;
}

export interface MicroteoriaBank {
  grado: Grado;
  worldId: WorldId;
  cards: MicroteoriaCard[];
  generadoPor: string;
  pendiente_validacion_docente: boolean;
}
