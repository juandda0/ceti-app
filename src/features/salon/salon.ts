// Lógica pura del Salón demo: ajustes en la URL, orígenes de cada dispositivo
// y cómo repartir los teléfonos en el espacio disponible. Sin React ni DOM,
// para poder probarla con jest.

export type Disposicion = 'lado' | 'arriba' | 'estudiantes';
export type PantallaProfe = 'tablero' | 'bitacora' | 'clases' | 'inicio';
export type EsquemaHosts = 'subdominios' | 'loopback';

export type AjustesSalon = {
  n: number;
  disposicion: Disposicion;
  profe: PantallaProfe;
  presentacion: boolean;
  hosts: EsquemaHosts;
  refresco: boolean;
};

export const N_MIN = 4;
export const N_MAX = 24;
export const CHIPS_CANTIDAD = [4, 8, 12, 16, 24] as const;
export const SEGUNDOS_REFRESCO = 20;

export const AJUSTES_POR_DEFECTO: AjustesSalon = {
  n: 8,
  disposicion: 'lado',
  profe: 'tablero',
  presentacion: false,
  hosts: 'subdominios',
  refresco: true,
};

export const DISPOSICIONES: readonly { id: Disposicion; etiqueta: string }[] = [
  { id: 'lado', etiqueta: 'Profe + salón' },
  { id: 'arriba', etiqueta: 'Profe arriba' },
  { id: 'estudiantes', etiqueta: 'Solo estudiantes' },
];

export const PANTALLAS_PROFE: readonly { id: PantallaProfe; etiqueta: string; ir: string }[] = [
  { id: 'tablero', etiqueta: 'Tablero 10°B', ir: '/curso/10b?nombre=10%C2%B0B' },
  { id: 'bitacora', etiqueta: 'Bitácora', ir: '/bitacora' },
  { id: 'clases', etiqueta: 'Clases', ir: '/clases' },
  { id: 'inicio', etiqueta: 'Inicio', ir: '/' },
];

// Tamaños lógicos: el iframe mide esto de verdad, así la app se maqueta como
// teléfono o tableta; el marco completo se escala con transform.
export const TELEFONO = { ancho: 390, alto: 844, bisel: 12 } as const;
export const TABLETA = { ancho: 1180, alto: 820, bisel: 18 } as const;

export function tamanoMarco(d: { ancho: number; alto: number; bisel: number }) {
  return { ancho: d.ancho + d.bisel * 2, alto: d.alto + d.bisel * 2 };
}

const esDisposicion = (v: unknown): v is Disposicion =>
  v === 'lado' || v === 'arriba' || v === 'estudiantes';
const esPantalla = (v: unknown): v is PantallaProfe =>
  v === 'tablero' || v === 'bitacora' || v === 'clases' || v === 'inicio';
const esHosts = (v: unknown): v is EsquemaHosts => v === 'subdominios' || v === 'loopback';

/** Lleva cualquier valor a una cantidad válida de estudiantes (4..24). */
export function limitarCantidad(valor: unknown): number {
  const num = typeof valor === 'number' ? valor : Number.parseInt(String(valor ?? ''), 10);
  if (!Number.isFinite(num)) return AJUSTES_POR_DEFECTO.n;
  return Math.min(N_MAX, Math.max(N_MIN, Math.round(num)));
}

function leerBooleano(valor: string | null, porDefecto: boolean): boolean {
  if (valor === null) return porDefecto;
  if (valor === '1' || valor === 'true' || valor === 'si') return true;
  if (valor === '0' || valor === 'false' || valor === 'no') return false;
  return porDefecto;
}

/** Lee los ajustes de `location.search` (con o sin `?`). */
export function leerAjustes(search: string): AjustesSalon {
  const q = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const d = AJUSTES_POR_DEFECTO;
  const disposicion = q.get('disposicion');
  const profe = q.get('profe');
  const hosts = q.get('hosts');
  return {
    n: q.has('n') ? limitarCantidad(q.get('n')) : d.n,
    disposicion: esDisposicion(disposicion) ? disposicion : d.disposicion,
    profe: esPantalla(profe) ? profe : d.profe,
    presentacion: leerBooleano(q.get('presentacion'), d.presentacion),
    hosts: esHosts(hosts) ? hosts : d.hosts,
    refresco: leerBooleano(q.get('refresco'), d.refresco),
  };
}

/** Serializa solo lo que difiere de los valores por defecto ('' si nada). */
export function escribirAjustes(a: AjustesSalon): string {
  const d = AJUSTES_POR_DEFECTO;
  const q = new URLSearchParams();
  const n = limitarCantidad(a.n);
  if (n !== d.n) q.set('n', String(n));
  if (a.disposicion !== d.disposicion) q.set('disposicion', a.disposicion);
  if (a.profe !== d.profe) q.set('profe', a.profe);
  if (a.presentacion !== d.presentacion) q.set('presentacion', a.presentacion ? '1' : '0');
  if (a.hosts !== d.hosts) q.set('hosts', a.hosts);
  if (a.refresco !== d.refresco) q.set('refresco', a.refresco ? '1' : '0');
  const texto = q.toString();
  return texto ? `?${texto}` : '';
}

export type UbicacionSalon = { protocolo: string; puerto: string };

export type Dispositivo = { tipo: 'profe' } | { tipo: 'estudiante'; n: number };

/** Host propio de cada dispositivo: cada origen tiene su sesión de Firebase. */
export function hostDispositivo(dispositivo: Dispositivo, hosts: EsquemaHosts): string {
  if (hosts === 'loopback') {
    return dispositivo.tipo === 'profe' ? '127.0.0.2' : `127.0.0.${10 + dispositivo.n}`;
  }
  return dispositivo.tipo === 'profe' ? 'profe.localhost' : `e${dispositivo.n}.localhost`;
}

export function origenDispositivo(
  dispositivo: Dispositivo,
  hosts: EsquemaHosts,
  ubicacion: UbicacionSalon
): string {
  const protocolo = ubicacion.protocolo.endsWith(':')
    ? ubicacion.protocolo
    : `${ubicacion.protocolo}:`;
  const puerto = ubicacion.puerto ? `:${ubicacion.puerto}` : '';
  return `${protocolo}//${hostDispositivo(dispositivo, hosts)}${puerto}`;
}

export function rutaPantallaProfe(pantalla: PantallaProfe): string {
  return (PANTALLAS_PROFE.find((p) => p.id === pantalla) ?? PANTALLAS_PROFE[0]).ir;
}

export function urlProfe(
  pantalla: PantallaProfe,
  hosts: EsquemaHosts,
  ubicacion: UbicacionSalon,
  cuenta = 'profe-piloto'
): string {
  const origen = origenDispositivo({ tipo: 'profe' }, hosts, ubicacion);
  const ir = encodeURIComponent(rutaPantallaProfe(pantalla));
  return `${origen}/dev/entrar?cuenta=${encodeURIComponent(cuenta)}&ir=${ir}`;
}

export function urlEstudiante(n: number, hosts: EsquemaHosts, ubicacion: UbicacionSalon): string {
  const origen = origenDispositivo({ tipo: 'estudiante', n }, hosts, ubicacion);
  return `${origen}/dev/entrar?cuenta=est-${n}`;
}

/** Escala para que un marco de tamaño lógico quepa en una caja. */
export function escalaParaCaja(
  caja: { ancho: number; alto: number },
  logico: { ancho: number; alto: number }
): number {
  if (caja.ancho <= 0 || caja.alto <= 0) return 0;
  return Math.min(caja.ancho / logico.ancho, caja.alto / logico.alto);
}

export type Reparto = { columnas: number; filas: number; escala: number };

/**
 * Elige las columnas que dan los teléfonos más grandes posibles dentro de la
 * caja. `etiqueta` es el alto (sin escalar) del nombre bajo cada teléfono.
 */
export function repartirTelefonos(
  n: number,
  caja: { ancho: number; alto: number },
  opciones: { separacion?: number; etiqueta?: number; marco?: { ancho: number; alto: number } } = {}
): Reparto {
  const separacion = opciones.separacion ?? 16;
  const etiqueta = opciones.etiqueta ?? 22;
  const marco = opciones.marco ?? tamanoMarco(TELEFONO);
  const total = Math.max(1, Math.floor(n));
  let mejor: Reparto = { columnas: 1, filas: total, escala: 0 };
  for (let columnas = 1; columnas <= total; columnas++) {
    const filas = Math.ceil(total / columnas);
    const anchoCelda = (caja.ancho - separacion * (columnas - 1)) / columnas;
    const altoCelda = (caja.alto - separacion * (filas - 1)) / filas - etiqueta;
    if (anchoCelda <= 0 || altoCelda <= 0) continue;
    const escala = Math.min(anchoCelda / marco.ancho, altoCelda / marco.alto);
    // Ante empate, menos columnas (filas más llenas).
    if (escala > mejor.escala + 1e-9) mejor = { columnas, filas, escala };
  }
  return mejor;
}
