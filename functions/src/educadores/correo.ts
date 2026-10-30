/**
 * Correos de Ceti Educadores. Se encolan en la colección `mail` con el formato
 * de la extensión "Trigger Email" (firestore-send-email): `{to, message:
 * {subject, text, html}}`. La extensión los envía; aquí solo se arma el texto.
 *
 * Voz de Ceti: cálida e irreverente, sin miedo ni urgencia falsa. Siempre se
 * dice que nada se borra y dónde gestionar el plan (Perfil → Tu plan).
 *
 * `construirCorreo` es puro (probado); `encolarCorreo` escribe en Firestore.
 */
import type { Firestore } from 'firebase-admin/firestore';
import {
  fechaBogota,
  formatoCop,
  formatoMinutos,
  type Bitacora,
  type Ciclo,
  type PlanId,
  type PlantillaAviso,
  type ResumenAcudiente,
} from './dominio';

export const COL_MAIL = 'mail';

export const DONDE_GESTIONAR = 'Perfil → Tu plan';

export type PlantillaCorreo =
  | PlantillaAviso
  | 'recibo'
  | 'reembolso_ops'
  | 'bitacora'
  | 'invitacion_clase'
  | 'nave_cupo_ops'
  | 'resumen_acudiente';

export interface DatosCorreo {
  nombre?: string | null;
  /** Fecha principal del aviso (ms). */
  fecha?: number | null;
  plan?: PlanId | null;
  ciclo?: Ciclo | null;
  montoCop?: number | null;
  referencia?: string | null;
  /** Fin del periodo pagado (ms), para el recibo. */
  finPeriodo?: number | null;
  /** Solo para operaciones (reembolso_ops). */
  uid?: string | null;
  email?: string | null;
  wompiTxId?: string | null;
  metodo?: string | null;
  pagoId?: string | null;
  /** Solo para 'bitacora'. */
  bitacora?: Bitacora | null;
  /**
   * Solo para 'invitacion_clase': nombre de la clase, del profe, enlace de la app
   * y el correo con el que debe entrar (el mismo al que llega). Nada más del
   * estudiante: su nombre no viaja en el correo.
   */
  clase?: string | null;
  profe?: string | null;
  enlace?: string | null;
  correoInvitado?: string | null;
  /**
   * Solo para 'resumen_acudiente': el resumen (sin notas), el enlace para verlo
   * completo y el de "dejar de recibir" (`enlace` + `enlaceBaja`).
   */
  resumen?: ResumenAcudiente | null;
  enlaceBaja?: string | null;
  /** Solo para 'nave_cupo_ops' (con `fecha` = fin de la licencia). */
  colegioId?: string | null;
  colegio?: string | null;
  licenciados?: number | null;
  ocupados?: number | null;
  tope?: number | null;
  padrino?: string | null;
}

export interface MensajeCorreo {
  subject: string;
  text: string;
  html: string;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** '3 de noviembre de 2026', en hora de Bogotá. */
export function fechaLarga(ms: number): string {
  const [anio, mes, dia] = fechaBogota(ms).split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}

const NOMBRE_PLAN: Record<PlanId, string> = {
  cadete: 'Cadete',
  piloto: 'Piloto',
  comandante: 'Comandante',
  nave: 'Nave',
};

export function nombrePlan(plan: PlanId | null | undefined): string {
  return plan ? NOMBRE_PLAN[plan] : 'tu plan';
}

export function nombreCiclo(ciclo: Ciclo | null | undefined): string {
  if (ciclo === 'anioEscolar') return 'Año escolar';
  if (ciclo === 'semestral') return 'semestral';
  if (ciclo === 'mensual') return 'mensual';
  return '';
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function saludo(nombre: string | null | undefined): string {
  const n = nombre?.trim();
  return n ? `Hola, ${n}:` : 'Hola, profe:';
}

function fecha(d: DatosCorreo): string {
  return d.fecha ? fechaLarga(d.fecha) : 'pronto';
}

function monto(d: DatosCorreo): string {
  return d.montoCop ? formatoCop(d.montoCop) : '';
}

function planCompleto(d: DatosCorreo): string {
  const ciclo = nombreCiclo(d.ciclo);
  return ciclo ? `${nombrePlan(d.plan)} ${ciclo}` : nombrePlan(d.plan);
}

/** Cuerpo de un correo como párrafos; el pie (dónde gestionar el plan) lo añade `armar`. */
interface Borrador {
  subject: string;
  parrafos: string[];
  /** Pie distinto (correo a operaciones). */
  pie?: string;
}

function armar(b: Borrador): MensajeCorreo {
  const pie = b.pie ?? `Gestiona tu plan cuando quieras en la app de Ceti: ${DONDE_GESTIONAR}.`;
  const parrafos = [...b.parrafos, pie, '— El equipo de Ceti'];
  const text = parrafos.join('\n\n');
  const cuerpo = parrafos
    .map((p) => `<p style="margin:0 0 14px">${escapar(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1b1b2f;max-width:560px">' +
    cuerpo +
    '</div>';
  return { subject: b.subject, text, html };
}

function borradorBitacora(d: DatosCorreo): Borrador {
  const b = d.bitacora;
  if (!b) {
    return {
      subject: 'Tu bitácora del domingo',
      parrafos: [saludo(d.nombre), 'Esta semana no hubo datos para tu bitácora. Nos vemos el próximo domingo.'],
    };
  }
  const pct = Math.round(b.pctActivos * 100);
  const subject: Record<Bitacora['tono'], string> = {
    celebra: `Tu bitácora: ${pct} % de tu clase vino esta semana`,
    normal: `Tu bitácora de la semana: ${b.activosSemana} de ${b.estudiantes} estudiantes activos`,
    preocupada: `Tu bitácora: esta semana vino menos gente (${pct} %)`,
    dormida: 'Tu bitácora: la nave está quieta esta semana',
  };
  const apertura: Record<Bitacora['tono'], string> = {
    celebra: `Qué semana. ${b.activosSemana} de ${b.estudiantes} estudiantes entraron a Ceti.`,
    normal: `${b.activosSemana} de ${b.estudiantes} estudiantes entraron a Ceti esta semana.`,
    preocupada: `Esta semana entraron ${b.activosSemana} de ${b.estudiantes} estudiantes. Pasa; un recordatorio en clase suele bastar.`,
    dormida:
      b.estudiantes === 0
        ? 'Todavía no hay estudiantes en tus clases. Comparte el código y la nave arranca.'
        : 'Nadie entró esta semana. Ni drama: con una asignación corta vuelven.',
  };
  const parrafos = [saludo(d.nombre), apertura[b.tono]];
  if (b.quicesSemana > 0) {
    parrafos.push(
      `Resolvieron ${b.quicesSemana} quices y Ceti los calificó por ti: te ahorraste unos ${formatoMinutos(b.minutosAhorrados)}.`
    );
  }
  if (b.mundoMasDificil) {
    parrafos.push(
      `El mundo que más les cuesta: ${b.mundoMasDificil.nombre} (${b.mundoMasDificil.cursoNombre}), con ${Math.round(
        b.mundoMasDificil.maestria * 100
      )} % de dominio.`
    );
  }
  if (b.alertas.length > 0) {
    const lista = b.alertas
      .slice(0, 5)
      .map((a) =>
        `• ${a.nombre} (${a.cursoNombre}): ${a.diasSinEntrar === null ? 'aún no ha entrado' : `${a.diasSinEntrar} días sin entrar`}`
      )
      .join('\n');
    const mas = b.alertas.length > 5 ? `\n…y ${b.alertas.length - 5} más en la app.` : '';
    parrafos.push(`Quienes llevan rato sin entrar:\n${lista}${mas}`);
  }
  const paso: Record<Bitacora['siguientePaso'], string> = {
    crear_clase: 'Siguiente paso: crea tu primera clase (es gratis).',
    invitar: 'Siguiente paso: comparte el código de tu clase con tus estudiantes.',
    asignar: 'Siguiente paso: asigna un mundo para esta semana.',
    revisar_alertas: 'Siguiente paso: mira quién se quedó atrás y mándale una asignación corta.',
    reforzar_mundo: 'Siguiente paso: repasa en clase el mundo que más les cuesta.',
  };
  parrafos.push(paso[b.siguientePaso]);
  parrafos.push('La bitácora completa está en la pestaña Clases.');
  return { subject: subject[b.tono], parrafos };
}

/**
 * Invitación del profe a su clase. Va al estudiante, que casi siempre es menor:
 * le habla a él, no le pide ningún dato y no lleva su nombre (solo el correo al
 * que ya le llegó, para que entre con ese).
 */
function borradorInvitacion(d: DatosCorreo): Borrador {
  const clase = d.clase?.trim() || 'su clase';
  const profe = d.profe?.trim() || 'Tu profe';
  const correo = d.correoInvitado?.trim();
  const enlace = d.enlace?.trim() || 'la app de Ceti';
  return {
    subject: `${profe} te invitó a ${clase} en Ceti`,
    parrafos: [
      '¡Hola!',
      `${profe} te invitó a ${clase} en Ceti, la app donde se aprende de plata jugando: mundos cortos, quices y retos a tu ritmo.`,
      `Para entrar, abre ${enlace} e inicia sesión con este mismo correo${correo ? ` (${correo})` : ''}. Así quedas en tu clase sin escribir ningún código.`,
      'No tienes que llenar nada más ni pagar nada. Entra cuando quieras: tu clase te espera.',
    ],
    pie: 'Si no conoces a quien te invitó, ignora este correo y no pasa nada.',
  };
}

/**
 * Resumen semanal para el acudiente (Fase 5). Sin notas ni aciertos: avance y
 * constancia. Lleva solo el primer nombre del estudiante. Siempre dice por qué
 * le llega y cómo dejar de recibirlo (Ley 1581).
 */
function borradorResumenAcudiente(d: DatosCorreo): Borrador {
  const r = d.resumen;
  const nombre = r?.nombre ?? 'tu estudiante';
  const conProfe = r?.profe ? ` con ${r.profe}` : '';
  const baja = d.enlaceBaja?.trim();
  const pie = `Te llega porque el profe de ${nombre} activó este resumen y nos confirmó que lo autorizaste.${
    baja ? ` Para no recibirlo más: ${baja}` : ''
  }`;
  if (!r) {
    return { subject: `Así va ${nombre} en Ceti`, parrafos: ['¡Hola!', 'Esta semana no hay datos para mostrar.'], pie };
  }
  const s = r.semana;
  const parrafos = [
    '¡Hola!',
    s.diasActivos > 0
      ? `Esta semana ${nombre} entró ${s.diasActivos} ${s.diasActivos === 1 ? 'día' : 'días'} a ${r.clase}${conProfe}${
          s.minutos > 0
            ? ` y aprendió ${s.minutos} ${s.minutos === 1 ? 'minuto' : 'minutos'} de finanzas personales`
            : ''
        }.`
      : `Esta semana ${nombre} no entró a ${r.clase}${conProfe}. Un "¿cómo vas en Ceti?" en la casa suele ayudar.`,
    [
      `Lecciones terminadas: ${s.lecciones}`,
      `Mundos conquistados: ${r.conquistados} de ${r.mundos.length}`,
      `Días activos en las últimas ${r.constancia.length} semanas: ${r.constancia.map((c) => c.dias).join(' · ')}`,
    ].join('\n'),
    'Aquí no van notas: solo cuánto y con qué constancia practica. Las notas las da el profe.',
  ];
  if (d.enlace) parrafos.push(`Míralo completo: ${d.enlace}`);
  return { subject: `Así va ${nombre} en Ceti esta semana`, parrafos, pie };
}

function borrador(plantilla: PlantillaCorreo, d: DatosCorreo): Borrador {
  switch (plantilla) {
    case 'fin_prueba_pronto':
      return {
        subject: `Tu prueba de Piloto termina el ${fecha(d)}`,
        parrafos: [
          saludo(d.nombre),
          `Tu prueba de Piloto termina el ${fecha(d)}. Si no haces nada, sigues gratis con tu clase y no perdemos nada: tus mundos, tus estudiantes y su avance se quedan donde están.`,
          'Si Piloto te ahorró tiempo, puedes seguir con él desde el mismo lugar donde lo probaste. Si no, todo bien: Cadete sigue siendo tuyo.',
        ],
      };
    case 'renovacion_anual_pronto': {
      const semestral = d.ciclo === 'semestral';
      return {
        subject: `Tu ${semestral ? 'plan semestral' : 'Año escolar'} se renueva el ${fecha(d)}`,
        parrafos: [
          saludo(d.nombre),
          `El ${fecha(d)} renovamos tu plan ${nombrePlan(d.plan)} por ${semestral ? '6' : '12'} meses más${monto(d) ? `, por ${monto(d)} con IVA incluido` : ''}.`,
          'Si quieres seguir, no tienes que hacer nada. Si no, cancela antes de esa fecha en un toque y no te cobramos. Lo que tienes no se borra.',
        ],
      };
    }
    case 'renovacion_manual_pronto':
      return {
        subject: `Tu plan ${nombrePlan(d.plan)} vence el ${fecha(d)}`,
        parrafos: [
          saludo(d.nombre),
          `Tu plan ${nombrePlan(d.plan)} vence el ${fecha(d)}. Como lo pagaste sin cobro automático, no te vamos a cobrar solos.`,
          `Si quieres seguir, paga el siguiente periodo${monto(d) ? ` (${monto(d)})` : ''} desde la app. Si no, pasas a Cadete y no se borra nada.`,
        ],
      };
    case 'pago_rechazado':
      return {
        subject: `No pudimos cobrar tu plan ${nombrePlan(d.plan)}`,
        parrafos: [
          saludo(d.nombre),
          `Tu banco o Nequi no aprobó el cobro${monto(d) ? ` de ${monto(d)}` : ''} de tu plan ${nombrePlan(d.plan)}. Pasa más de lo que crees.`,
          'Lo volvemos a intentar en unos días y mientras tanto sigues con tu plan. Si quieres cambiar el medio de pago o prefieres pasar a Cadete, lo haces en un toque. Nada se borra.',
        ],
      };
    case 'pausa_termina_pronto':
      return {
        subject: `Tu pausa termina el ${fecha(d)}`,
        parrafos: [
          saludo(d.nombre),
          `Tu plan ${nombrePlan(d.plan)} vuelve el ${fecha(d)}. Primero usas los días que te quedaban pagados; el siguiente cobro llega después.`,
          '¿Necesitas más tiempo o prefieres cancelar? Las dos cosas se hacen en un toque.',
        ],
      };
    case 'bajo_a_cadete':
      return {
        subject: 'Ahora estás en Cadete (gratis)',
        parrafos: [
          saludo(d.nombre),
          'Tu plan pasó a Cadete. No se borró nada: tus clases, tus mundos y el avance de tus estudiantes siguen ahí. Lo que pase del límite de Cadete queda en solo lectura.',
          'Tus estudiantes siguen aprendiendo igual. Si un día quieres volver a tener más herramientas, te esperamos.',
        ],
      };
    case 'recibo':
      return {
        subject: `Recibo de tu pago: Ceti ${planCompleto(d)}`,
        parrafos: [
          saludo(d.nombre),
          `Recibimos ${monto(d) || 'tu pago'} por Ceti ${planCompleto(d)} (IVA incluido). Gracias por confiar en nosotros.`,
          [
            d.referencia ? `Referencia: ${d.referencia}` : null,
            d.fecha ? `Fecha: ${fechaLarga(d.fecha)}` : null,
            d.finPeriodo ? `Tu plan va hasta el ${fechaLarga(d.finPeriodo)}.` : null,
          ]
            .filter(Boolean)
            .join('\n'),
          'La factura electrónica te llega aparte. Si cambias de opinión, tienes 5 días hábiles para retractarte y te devolvemos todo.',
        ],
      };
    case 'reembolso_ops':
      return {
        subject: `Retracto: devolver ${monto(d) || 'un pago'} (${d.referencia ?? 'sin referencia'})`,
        parrafos: [
          'Un profe ejerció el derecho de retracto (Ley 1480, art. 47). Hay que devolver el pago completo.',
          [
            `Pago: ${d.pagoId ?? '—'}`,
            `Referencia Wompi: ${d.referencia ?? '—'}`,
            `Transacción Wompi: ${d.wompiTxId ?? '—'}`,
            `Monto: ${monto(d) || '—'}`,
            `Plan: Ceti ${planCompleto(d)}`,
            `Medio: ${d.metodo ?? '—'}`,
            `Profe: ${d.email ?? '—'} (uid ${d.uid ?? '—'})`,
            d.fecha ? `Pedido el ${fechaLarga(d.fecha)}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
          'Pasos: panel de Wompi → Transacciones → busca la referencia → devolución total. Después marca el pago de reembolso como "reembolsado" en Firestore (docs/educadores/operacion.md). Plazo legal: 30 días calendario.',
        ],
        pie: `El profe ya está en Cadete y ve el estado del reembolso en ${DONDE_GESTIONAR}.`,
      };
    case 'bitacora':
      return borradorBitacora(d);
    case 'invitacion_clase':
      return borradorInvitacion(d);
    case 'resumen_acudiente':
      return borradorResumenAcudiente(d);
    case 'nave_cupo_ops':
      return {
        subject: `Nave: ${d.colegio || d.colegioId || 'un colegio'} llegó a su cupo (${d.ocupados ?? '—'} de ${d.licenciados ?? '—'})`,
        parrafos: [
          'Un colegio con licencia Nave pasó el número de estudiantes de su contrato. Nadie quedó por fuera: seguimos dejando entrar hasta el margen del 10 %.',
          [
            `Colegio: ${d.colegio || '—'} (${d.colegioId ?? '—'})`,
            `Estudiantes en la licencia: ${d.licenciados ?? '—'}`,
            `Ocupados ahora: ${d.ocupados ?? '—'}`,
            `Tope con margen: ${d.tope ?? '—'}`,
            d.fecha ? `Licencia vigente hasta el ${fechaLarga(d.fecha)}` : null,
            d.padrino ? `Padrino: ${d.padrino}` : null,
          ]
            .filter(Boolean)
            .join('\n'),
          'Pasos: habla con el colegio para ampliar o renovar la licencia y después corre activarLicenciaNave con el nuevo número (docs/educadores/operacion.md). Pasado el tope, los estudiantes nuevos ven un aviso amable y no entran.',
        ],
        pie: 'Este aviso llega una sola vez por licencia; si la amplías y se vuelve a llenar, llega otro.',
      };
  }
}

/** Arma el asunto, el texto y el HTML de un correo. Puro. */
export function construirCorreo(plantilla: PlantillaCorreo, datos: DatosCorreo = {}): MensajeCorreo {
  return armar(borrador(plantilla, datos));
}

export interface PeticionCorreo {
  to: string;
  plantilla: PlantillaCorreo;
  datos?: DatosCorreo;
}

/** Encola un correo para la extensión Trigger Email. Devuelve el id del documento. */
export async function encolarCorreo(db: Firestore, p: PeticionCorreo): Promise<string> {
  const ref = await db.collection(COL_MAIL).add({ to: p.to, message: construirCorreo(p.plantilla, p.datos) });
  return ref.id;
}
