/**
 * Lógica pura de la siembra de contenido (sembrarContenido.cjs): mapeo
 * archivo → documento, validación, diff idempotente y reglas de seguridad.
 * El .cjs se carga con el require de Node (Jest no resuelve .cjs aquí).
 */
import { createRequire } from 'node:module';
import { join } from 'node:path';
import {
  TIPOS_CONTENIDO,
  archivosEsperados,
  validarArchivo,
} from '@features/learning/data/validarContenido';

interface Doc {
  coleccion: string;
  id: string;
  ruta: string;
  carpeta: 'bancos' | 'microteoria';
  nombre: string;
  datos: Record<string, unknown>;
}
interface PlanColeccion {
  crear: Doc[];
  actualizar: (Doc & { campos: string[] })[];
  igual: Doc[];
  extras: string[];
}
type Plan = Record<string, PlanColeccion>;
interface Opciones {
  proyecto: string | null;
  escribir: boolean;
  dryRun: boolean;
  confirmoProduccion: boolean;
  solo: string;
  sinConexion: boolean;
}
interface Siembra {
  TIPOS_BANCO: string[];
  destinoDeArchivo(carpeta: string, nombre: string): { coleccion: string; id: string } | null;
  leerContenido(raiz: string): { docs: Doc[]; invalidos: string[] };
  validarDocumentos(docs: Doc[], v: typeof validarArchivo): string[];
  faltantes(docs: Doc[], esperados: ReturnType<typeof archivosEsperados>): string[];
  filtrarSolo(docs: Doc[], prefijo: string): Doc[];
  normalizar(v: unknown): unknown;
  hashContenido(v: unknown): string;
  planear(docs: Doc[], existentes: Map<string, unknown> | null): Plan;
  aEscribir(plan: Plan): Doc[];
  lotes<T>(lista: T[], tamano?: number): T[][];
  parsearArgs(argv: string[]): { opciones: Opciones; errores: string[] };
  revisarSeguridad(
    o: Partial<Opciones>,
    env: Record<string, string | undefined>,
    raiz?: string
  ): { errores: string[]; avisos: string[]; modo: string | null };
}

const RAIZ = join(__dirname, '../..');
const s = createRequire(__filename)('./sembrarContenido.cjs') as Siembra;
const { docs } = s.leerContenido(RAIZ);

describe('sembrarContenido: contenido → documentos', () => {
  it('mapea cada archivo a su colección como los repositorios del cliente', () => {
    expect(s.TIPOS_BANCO).toEqual([...TIPOS_CONTENIDO]);
    expect(s.destinoDeArchivo('bancos', '1_world_6_ordenar.json')).toEqual({
      coleccion: 'bancos',
      id: '1_world_6_ordenar',
    });
    expect(s.destinoDeArchivo('bancos', '1_world_6.json')).toEqual({
      coleccion: 'bancosEligeCamino',
      id: '1_world_6',
    });
    expect(s.destinoDeArchivo('microteoria', '8_world_2.json')).toEqual({
      coleccion: 'microteoria',
      id: '8_world_2',
    });
    expect(s.destinoDeArchivo('bancos', 'LEEME.md')).toBeNull();
  });

  it('lee todo content/, válido y completo', () => {
    const esperados = archivosEsperados();
    expect(docs).toHaveLength(esperados.bancos.length + esperados.microteoria.length);
    expect(s.validarDocumentos(docs, validarArchivo)).toEqual([]);
    expect(s.faltantes(docs, esperados)).toEqual([]);
    // El documento es el archivo tal cual (sin campos añadidos).
    const d = docs.find((x) => x.ruta === 'bancos/1_world_6_multiple_choice');
    expect(d?.datos.bancoId).toBe('1_world_6_multiple_choice');
  });

  it('detecta un archivo que no pasa la validación', () => {
    const malo = { ...docs.find((x) => x.coleccion === 'bancos')! };
    malo.datos = { ...malo.datos, items: [] };
    expect(s.validarDocumentos([malo], validarArchivo).length).toBeGreaterThan(0);
  });

  it('--solo filtra por prefijo del id', () => {
    const solo = s.filtrarSolo(docs, '1_world_6');
    expect(solo.map((d) => d.ruta).sort()).toEqual([
      'bancos/1_world_6_multiple_choice',
      'bancos/1_world_6_ordenar',
      'bancos/1_world_6_true_false',
      'bancosEligeCamino/1_world_6',
      'microteoria/1_world_6',
    ]);
  });
});

describe('sembrarContenido: diff idempotente', () => {
  it('el hash no depende del orden de las claves', () => {
    expect(s.hashContenido({ a: 1, b: { c: [1, { d: 2, e: 3 }] } })).toBe(
      s.hashContenido({ b: { c: [1, { e: 3, d: 2 }] }, a: 1 })
    );
    expect(s.hashContenido({ a: [1, 2] })).not.toBe(s.hashContenido({ a: [2, 1] }));
  });

  it('sin lectura todo es crear; con todo igual no escribe nada', () => {
    const sinLeer = s.planear(docs, null);
    expect(s.aEscribir(sinLeer)).toHaveLength(docs.length);
    const iguales = new Map(docs.map((d) => [d.ruta, JSON.parse(JSON.stringify(d.datos))]));
    expect(s.aEscribir(s.planear(docs, iguales))).toEqual([]);
  });

  it('marca actualizar con los campos distintos y lista extras sin tocarlos', () => {
    const muestra = s.filtrarSolo(docs, '9_world_1');
    const existentes = new Map<string, unknown>(muestra.map((d) => [d.ruta, { ...d.datos }]));
    const ruta = 'bancos/9_world_1_true_false';
    existentes.set(ruta, { ...(existentes.get(ruta) as object), campoViejo: 'x' });
    existentes.delete('microteoria/9_world_1');
    existentes.set('bancos/9_world_1_viejo', { a: 1 });
    const plan = s.planear(muestra, existentes);
    expect(plan.bancos.actualizar.map((d) => [d.ruta, d.campos])).toEqual([[ruta, ['campoViejo']]]);
    expect(plan.microteoria.crear.map((d) => d.ruta)).toEqual(['microteoria/9_world_1']);
    expect(plan.bancos.extras).toEqual(['bancos/9_world_1_viejo']);
    expect(
      s
        .aEscribir(plan)
        .map((d) => d.ruta)
        .sort()
    ).toEqual([ruta, 'microteoria/9_world_1']);
  });

  it('parte en lotes de a lo sumo 400', () => {
    expect(s.lotes(Array.from({ length: 810 }, (_, i) => i)).map((l) => l.length)).toEqual([
      400, 400, 10,
    ]);
  });
});

describe('sembrarContenido: seguridad', () => {
  const args = (a: string) => s.parsearArgs(a.split(' ').filter(Boolean));

  it('es dry-run por defecto y exige --proyecto', () => {
    expect(args('--proyecto demo-x').opciones.escribir).toBe(false);
    expect(s.revisarSeguridad(args('').opciones, {}).errores[0]).toMatch(/--proyecto/);
    expect(args('--escribir --dry-run').errores.length).toBe(1);
    expect(args('--borrar').errores[0]).toMatch(/desconocida/);
  });

  it('demo-* solo con emulador; sin él, dry-run planea sin conexión', () => {
    const dry = s.revisarSeguridad(args('--proyecto demo-ceti-siembra').opciones, {});
    expect(dry).toMatchObject({ errores: [], modo: 'sin-conexion' });
    expect(dry.avisos[0]).toMatch(/crear/);
    expect(
      s.revisarSeguridad(args('--proyecto demo-ceti-siembra --escribir').opciones, {}).errores
    ).toHaveLength(1);
    const emu = { FIRESTORE_EMULATOR_HOST: '127.0.0.1:8099' };
    expect(
      s.revisarSeguridad(args('--proyecto demo-ceti-siembra --escribir').opciones, emu)
    ).toMatchObject({
      errores: [],
      modo: 'emulador',
    });
  });

  it('un proyecto real pide --confirmo-produccion para escribir y no acepta claves en el repo', () => {
    expect(s.revisarSeguridad(args('--proyecto ceti-real').opciones, {})).toMatchObject({
      errores: [],
      modo: 'adc',
    });
    expect(
      s.revisarSeguridad(args('--proyecto ceti-real --escribir').opciones, {}).errores[0]
    ).toMatch(/--confirmo-produccion/);
    const ok = args('--proyecto ceti-real --escribir --confirmo-produccion').opciones;
    expect(s.revisarSeguridad(ok, {}, RAIZ).errores).toEqual([]);
    expect(
      s.revisarSeguridad(ok, { GOOGLE_APPLICATION_CREDENTIALS: join(RAIZ, 'clave.json') }, RAIZ)
        .errores[0]
    ).toMatch(/dentro del repo/);
    expect(
      s.revisarSeguridad(
        ok,
        { GOOGLE_APPLICATION_CREDENTIALS: '/home/x/.config/gcloud/adc.json' },
        RAIZ
      ).errores
    ).toEqual([]);
  });
});
