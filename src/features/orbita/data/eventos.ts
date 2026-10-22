/**
 * Eventos de analítica de aprendizaje y gamificación. Nombres en español y sin
 * datos personales: solo ids de mundo, números de juego y resultados.
 */
import { logEvent } from '@shared/lib/analytics/logEvent';

type Params = Record<string, string | number | boolean>;

export const eventos = {
  leccionInicio: (p: { mundo: string; tipo: string; nivel: number }) =>
    void logEvent('leccion_inicio', p),
  respuesta: (p: { mundo: string; tipo: string; correcta: boolean; combo: number }) =>
    void logEvent('respuesta', p),
  leccionFin: (p: { mundo: string; tipo: string; nivel: number; perfecta: boolean; xp: number; errores: number }) =>
    void logEvent('leccion_fin', p),
  jefePerdido: (p: { mundo: string }) => void logEvent('jefe_perdido', p),
  rachaExtendida: (p: { racha: number; reparada: boolean }) => void logEvent('racha_extendida', p),
  rachaPerdida: (p: { racha: number; reparable: boolean }) => void logEvent('racha_perdida', p),
  escudoUsado: (p: { cantidad: number }) => void logEvent('escudo_usado', p),
  escudoComprado: (p: { precio: number }) => void logEvent('escudo_comprado', p),
  metaCumplida: (p: { meta: string; lecciones: number }) => void logEvent('meta_cumplida', p),
  hitoRacha: (p: { hito: number }) => void logEvent('hito_racha', p),
  cetisGanados: (p: { cantidad: number; origen: string }) => void logEvent('cetis_ganados', p),
  cetisGastados: (p: { cantidad: number; destino: string }) => void logEvent('cetis_gastados', p),
  boveda: (p: { accion: 'deposito' | 'retiro' | 'cdt_abierto' | 'cdt_roto'; monto: number }) =>
    void logEvent('boveda_movimiento', p),
  interesPagado: (p: { monto: number }) => void logEvent('boveda_interes', p),
  avisosConfigurados: (p: { activos: boolean; hora: number }) => void logEvent('avisos_configurados', p),
  avisoAbierto: (p: Params) => void logEvent('notif_abierta', p),
  metaElegida: (p: { meta: string }) => void logEvent('meta_elegida', p),
};
