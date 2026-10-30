/**
 * Datos de ejemplo del panel docente, SOLO para desarrollo (ruta /dev/profe).
 * Reemplaza en memoria los métodos de los repositorios del profesor para poder
 * ver y probar todas sus pantallas sin cuenta ni Firestore. Nunca escribe nada.
 */
import { useAuthStore } from '@features/auth/store/useAuthStore';
import {
  rosterRepository,
  type CursoWithId,
  type EstudianteWithId,
} from '../data/rosterRepository';
import { worldProgressRepository } from '../data/worldProgressRepository';
import { asignacionRepository, type AsignacionWithId } from '../data/asignacionRepository';
import { agregadosRepository, type ResumenAgregado } from '../data/agregadosRepository';
import { classConfigRepository } from '../data/classConfigRepository';
import { courseContentRepository } from '../data/courseContentRepository';
import { adminService } from '../data/adminService';
import { newMcItem, newOrdenarItem, newVfItem } from '../data/courseContentSchemas';
import type { CursoConfigMundos, WorldProgress } from '@shared/types/tenancy';
import type { BancoDoc, QuizItem } from '@features/learning/data/quiz.types';
import { aplicarDemoSuscripcion } from '@features/educadores/data/demoSuscripcion';
import { aplicarDemoRetencion } from '@features/educadores/dev/demoRetencion';

const COLEGIO = 'demo-colegio';
const PROFE = 'demo-profe';
const DIA = 24 * 60 * 60 * 1000;
const COMPETENCIAS = ['ingreso', 'presupuesto', 'ahorro', 'credito', 'deuda'];

// createdAt: al bajar a Cadete queda editable la más reciente (las demás, solo lectura).
const cursos: CursoWithId[] = [
  {
    id: 'c10b',
    nombre: '10°B Finanzas',
    grado: '10',
    profesorUids: [PROFE],
    codigo: 'K7P2QX',
    createdAt: Date.now() - 60 * DIA,
  },
  {
    id: 'c9a',
    nombre: '9°A Matemáticas',
    grado: '9',
    profesorUids: [PROFE],
    codigo: 'M4R8TZ',
    createdAt: Date.now() - 40 * DIA,
  },
  {
    id: 'c11',
    nombre: '11° Emprendimiento',
    grado: '11',
    profesorUids: [PROFE],
    createdAt: Date.now() - 4 * DIA,
  },
];

const NOMBRES = [
  'Valentina Ríos',
  'Samuel Ortiz',
  'Mariana López',
  'Juan Esteban Gil',
  'Sara Cárdenas',
  'Tomás Restrepo',
  'Isabella Mejía',
  'Nicolás Vargas',
];

function rosterDe(cursoId: string): EstudianteWithId[] {
  if (cursoId === 'c11') return [];
  return NOMBRES.map((nombre, i) => ({
    uid: `${cursoId}-e${i}`,
    nombre,
    email: `e${i}@demo.co`,
    estado: i === 6 ? 'pendiente_atestacion' : 'activo',
    atestado: i !== 6,
    joinedAt: Date.now() - 40 * DIA,
  }));
}

// Dominio por estudiante: unos fuertes, otros flojos, uno sin actividad.
const PERFILES = [0.92, 0.84, 0.71, 0.45, 0.88, 0.58, 0, 0.35];

function progresoDe(cursoId: string, uid: string): (WorldProgress & { worldId: string })[] {
  const i = Number(uid.split('-e')[1] ?? 0);
  const base = PERFILES[i] ?? 0.6;
  if (base === 0) return [];
  const ahora = Date.now();
  return COMPETENCIAS.slice(0, 3 + (i % 3)).map((competencia, j) => ({
    colegioId: COLEGIO,
    cursoId,
    uid,
    worldId: `world_${j + 1}`,
    competencia,
    mastery: Math.max(0, Math.min(1, base + (j % 2 === 0 ? 0.06 : -0.12) * (j / 2))),
    quizScores: {},
    completed: base > 0.8,
    updatedAt: ahora - (i === 7 ? 20 : i) * DIA,
  }));
}

let asignaciones: AsignacionWithId[] = [
  {
    id: 'a1',
    worldId: 'world_2',
    target: { tipo: 'curso', cursoId: 'c10b' },
    fechaInicio: Date.now() - 2 * DIA,
    deadline: Date.now() + 5 * DIA,
    createdByUid: PROFE,
    createdAt: Date.now() - 2 * DIA,
  },
  {
    id: 'a2',
    kind: 'reto',
    reto: { tipo: 'registrar_movimientos', cantidad: 5 },
    target: { tipo: 'curso', cursoId: 'c10b' },
    fechaInicio: Date.now() - 10 * DIA,
    deadline: Date.now() - 1 * DIA,
    createdByUid: PROFE,
    createdAt: Date.now() - 10 * DIA,
  },
];

function resumenDe(cursoId: string, mastery: number, activos: number): ResumenAgregado {
  return {
    colegioId: COLEGIO,
    cursoId,
    estudiantesActivos: activos,
    masteryPromedio: mastery,
    porcentajeCompletado: mastery * 0.8,
    // El panel de adopción de la pestaña Colegio lee la frescura del agregado.
    actualizadoAt: Date.now() - DIA,
    porMundo: {},
    porCompetencia: Object.fromEntries(
      COMPETENCIAS.map((c, i) => [
        c,
        {
          masteryPromedio: Math.max(0.2, mastery - i * 0.09 + (i % 2) * 0.05),
          estudiantes: activos,
          completados: 2,
        },
      ])
    ),
  };
}

const configs: Record<string, CursoConfigMundos> = {
  c10b: {
    mundos: [
      { worldId: 'world_1', activo: true },
      { worldId: 'world_2', activo: true },
      { worldId: 'world_3', activo: true },
      { worldId: 'world_4', activo: false },
      { worldId: 'world_5', activo: true },
      {
        worldId: 'cw_feria',
        activo: false,
        nombre: 'La Feria del Trueque',
        descripcion: 'Negociar y comparar precios en el mercado local',
      },
    ],
    overrides: { world_1: { mc: true } },
    version: 3,
    updatedAt: Date.now(),
    updatedByUid: PROFE,
  },
};
const oyentes: Record<string, ((c: CursoConfigMundos | null) => void)[]> = {};

function itemsDe(piece: 'mc' | 'vf' | 'ordenar'): QuizItem[] {
  if (piece === 'mc') {
    return [
      {
        ...newMcItem('d_mc1', 'ingreso'),
        enunciado: '¿Qué es un presupuesto?',
        opciones: [
          'Un plan de ingresos y gastos',
          'Un préstamo',
          'Un tipo de ahorro',
          'Un impuesto',
        ],
        correctIndex: 0,
        explicacion: 'Planear te ayuda a decidir antes de gastar.',
      },
      {
        ...newMcItem('d_mc2', 'ingreso'),
        enunciado: 'Si ganas $100.000 y gastas $80.000, ¿cuánto te queda?',
        opciones: ['$10.000', '$20.000', '$80.000', '$180.000'],
        correctIndex: 1,
      },
      {
        ...newMcItem('d_mc3', 'ingreso'),
        enunciado: '¿Cuál de estos es un ingreso?',
        opciones: ['La mesada', 'El pasaje', 'Una gaseosa', 'Una deuda'],
        correctIndex: 0,
      },
    ];
  }
  if (piece === 'vf') {
    return [
      {
        ...newVfItem('d_vf1', 'ingreso'),
        enunciado: 'Ahorrar es guardar parte de lo que recibes.',
        respuesta: true,
      },
      {
        ...newVfItem('d_vf2', 'ingreso'),
        enunciado: 'Un deseo y una necesidad son lo mismo.',
        respuesta: false,
      },
      {
        ...newVfItem('d_vf3', 'ingreso'),
        enunciado: 'El dinero puede perder valor con el tiempo.',
        respuesta: true,
      },
    ];
  }
  return [
    {
      ...newOrdenarItem('d_or1', 'ingreso'),
      enunciado: 'Ordena los pasos para armar tu presupuesto',
      elementos: ['Anota tus ingresos', 'Lista tus gastos', 'Resta y decide cuánto ahorrar'],
      ordenCanonico: [0, 1, 2],
    },
  ];
}

/** Sustituye los repositorios por la demo y entra como profesor. */
export function activarDemoProfe(): void {
  rosterRepository.getColegioNombre = async () => 'Colegio Santa Ana (demo)';
  rosterRepository.getCursosByProfesor = async () => cursos;
  rosterRepository.getAllCursos = async () => cursos;
  rosterRepository.getRoster = async (_c, cursoId) => rosterDe(cursoId);
  rosterRepository.getCursoGrado = async (_c, cursoId) =>
    cursos.find((c) => c.id === cursoId)?.grado ?? '10';

  worldProgressRepository.getStudentProgress = async (_c, cursoId, uid) => progresoDe(cursoId, uid);

  asignacionRepository.listByCurso = async (_c, cursoId) =>
    asignaciones.filter((a) => a.target.cursoId === cursoId);
  asignacionRepository.create = async (_c, a) => {
    asignaciones = [...asignaciones, { ...a, id: `a${Date.now()}` }];
    return true;
  };

  agregadosRepository.getResumen = async (_c, cursoId) =>
    cursoId === 'c10b'
      ? resumenDe(cursoId, 0.68, 7)
      : cursoId === 'c9a'
        ? resumenDe(cursoId, 0.54, 6)
        : null;

  classConfigRepository.get = async (_c, cursoId) => configs[cursoId] ?? null;
  classConfigRepository.subscribe = (_c, cursoId, onConfig) => {
    (oyentes[cursoId] ??= []).push(onConfig);
    setTimeout(() => onConfig(configs[cursoId] ?? null), 250);
    return () => {
      oyentes[cursoId] = (oyentes[cursoId] ?? []).filter((f) => f !== onConfig);
    };
  };
  classConfigRepository.upsert = async (_c, cursoId, config) => {
    configs[cursoId] = config;
    (oyentes[cursoId] ?? []).forEach((f) => f(config));
    return true;
  };
  classConfigRepository.reset = async (_c, cursoId) => {
    delete configs[cursoId];
    (oyentes[cursoId] ?? []).forEach((f) => f(null));
    return true;
  };

  courseContentRepository.loadResolvedBanco = async (_c, _cu, grado, worldId, piece, isCustom) => {
    await new Promise((r) => setTimeout(r, 300));
    const doc: BancoDoc = {
      bancoId: `demo_${worldId}_${piece}`,
      grado,
      worldId,
      tipo: piece === 'mc' ? 'multiple_choice' : piece === 'vf' ? 'true_false' : 'ordenar',
      version: 1,
      generadoPor: 'demo',
      pendiente_validacion_docente: false,
      // Los tipos del profe (Fase 4) empiezan vacíos en la demo.
      items: piece === 'mc' || piece === 'vf' || piece === 'ordenar' ? itemsDe(piece) : [],
    };
    return { doc, source: isCustom ? 'custom' : 'default' };
  };
  courseContentRepository.loadResolvedMicroteoria = async (_c, _cu, grado, worldId) => ({
    doc: {
      grado,
      worldId,
      generadoPor: 'demo',
      pendiente_validacion_docente: false,
      cards: [
        {
          titulo: 'El dinero es una herramienta',
          cuerpo: 'Sirve para intercambiar cosas y guardar valor para después.',
          ejemplo: 'Ahorrar la mitad de tu mesada para unos tenis.',
        },
        {
          titulo: 'Ingresos y gastos',
          cuerpo: 'Lo que entra menos lo que sale es lo que te queda.',
        },
      ],
    },
    source: 'default',
  });
  courseContentRepository.savePiece = async () => true;
  courseContentRepository.restorePiece = async () => true;
  courseContentRepository.saveWorldMeta = async () => true;
  courseContentRepository.createCustomWorld = async () => 'cw_demo';
  courseContentRepository.checkCustomWorldReady = async () => ({
    ready: false,
    faltan: ['mc', 'teoria'],
  });
  courseContentRepository.deleteCustomWorld = async () => true;
  courseContentRepository.duplicateCustomWorld = async () => true;

  adminService.generateClassCode = async () => ({ code: 'K7P2QX' });
  adminService.atestar = async ({ atestado }) => ({ ok: true, atestado });
  adminService.suppressStudent = async () => ({ ok: true });
  adminService.crearMiCurso = async () => ({
    ok: true,
    colegioId: COLEGIO,
    cursoId: 'c11',
    code: 'Z9Y8X7',
  });
  adminService.generarBorradorMundo = async ({ nombre }) => {
    await new Promise((r) => setTimeout(r, 900));
    return {
      nombre,
      subtitle: 'Negociar con cabeza',
      descripcion: 'Comparar precios y negociar en el mercado local.',
      teoria: [{ titulo: 'Comparar antes de comprar', cuerpo: 'Mira al menos dos precios.' }],
      mc: [
        {
          enunciado: '¿Qué conviene antes de comprar?',
          opciones: ['Comparar', 'Correr', 'Pedir prestado', 'Nada'],
          correctIndex: 0,
        },
      ],
      vf: [{ enunciado: 'Regatear siempre es grosero.', respuesta: false }],
      ordenar: [
        { enunciado: 'Pasos para negociar', elementosCorrectos: ['Pregunta', 'Compara', 'Ofrece'] },
      ],
      eligeCamino: [],
    };
  };

  // Plan y cobros (prueba de Piloto con ~9 días, sin red) y retención (lista, Bitácora).
  aplicarDemoSuscripcion();
  aplicarDemoRetencion();

  entrarComoProfe();
  // El arranque de Firebase (sin usuario) puede limpiar la sesión después: se reaplica.
  if (!suscrito) {
    suscrito = true;
    useAuthStore.subscribe((st) => {
      if (st.role !== 'profesor') entrarComoProfe();
    });
  }
}

let suscrito = false;
let aplicando = false;

function entrarComoProfe(): void {
  if (aplicando) return;
  aplicando = true;
  const auth = useAuthStore.getState();
  auth.setClaims({ role: 'profesor', colegioId: COLEGIO, cursoId: null } as never);
  auth.setFirebaseUid(PROFE);
  auth.login();
  aplicando = false;
}
