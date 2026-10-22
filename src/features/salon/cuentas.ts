/**
 * Cuentas del Salón demo (scripts/salon/cuentas.json). Solo existen en los
 * emuladores locales; la contraseña no sirve en producción. Las comparten la
 * siembra, /dev/entrar y la vista del salón.
 */
import datos from '../../../scripts/salon/cuentas.json';

export type RolSalon = 'admin' | 'profesor' | 'estudiante';

export interface CuentaSalon {
  id: string;
  rol: RolSalon;
  nombre: string;
  email: string;
  colegio?: string;
  curso?: string;
  alias?: string;
  descripcion?: string;
  /** Ruta de la app a la que conviene llegar (p. ej. el tablero del profe). */
  ir?: string;
}

export const CUENTAS_SALON = datos as {
  proyecto: string;
  password: string;
  cuentas: CuentaSalon[];
};

export const MAX_ESTUDIANTES_SALON = 24;

export function buscarCuenta(idOAlias: string): CuentaSalon | undefined {
  const clave = idOAlias.trim().toLowerCase();
  return CUENTAS_SALON.cuentas.find((c) => c.id === clave || c.alias === clave);
}

/** Estudiantes de 10°B en orden (est-1 … est-24): los teléfonos del salón. */
export function estudiantesSalon(): CuentaSalon[] {
  return Array.from({ length: MAX_ESTUDIANTES_SALON }, (_, i) =>
    buscarCuenta(`est-${i + 1}`)
  ).filter((c): c is CuentaSalon => !!c);
}

/** Solo rutas internas: `ir` viene de la URL y no debe sacar de la app. */
export function destinoTrasEntrar(ir?: string | null): string {
  const r = (ir ?? '').trim();
  if (!r.startsWith('/') || r.startsWith('//')) return '/';
  return r;
}

export const GRUPOS_CUENTAS: { titulo: string; cuentas: CuentaSalon[] }[] = [
  {
    titulo: 'PROFES Y ADMIN',
    cuentas: CUENTAS_SALON.cuentas.filter((c) => c.rol !== 'estudiante'),
  },
  {
    titulo: 'ESTUDIANTE DESTACADA Y JOVEN B2C',
    cuentas: CUENTAS_SALON.cuentas.filter((c) => c.alias === 'estudiante' || c.id === 'joven'),
  },
  {
    titulo: 'COLEGIO SAN MATEO · 10°B',
    cuentas: CUENTAS_SALON.cuentas.filter((c) => c.curso === '10b' && !c.alias),
  },
  {
    titulo: 'COLEGIO SAN MATEO · 9°A',
    cuentas: CUENTAS_SALON.cuentas.filter((c) => c.curso === '9a'),
  },
  {
    titulo: 'OTROS COLEGIOS',
    cuentas: CUENTAS_SALON.cuentas.filter((c) => c.curso === '8a' || c.curso === '7c'),
  },
];
