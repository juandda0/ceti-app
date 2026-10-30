/**
 * Fase 6 — lo que la app lee y pide de la entidad. Todo lo que cambia algo pasa
 * por un callable (functions/src/educadores/entidades.ts, entidadPanel.ts,
 * bibliotecaEntidad.ts y facturacionEntidad.ts); aquí solo se leen los docs que
 * las reglas dejan ver: miembros, escala, biblioteca y, para un admin,
 * invitaciones, datos de factura y cotizaciones.
 */
import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { getFirebaseClients } from '@shared/lib/firebase/app';
import { callFunction } from '@shared/lib/firebase/functions';
import type {
  CicloEntidad,
  ConfigEvaluacion,
  Cotizacion,
  DatosEntidad,
  DatosFacturacion,
  InvitacionProfe,
  LicenciaEntidad,
  PanelEntidad,
  PlanEntidad,
  ProfeEntidad,
  PublicacionBiblioteca,
  RolEntidad,
  TipoEntidad,
} from '@/functions/src/educadores/dominio';

export interface EntidadVista {
  colegioId: string;
  nombre: string;
  entidad: DatosEntidad | null;
  licencia: LicenciaEntidad | null;
  profes: ProfeEntidad[];
}

export interface InvitacionParaMi {
  colegioId: string;
  entidad: string;
  tipo: TipoEntidad | null;
  invitadoPorNombre: string | null;
  rol: RolEntidad;
  creadaAt: number;
  clases: number;
}

export type MundoBiblioteca = Omit<PublicacionBiblioteca, 'piezas'> & { id: string };

function db() {
  const c = getFirebaseClients();
  if (!c?.firestore) throw new Error('Firebase no configurado');
  return c.firestore;
}

export const entidadRepository = {
  async leer(colegioId: string): Promise<EntidadVista> {
    const fs = db();
    const [colegio, profes] = await Promise.all([
      getDoc(doc(fs, 'colegios', colegioId)),
      getDocs(collection(fs, 'colegios', colegioId, 'profes')).catch(() => null),
    ]);
    const data = colegio.exists() ? colegio.data() : {};
    return {
      colegioId,
      nombre: typeof data.nombre === 'string' ? data.nombre : '',
      entidad: (data.entidad as DatosEntidad | undefined) ?? null,
      licencia: (data.licencia as LicenciaEntidad | undefined) ?? null,
      profes: (profes?.docs ?? [])
        .map((d) => ({ ...(d.data() as ProfeEntidad), uid: d.id }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    };
  },

  async invitaciones(colegioId: string): Promise<InvitacionProfe[]> {
    const snap = await getDocs(collection(db(), 'colegios', colegioId, 'invitacionesProfe'));
    return snap.docs.map((d) => d.data() as InvitacionProfe).sort((a, b) => b.creadaAt - a.creadaAt);
  },

  async evaluacion(colegioId: string): Promise<ConfigEvaluacion | null> {
    const snap = await getDoc(doc(db(), 'colegios', colegioId, 'config', 'evaluacion'));
    return snap.exists() ? (snap.data() as ConfigEvaluacion) : null;
  },

  async biblioteca(colegioId: string): Promise<MundoBiblioteca[]> {
    const snap = await getDocs(query(collection(db(), 'colegios', colegioId, 'biblioteca'), orderBy('publicadoAt', 'desc')));
    return snap.docs.map((d) => {
      const { piezas: _piezas, ...resto } = d.data() as PublicacionBiblioteca;
      return { ...resto, id: d.id };
    });
  },

  async datosFacturacion(colegioId: string): Promise<DatosFacturacion | null> {
    const snap = await getDoc(doc(db(), 'colegios', colegioId, 'facturacion', 'datos'));
    return snap.exists() ? (snap.data() as DatosFacturacion) : null;
  },

  async cotizaciones(colegioId: string): Promise<Cotizacion[]> {
    const snap = await getDocs(query(collection(db(), 'colegios', colegioId, 'cotizaciones'), orderBy('creadaAt', 'desc')));
    return snap.docs.map((d) => d.data() as Cotizacion);
  },

  crear: (nombre: string, tipo: TipoEntidad) => callFunction<{ ok: true }>('crearEntidad', { nombre, tipo }),
  invitar: (correo: string, rol: RolEntidad) => callFunction<{ ok: true }>('invitarProfeEntidad', { correo, rol }),
  cancelarInvitacion: (correo: string) => callFunction<{ ok: true }>('cancelarInvitacionProfe', { correo }),
  misInvitaciones: () => callFunction<{ invitaciones: InvitacionParaMi[] }>('misInvitacionesEntidad'),
  responder: (colegioId: string, aceptar: boolean) =>
    callFunction<{ ok: true; aceptada: boolean; clases?: number; estudiantes?: number }>('responderInvitacionEntidad', {
      colegioId,
      aceptar,
    }),
  sacar: (uid: string | null, pasarA: string | null) =>
    callFunction<{ ok: true; clases: number; sinProfe: number }>('sacarProfeEntidad', { uid, pasarA }),
  cambiarRol: (uid: string, rol: RolEntidad) => callFunction<{ ok: true }>('cambiarRolProfeEntidad', { uid, rol }),
  coDocente: (cursoId: string, uid: string, accion: 'agregar' | 'quitar' | 'permiso', permiso?: 'edita' | 'califica') =>
    callFunction<{ ok: true; profesorUids: string[]; soloCalificar: string[] }>('gestionarCoDocente', {
      cursoId,
      uid,
      accion,
      ...(permiso ? { permiso } : {}),
    }),
  panel: (forzar = false, rango?: { desde: number; hasta: number }) =>
    callFunction<PanelEntidad>('verPanelEntidad', { forzar, ...(rango ?? {}) }),
  guardarEvaluacion: (config: ConfigEvaluacion) =>
    callFunction<{ ok: true; config: ConfigEvaluacion }>('guardarEvaluacionEntidad', { config }),
  publicar: (cursoId: string, worldId: string) => callFunction<{ ok: true; id: string }>('publicarEnBiblioteca', { cursoId, worldId }),
  usar: (id: string, cursoId: string) => callFunction<{ ok: true; worldId: string }>('usarDeBiblioteca', { id, cursoId }),
  retirar: (id: string) => callFunction<{ ok: true }>('retirarDeBiblioteca', { id }),
  guardarFacturacion: (datos: Partial<DatosFacturacion>) =>
    callFunction<{ ok: true; datos: DatosFacturacion }>('guardarDatosFacturacion', { datos }),
  cotizar: (plan: PlanEntidad, ciclo: CicloEntidad, cantidad: number) =>
    callFunction<Cotizacion>('cotizarPlanEntidad', { plan, ciclo, cantidad }),
  registrarOrden: (cotizacionId: string, orden: string) =>
    callFunction<{ ok: true; cotizacion: Cotizacion }>('registrarOrdenCompra', { cotizacionId, orden }),
};
