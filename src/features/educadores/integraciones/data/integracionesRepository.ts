/**
 * Fase 9 — conexiones de la entidad: dominios de correo de la institución
 * (entrar con Google o Microsoft) y plataformas LTI 1.3 (Moodle, Canvas).
 */
import { callFunction } from '@shared/lib/firebase/functions';
import type {
  RegistroPlataformaLti,
  SalidaGestionarPlataformaLti,
} from '@/functions/src/integraciones/dominio/lti';

export const integracionesRepository = {
  dominios: () => callFunction<{ ok: true; dominios: string[] }>('gestionarDominiosEntidad', { accion: 'listar' }),
  agregarDominio: (dominio: string) =>
    callFunction<{ ok: true; dominios: string[] }>('gestionarDominiosEntidad', { accion: 'agregar', dominio }),
  quitarDominio: (dominio: string) =>
    callFunction<{ ok: true; dominios: string[] }>('gestionarDominiosEntidad', { accion: 'quitar', dominio }),
  plataformas: () => callFunction<SalidaGestionarPlataformaLti>('gestionarPlataformaLti', { accion: 'listar' }),
  registrarPlataforma: (r: RegistroPlataformaLti) =>
    callFunction<SalidaGestionarPlataformaLti>('gestionarPlataformaLti', { accion: 'registrar', ...r }),
  quitarPlataforma: (plataformaId: string) =>
    callFunction<SalidaGestionarPlataformaLti>('gestionarPlataformaLti', { accion: 'quitar', plataformaId }),
};
