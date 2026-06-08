/**
 * Script de seed del banco de preguntas en Firestore.
 * Uso: npx ts-node --project tsconfig.scripts.json scripts/seedQuestionBank.ts
 *
 * Requiere variables de entorno del proyecto Firebase (serviceAccount).
 * Las preguntas existentes se actualizan (upsert), no se duplican.
 */

import type { QuestionBankItem } from '../src/features/learning/data/questionBank.types';

const NOW = Date.now();

function meta(reviewedBy = 'juandda0'): QuestionBankItem['metadata'] {
  return { createdAt: NOW, version: 1, reviewedBy };
}

// ─────────────────────────────────────────────────────────────────────────────
// MUNDO 1 — "El dinero y yo"
// Concepto central: qué es el dinero, cómo funciona, primeras decisiones.
// ─────────────────────────────────────────────────────────────────────────────
export const WORLD_1_QUESTIONS: QuestionBankItem[] = [
  // ── Q1 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q01',
    worldId: 'world_1',
    concept: 'Función principal del dinero como medio de intercambio',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál es la función principal del dinero?',
      options: [
        'Servir como medio de intercambio para comprar bienes y servicios',
        'Demostrar el nivel social de una persona',
        'Guardarse en un banco sin nunca usarlo',
        'Solo sirve para pagar impuestos al gobierno',
      ],
      correctAnswer: 'Servir como medio de intercambio para comprar bienes y servicios',
      explanation:
        'El dinero es un medio de intercambio aceptado por todos que permite comprar bienes y servicios. No mide el valor de las personas ni debe permanecer inactivo.',
    },
    aiHints: {
      neutralContext: 'Pregunta sobre la función básica del dinero en la economía.',
      adaptableElements: ['ejemplos de bienes y servicios mencionados en las opciones'],
    },
    metadata: meta(),
  },

  // ── Q2 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q02',
    worldId: 'world_1',
    concept: 'Por qué el trueque fue reemplazado por el dinero',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿Por qué el trueque dejó de funcionar como sistema de intercambio?',
      options: [
        'Porque era ilegal en la mayoría de países',
        'Porque no siempre ambas partes querían lo que el otro ofrecía',
        'Porque solo funcionaba en ciudades grandes',
        'Porque el trueque nunca existió realmente',
      ],
      correctAnswer: 'Porque no siempre ambas partes querían lo que el otro ofrecía',
      explanation:
        'El trueque requería una coincidencia doble de necesidades: que yo tenga lo que tú quieres y tú tengas lo que yo quiero al mismo tiempo. El dinero eliminó esa restricción.',
    },
    aiHints: {
      neutralContext: 'Historia económica: limitaciones del trueque.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q3 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q03',
    worldId: 'world_1',
    concept: 'Clasificación de necesidades básicas',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál de los siguientes es un ejemplo de necesidad básica?',
      options: [
        'Suscripción mensual a una plataforma de streaming',
        'Alimentación diaria',
        'Un videojuego de último modelo',
        'Ropa de marca de lujo',
      ],
      correctAnswer: 'Alimentación diaria',
      explanation:
        'Las necesidades básicas son indispensables para vivir: alimentación, agua, abrigo, salud. Las demás opciones son deseos que mejoran el bienestar pero no son imprescindibles para subsistir.',
    },
    aiHints: {
      neutralContext: 'Clasificación de bienes entre necesidades y deseos.',
      adaptableElements: [
        'ejemplos de deseos en las opciones incorrectas (streaming, videojuego, ropa)',
      ],
    },
    metadata: meta(),
  },

  // ── Q4 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q04',
    worldId: 'world_1',
    concept: 'Priorización de necesidad sobre deseo con presupuesto limitado',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Tienes $50,000. Debes pagar el transporte para ir a trabajar ($15,000) y quieres comprarte unos auriculares ($45,000). ¿Qué deberías hacer primero?',
      options: [
        'Comprar los auriculares porque los quieres hace mucho tiempo',
        'Pagar el transporte porque necesitas ir a trabajar',
        'Pedir prestado a alguien para comprar ambas cosas',
        'No gastar nada y guardar todo el dinero',
      ],
      correctAnswer: 'Pagar el transporte porque necesitas ir a trabajar',
      explanation:
        'El transporte es una necesidad: sin él no puedes trabajar y perderías tu ingreso. Los auriculares son un deseo válido, pero pueden esperar. Primero cubre lo esencial.',
    },
    aiHints: {
      neutralContext: 'Decisión de priorización entre necesidad y deseo con dinero limitado.',
      adaptableElements: [
        'el objeto deseado (auriculares)',
        'los montos en pesos',
        'el contexto laboral o educativo',
      ],
    },
    metadata: meta(),
  },

  // ── Q5 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q05',
    worldId: 'world_1',
    concept: 'Definición de ingreso personal',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál de estas opciones es un ingreso?',
      options: [
        'El pago mensual de arriendo que haces',
        'Una deuda que tienes con el banco',
        'El salario que recibes por tu trabajo',
        'El gasto semanal en comida',
      ],
      correctAnswer: 'El salario que recibes por tu trabajo',
      explanation:
        'Un ingreso es dinero que entra a tu bolsillo. El salario por trabajo es la forma más común. El arriendo que pagas, la deuda y el gasto son salidas de dinero, no entradas.',
    },
    aiHints: {
      neutralContext: 'Identificar cuál de las opciones representa un ingreso.',
      adaptableElements: ['tipo de trabajo mencionado', 'monto del salario'],
    },
    metadata: meta(),
  },

  // ── Q6 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q06',
    worldId: 'world_1',
    concept: 'Diferencia entre gasto fijo y gasto variable',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Carlos paga $420,000 de arriendo cada mes, siempre el mismo monto. ¿Cómo se clasifica ese gasto?',
      options: [
        'Gasto variable, porque puede cambiar si él quiere',
        'Gasto de lujo, porque vivir en arriendo no es necesario',
        'Inversión, porque está pagando por un bien',
        'Gasto fijo, porque el monto no cambia mes a mes',
      ],
      correctAnswer: 'Gasto fijo, porque el monto no cambia mes a mes',
      explanation:
        'Un gasto fijo tiene el mismo monto todos los meses sin importar lo que hagas: arriendo, cuota de préstamo, matrícula. Un gasto variable cambia según tu consumo, como la comida o el transporte.',
    },
    aiHints: {
      neutralContext: 'Clasificación de un gasto como fijo o variable.',
      adaptableElements: ['nombre de persona', 'monto del arriendo', 'tipo de gasto fijo'],
    },
    metadata: meta(),
  },

  // ── Q7 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q07',
    worldId: 'world_1',
    concept: 'Distinción entre precio de mercado y valor percibido',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Un libro de finanzas cuesta $35,000. Después de leerlo, consigues un trabajo que paga $2,500,000 al mes. ¿Qué afirmación es más correcta?',
      options: [
        'El libro es caro porque costó $35,000 de tu bolsillo',
        'El precio del libro fue bajo pero su valor para ti fue muy alto',
        'El precio y el valor de cualquier cosa siempre son iguales',
        'El libro no valió la pena porque costó dinero real',
      ],
      correctAnswer: 'El precio del libro fue bajo pero su valor para ti fue muy alto',
      explanation:
        'Precio es lo que pagas. Valor es el beneficio que recibes. Un objeto puede tener precio bajo y valor enorme (como un libro que te cambia la vida) o precio alto y valor bajo. Aprender a distinguirlos te hace mejor consumidor.',
    },
    aiHints: {
      neutralContext: 'Diferencia conceptual entre precio pagado y valor recibido.',
      adaptableElements: ['tipo de libro o recurso', 'monto del trabajo conseguido'],
    },
    metadata: meta(),
  },

  // ── Q8 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q08',
    worldId: 'world_1',
    concept: 'Equivalencia de valor entre dinero físico y dinero digital',
    difficulty: 'basic',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        '$200,000 en efectivo tienen el mismo poder de compra que $200,000 en una cuenta bancaria digital.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Verdadero',
      explanation:
        'La forma en que existe el dinero (billetes físicos o datos digitales en un banco) no cambia su valor nominal. Ambos te permiten comprar exactamente lo mismo. La diferencia está en la forma de usarlo, no en cuánto vale.',
    },
    aiHints: {
      neutralContext: 'Equivalencia de valor entre efectivo y dinero digital.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q9 ───────────────────────────────────────────────────────────────────
  {
    id: 'w1_q09',
    worldId: 'world_1',
    concept: 'Efecto de la inflación sobre el poder adquisitivo',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question:
        'El año pasado una bolsa de mercado costaba $80,000. Este año cuesta $92,000. ¿Qué le pasó al poder adquisitivo del dinero?',
      options: [
        'Aumentó: los precios subieron porque el dinero vale más',
        'Se mantuvo igual: el dinero siempre vale lo mismo',
        'Disminuyó: con el mismo dinero puedes comprar menos que antes',
        'El dinero desapareció porque los precios subieron',
      ],
      correctAnswer: 'Disminuyó: con el mismo dinero puedes comprar menos que antes',
      explanation:
        'Cuando los precios suben (inflación), tu dinero compra menos. Con $80,000 antes comprabas la bolsa completa; ahora no alcanza. Eso significa que el poder adquisitivo de ese billete disminuyó.',
    },
    aiHints: {
      neutralContext: 'Impacto de la inflación en el poder adquisitivo del dinero.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q10 ──────────────────────────────────────────────────────────────────
  {
    id: 'w1_q10',
    worldId: 'world_1',
    concept: 'Cálculo de saldo disponible: ingresos menos gastos fijos',
    difficulty: 'basic',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Daniela gana $900,000 al mes. Paga $350,000 de arriendo, $160,000 de comida y $90,000 de transporte. ¿Cuánto le queda disponible?',
      options: [],
      correctAnswer: '$300,000',
      explanation:
        '900,000 − 350,000 − 160,000 − 90,000 = $300,000. Ese saldo disponible es lo que Daniela puede destinar a ahorro, entretenimiento u otros gastos. Saber este número es el primer paso para presupuestar.',
    },
    aiHints: {
      neutralContext: 'Cálculo aritmético: ingreso mensual menos gastos fijos básicos.',
      adaptableElements: ['nombre de persona', 'montos de ingreso y gastos', 'contexto laboral'],
    },
    metadata: meta(),
  },

  // ── Q11 ──────────────────────────────────────────────────────────────────
  {
    id: 'w1_q11',
    worldId: 'world_1',
    concept: 'Costo de oportunidad en una decisión cotidiana',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Tienes $200,000 ahorrados y te faltan exactamente $200,000 para completar el costo de un curso de programación ($400,000 total). Un amigo te invita a un viaje este fin de semana que cuesta exactamente $200,000. ¿Qué concepto describe mejor lo que perderías si te vas de viaje?',
      options: [
        'Inflación, porque el dinero perdería valor con el tiempo',
        'Costo de oportunidad: renuncias al curso para ir de viaje',
        'Gasto fijo, porque el viaje es una obligación mensual',
        'Ingreso perdido, porque el viaje no genera dinero',
      ],
      correctAnswer: 'Costo de oportunidad: renuncias al curso para ir de viaje',
      explanation:
        'El costo de oportunidad es aquello a lo que renuncias cuando eliges una opción. Si gastas los $200,000 en el viaje, renuncias al curso. No hay decisión incorrecta, pero sí consecuencias: reconocer el costo te permite elegir conscientemente.',
    },
    aiHints: {
      neutralContext: 'Identificar el costo de oportunidad en una decisión de gasto.',
      adaptableElements: [
        'tipo de curso o meta de ahorro',
        'tipo de actividad de entretenimiento',
        'montos',
      ],
    },
    metadata: meta(),
  },

  // ── Q12 ──────────────────────────────────────────────────────────────────
  {
    id: 'w1_q12',
    worldId: 'world_1',
    concept: 'Propósito y beneficio del ahorro personal',
    difficulty: 'basic',
    type: 'fill_blank',
    isAdaptable: true,
    content: {
      question:
        'Guardar una parte de tus ingresos de forma regular y disciplinada se llama _______. Su principal beneficio es tener recursos disponibles ante _______ o para alcanzar metas futuras.',
      options: ['ahorro', 'emergencias', 'deuda', 'inversión', 'gastos', 'pérdidas'],
      correctAnswer: 'ahorro, emergencias',
      explanation:
        'El ahorro es el hábito de reservar parte de tus ingresos antes de gastar. Su beneficio más inmediato es crear un colchón para emergencias (enfermedad, desempleo, daño en un objeto) sin necesidad de endeudarse.',
    },
    aiHints: {
      neutralContext: 'Completar la definición de ahorro y su propósito.',
      adaptableElements: ['ejemplos de emergencias o metas mencionados'],
    },
    metadata: meta(),
  },

  // ── Q13 ──────────────────────────────────────────────────────────────────
  {
    id: 'w1_q13',
    worldId: 'world_1',
    concept: 'La deuda no siempre es negativa: depende del propósito',
    difficulty: 'intermediate',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question: 'Pedir dinero prestado es siempre una mala decisión financiera.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Falso',
      explanation:
        'Endeudarse puede ser inteligente si el dinero se usa para algo que genera más valor del que cuesta la deuda: financiar estudios, emprender un negocio viable o comprar herramientas de trabajo. Es perjudicial cuando se usa para consumo sin retorno o cuando los intereses superan tu capacidad de pago.',
    },
    aiHints: {
      neutralContext: 'Evaluación crítica: la deuda como herramienta, no como enemigo.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q14 ──────────────────────────────────────────────────────────────────
  {
    id: 'w1_q14',
    worldId: 'world_1',
    concept: 'Seguimiento de gastos variables en un período semanal',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Sebastián recibe $700,000 de mesada mensual. En la primera semana gasta: $52,000 en comidas fuera de casa, $38,000 en transporte y $35,000 en entretenimiento. ¿Cuánto le queda para las 3 semanas restantes del mes?',
      options: [],
      correctAnswer: '$575,000',
      explanation:
        '700,000 − 52,000 − 38,000 − 35,000 = $575,000. Llevar este registro semana a semana evita quedarse sin dinero antes de fin de mes. Si Sebastián repite el mismo patrón de gasto las 3 semanas restantes, gastaría $375,000 más y le quedarían $200,000.',
    },
    aiHints: {
      neutralContext: 'Cálculo de saldo restante después de gastos de la primera semana.',
      adaptableElements: ['nombre de persona', 'montos de mesada y gastos', 'categorías de gasto'],
    },
    metadata: meta(),
  },

  // ── Q15 ──────────────────────────────────────────────────────────────────
  {
    id: 'w1_q15',
    worldId: 'world_1',
    concept: 'Las finanzas personales como hábito, no solo como conocimiento teórico',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question:
        'Valentina estudió finanzas personales durante 6 meses. Conoce perfectamente todos los conceptos. Sin embargo, nunca anota sus gastos, no ahorra y siempre llega a fin de mes sin dinero. ¿Cuál es su problema real?',
      options: [
        'Le falta estudiar más teoría sobre finanzas personales',
        'Necesita ganar más dinero antes de poder manejar sus finanzas',
        'Existe una brecha entre saber la teoría y aplicar los hábitos diariamente',
        'Las finanzas personales solo importan cuando eres adulto con familia',
      ],
      correctAnswer: 'Existe una brecha entre saber la teoría y aplicar los hábitos diariamente',
      explanation:
        'Las finanzas personales son fundamentalmente un sistema de hábitos: anotar gastos, ahorrar antes de gastar, revisar el presupuesto. Conocer la teoría es necesario pero no suficiente. La diferencia entre quien maneja bien su dinero y quien no la hace la consistencia de las acciones diarias, no la cantidad de libros leídos.',
    },
    aiHints: {
      neutralContext:
        'Diferencia entre conocimiento teórico y aplicación práctica de hábitos financieros.',
      adaptableElements: [],
    },
    metadata: meta(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MUNDO 2 — "Controlar lo que entra y sale"
// Concepto central: presupuesto personal, regla 50/30/20, fondos de emergencia.
// ─────────────────────────────────────────────────────────────────────────────
export const WORLD_2_QUESTIONS: QuestionBankItem[] = [
  // ── Q1 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q01',
    worldId: 'world_2',
    concept: 'Definición y propósito de un presupuesto personal',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Para qué sirve un presupuesto personal?',
      options: [
        'Para demostrarle a otros que eres responsable con el dinero',
        'Para planear cómo distribuir tus ingresos antes de gastarlos',
        'Para llevar un diario de todo lo que compraste el mes pasado',
        'Para calcular cuánto impuesto debes pagar al año',
      ],
      correctAnswer: 'Para planear cómo distribuir tus ingresos antes de gastarlos',
      explanation:
        'Un presupuesto es un plan anticipado: defines cuánto destinarás a cada categoría (necesidades, ahorro, gustos) antes de gastar. No es solo un registro del pasado sino una guía para el futuro.',
    },
    aiHints: {
      neutralContext: 'Definición y propósito del presupuesto personal.',
      adaptableElements: ['categorías mencionadas en la respuesta correcta'],
    },
    metadata: meta(),
  },

  // ── Q2 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q02',
    worldId: 'world_2',
    concept: 'Regla 50/30/20: distribución del ingreso',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: 'Según la regla 50/30/20, ¿cómo se divide el ingreso neto mensual?',
      options: [
        '50% ahorro, 30% necesidades, 20% gustos',
        '50% necesidades, 30% gustos o deseos, 20% ahorro e inversión',
        '50% necesidades, 20% gustos, 30% impuestos',
        '60% gastos, 20% ahorro, 20% deudas',
      ],
      correctAnswer: '50% necesidades, 30% gustos o deseos, 20% ahorro e inversión',
      explanation:
        'La regla 50/30/20 propone: 50% para necesidades (arriendo, comida, servicios), 30% para deseos (salidas, entretenimiento, ropa no esencial) y 20% para ahorro o pagar deudas. Es una guía flexible, no una ley rígida.',
    },
    aiHints: {
      neutralContext: 'Distribución porcentual de la regla 50/30/20.',
      adaptableElements: ['ejemplos de necesidades y deseos en la explicación'],
    },
    metadata: meta(),
  },

  // ── Q3 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q03',
    worldId: 'world_2',
    concept: 'Aplicar la regla 50/30/20 sobre un ingreso real',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Lucía gana $1,500,000 al mes. Aplica la regla 50/30/20. ¿Cuánto debería destinar al ahorro?',
      options: [],
      correctAnswer: '$300,000',
      explanation:
        '20% de $1,500,000 = $300,000 para ahorro. El 50% ($750,000) va a necesidades y el 30% ($450,000) a gustos. Si Lucía ahorra $300,000 cada mes, en un año acumula $3,600,000 sin esfuerzo extraordinario.',
    },
    aiHints: {
      neutralContext: 'Calcular el 20% del ingreso mensual para ahorro según la regla 50/30/20.',
      adaptableElements: ['nombre de persona', 'monto del ingreso mensual'],
    },
    metadata: meta(),
  },

  // ── Q4 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q04',
    worldId: 'world_2',
    concept: 'Detectar déficit: cuando los gastos superan los ingresos',
    difficulty: 'basic',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Felipe gana $1,200,000 al mes. Sus gastos suman: arriendo $500,000, comida $280,000, transporte $130,000, streaming y datos $95,000, salidas $260,000. ¿Cuánto le queda o cuánto le falta?',
      options: [],
      correctAnswer: 'Le faltan $65,000',
      explanation:
        '500,000 + 280,000 + 130,000 + 95,000 + 260,000 = $1,265,000 en gastos. Ingreso $1,200,000. Diferencia: −$65,000. Felipe gasta más de lo que gana. Esto es déficit: si no ajusta, acumulará deuda mes a mes.',
    },
    aiHints: {
      neutralContext:
        'Identificar si hay superávit o déficit comparando ingresos vs gastos totales.',
      adaptableElements: ['nombre de persona', 'montos de ingreso y cada categoría de gasto'],
    },
    metadata: meta(),
  },

  // ── Q5 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q05',
    worldId: 'world_2',
    concept: 'Diferencia entre gasto fijo y gasto variable',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        '¿Cuál de las siguientes parejas agrupa correctamente un gasto fijo y un gasto variable?',
      options: [
        'Arriendo ($480,000 fijo) y compras en el supermercado (variable según lo que necesites)',
        'Sueldo mensual (fijo) y préstamo bancario (variable)',
        'Netflix ($40,000 fijo) y también el arriendo ($480,000 fijo)',
        'Comida en restaurantes (fijo) y servicio de agua (variable)',
      ],
      correctAnswer:
        'Arriendo ($480,000 fijo) y compras en el supermercado (variable según lo que necesites)',
      explanation:
        'Gasto fijo: monto idéntico cada mes sin importar tu comportamiento (arriendo, cuota de crédito, suscripciones). Gasto variable: cambia según cuánto consumes (mercado, gasolina, salidas). Conocer cuáles son cuáles te ayuda a saber dónde puedes recortar.',
    },
    aiHints: {
      neutralContext: 'Clasificar correctamente un gasto fijo vs un gasto variable.',
      adaptableElements: ['ejemplos de gastos fijos y variables en las opciones'],
    },
    metadata: meta(),
  },

  // ── Q6 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q06',
    worldId: 'world_2',
    concept: 'Identificar "fugas de dinero" en comportamientos cotidianos',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Andrea revisa sus movimientos bancarios y nota que gasta $8,000 diarios en café. Nunca lo había contado. Al mes eso es $240,000. ¿Cómo se llama este tipo de gasto?',
      options: [
        'Gasto de emergencia, porque no estaba planeado',
        'Fuga de dinero: un gasto pequeño repetido que suma una cantidad significativa',
        'Inversión en bienestar, porque el café le da energía para trabajar',
        'Gasto fijo, porque lo hace todos los días',
      ],
      correctAnswer:
        'Fuga de dinero: un gasto pequeño repetido que suma una cantidad significativa',
      explanation:
        'Las fugas de dinero son gastos pequeños y frecuentes que pasan desapercibidos pero se acumulan. $8,000 diarios parecen insignificantes, pero $240,000 al mes es casi el 20% de muchos salarios. Identificarlos es clave para presupuestar con precisión.',
    },
    aiHints: {
      neutralContext:
        'Concepto de fuga de dinero: gasto pequeño y frecuente que acumula monto relevante.',
      adaptableElements: [
        'tipo de gasto cotidiano (café, snacks, transporte app)',
        'monto diario y mensual resultante',
      ],
    },
    metadata: meta(),
  },

  // ── Q7 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q07',
    worldId: 'world_2',
    concept: 'Propósito del fondo de emergencia',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿Cuál es el propósito principal de un fondo de emergencia?',
      options: [
        'Tener dinero extra para aprovechar las ofertas del mercado',
        'Cubrir gastos imprevistos sin necesidad de endeudarse',
        'Invertir en activos cuando la bolsa esté barata',
        'Ahorrar para las vacaciones de fin de año',
      ],
      correctAnswer: 'Cubrir gastos imprevistos sin necesidad de endeudarse',
      explanation:
        'El fondo de emergencia es un colchón financiero para situaciones imprevistas: enfermedad, pérdida de empleo, daño del carro o del celular. Su objetivo es que no tengas que recurrir a deuda o tarjeta de crédito cuando la vida te sorprende.',
    },
    aiHints: {
      neutralContext: 'Propósito y función del fondo de emergencia.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q8 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q08',
    worldId: 'world_2',
    concept: 'Tamaño recomendado del fondo de emergencia',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Los expertos en finanzas personales recomiendan que el fondo de emergencia cubra entre:',
      options: [
        '1 semana y 2 semanas de gastos mensuales',
        '3 y 6 meses de gastos mensuales',
        '1 año y 2 años de gastos mensuales',
        'El equivalente al 10% de tu patrimonio total',
      ],
      correctAnswer: '3 y 6 meses de gastos mensuales',
      explanation:
        'La recomendación estándar es 3 a 6 meses de gastos. Si pierdes tu ingreso, ese colchón te da tiempo para buscar trabajo o adaptarte sin endeudarte. Si tus gastos mensuales son $1,200,000, tu fondo ideal está entre $3,600,000 y $7,200,000.',
    },
    aiHints: {
      neutralContext: 'Tamaño recomendado del fondo de emergencia en meses de gasto.',
      adaptableElements: ['ejemplo de cálculo con gastos mensuales concretos'],
    },
    metadata: meta(),
  },

  // ── Q9 ───────────────────────────────────────────────────────────────────
  {
    id: 'w2_q09',
    worldId: 'world_2',
    concept: 'Consecuencia de gastar sin presupuesto',
    difficulty: 'basic',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        'Una persona que gana bien pero no lleva presupuesto no puede terminar endeudada porque tiene ingresos altos.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Falso',
      explanation:
        'El nivel de ingresos no protege del endeudamiento: lo que importa es la diferencia entre lo que entra y lo que sale. Hay personas con ingresos altos que gastan más de lo que ganan. Sin presupuesto, el gasto tiende a expandirse hasta consumir (o superar) el ingreso, sin importar su tamaño.',
    },
    aiHints: {
      neutralContext: 'Los altos ingresos no garantizan salud financiera sin presupuesto.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q10 ──────────────────────────────────────────────────────────────────
  {
    id: 'w2_q10',
    worldId: 'world_2',
    concept: 'Comparar dos presupuestos: cuál es más sostenible',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Persona A: ingreso $1,800,000, gasta $1,600,000, ahorra $200,000. Persona B: ingreso $1,800,000, gasta $1,950,000 (cubre la diferencia con tarjeta de crédito). ¿Cuál tiene un presupuesto sostenible y por qué?',
      options: [
        'Persona B, porque tiene acceso a crédito que le permite mantener su estilo de vida',
        'Persona A, porque sus gastos son menores a sus ingresos y genera ahorro',
        'Ambas, porque las dos logran cubrir sus gastos cada mes',
        'Ninguna, porque ninguna ahorra más del 20% según la regla 50/30/20',
      ],
      correctAnswer: 'Persona A, porque sus gastos son menores a sus ingresos y genera ahorro',
      explanation:
        'La sostenibilidad financiera requiere que los gastos sean menores al ingreso. La Persona B gasta $150,000 más de lo que gana cada mes: en un año acumula $1,800,000 de deuda con intereses. El crédito no es ingreso; es ingreso del futuro consumido hoy.',
    },
    aiHints: {
      neutralContext: 'Comparar dos perfiles financieros para identificar cuál es sostenible.',
      adaptableElements: [
        'montos de ingreso y gastos de ambas personas',
        'tipo de deuda utilizado',
      ],
    },
    metadata: meta(),
  },

  // ── Q11 ──────────────────────────────────────────────────────────────────
  {
    id: 'w2_q11',
    worldId: 'world_2',
    concept: 'Ajustar el presupuesto ante una reducción de ingreso',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Miguel ganaba $2,000,000 y su presupuesto estaba ajustado a ese ingreso. Le redujeron el sueldo a $1,500,000. ¿Cuál es la estrategia más razonable?',
      options: [
        'Seguir con el mismo presupuesto y cubrir la diferencia con la tarjeta de crédito',
        'Revisar qué gastos variables puede reducir o eliminar para ajustarse al nuevo ingreso',
        'Pedir un préstamo para mantener el mismo nivel de vida mientras consigue un nuevo empleo',
        'No hacer nada: el ingreso volverá a subir en algún momento',
      ],
      correctAnswer:
        'Revisar qué gastos variables puede reducir o eliminar para ajustarse al nuevo ingreso',
      explanation:
        'Ante una caída de ingreso, el presupuesto debe ajustarse de inmediato. Los gastos variables son los más fáciles de recortar. Recurrir a deuda o crédito como solución permanente empeora la situación. Un presupuesto flexible que puedes revisar y ajustar es una herramienta de resiliencia.',
    },
    aiHints: {
      neutralContext: 'Estrategia de ajuste presupuestal ante reducción de ingreso.',
      adaptableElements: [
        'nombre de persona',
        'montos de ingreso anterior y nuevo',
        'tipo de recorte posible',
      ],
    },
    metadata: meta(),
  },

  // ── Q12 ──────────────────────────────────────────────────────────────────
  {
    id: 'w2_q12',
    worldId: 'world_2',
    concept: 'Categorías esenciales de un presupuesto personal',
    difficulty: 'intermediate',
    type: 'fill_blank',
    isAdaptable: true,
    content: {
      question:
        'Un presupuesto personal completo debe tener al menos tres categorías: _______ (lo que debes pagar para vivir), _______ (lo que reservas para el futuro o emergencias) y _______ (lo que gastas en entretenimiento y gustos).',
      options: ['necesidades', 'ahorro', 'deseos', 'impuestos', 'inversiones', 'gastos variables'],
      correctAnswer: 'necesidades, ahorro, deseos',
      explanation:
        'La estructura mínima de un presupuesto saludable incluye: Necesidades (arriendo, comida, transporte, servicios), Ahorro (para metas y emergencias) y Deseos (entretenimiento, ropa, salidas). Esta es la base de la regla 50/30/20.',
    },
    aiHints: {
      neutralContext: 'Identificar las tres categorías fundamentales de un presupuesto personal.',
      adaptableElements: ['ejemplos dados de cada categoría'],
    },
    metadata: meta(),
  },

  // ── Q13 ──────────────────────────────────────────────────────────────────
  {
    id: 'w2_q13',
    worldId: 'world_2',
    concept: 'Calcular el fondo de emergencia necesario',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Los gastos mensuales de Camila suman $950,000. Quiere construir un fondo de emergencia para 4 meses. Ya tiene ahorrados $800,000. ¿Cuánto le falta para completar su fondo?',
      options: [],
      correctAnswer: '$3,000,000',
      explanation:
        'Fondo objetivo: 4 × $950,000 = $3,800,000. Camila ya tiene $800,000. Le faltan: $3,800,000 − $800,000 = $3,000,000. Si ahorra $300,000 al mes, llegará a su meta en 10 meses.',
    },
    aiHints: {
      neutralContext:
        'Calcular cuánto falta para completar un fondo de emergencia dado un monto ya ahorrado.',
      adaptableElements: [
        'nombre de persona',
        'gastos mensuales',
        'meses de cobertura objetivo',
        'ahorro ya disponible',
      ],
    },
    metadata: meta(),
  },

  // ── Q14 ──────────────────────────────────────────────────────────────────
  {
    id: 'w2_q14',
    worldId: 'world_2',
    concept: 'El presupuesto como herramienta de libertad, no de restricción',
    difficulty: 'intermediate',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question: 'Tener un presupuesto significa que no puedes darte gustos ni disfrutar tu dinero.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Falso',
      explanation:
        'Un presupuesto no elimina los gustos: los planea. Si incluyes una categoría de entretenimiento en tu presupuesto, puedes gastar ese dinero sin culpa porque ya estaba planeado. El presupuesto te da control y claridad, no te priva de disfrutar tu dinero.',
    },
    aiHints: {
      neutralContext:
        'El presupuesto como herramienta que permite gastar con intención, no con privación.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q15 ──────────────────────────────────────────────────────────────────
  {
    id: 'w2_q15',
    worldId: 'world_2',
    concept: 'Redistribuir el presupuesto para alcanzar una meta de ahorro',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Tomás gana $1,600,000. Su presupuesto actual: necesidades $900,000, gustos $500,000, ahorro $200,000. Quiere comprar un portátil de $1,200,000 en 4 meses. ¿Qué debe hacer para lograrlo sin endeudarse?',
      options: [
        'Aumentar sus ingresos inmediatamente o el plan no es viable',
        'Reducir gustos a $200,000 y ahorro a $500,000 durante 4 meses para acumular $2,000,000',
        'Seguir igual: con $200,000 en 6 meses tendrá $1,200,000',
        'Comprar el portátil con tarjeta de crédito y pagarlo en cuotas sin intereses',
      ],
      correctAnswer:
        'Reducir gustos a $200,000 y ahorro a $500,000 durante 4 meses para acumular $2,000,000',
      explanation:
        'Necesita $1,200,000 en 4 meses → $300,000/mes de ahorro adicional. Actualmente ahorra $200,000; necesita $300,000 más. Reduciendo gustos de $500,000 a $200,000 libera $300,000 → ahorro total $500,000/mes × 4 = $2,000,000, más que suficiente. El presupuesto flexible permite redistribuir temporalmente para cumplir metas.',
    },
    aiHints: {
      neutralContext:
        'Redistribuir presupuesto temporalmente para alcanzar una meta de ahorro en plazo fijo.',
      adaptableElements: [
        'nombre de persona',
        'tipo de meta (portátil, viaje, curso)',
        'montos de ingreso y categorías',
        'plazo en meses',
      ],
    },
    metadata: meta(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MUNDO 3 — "Guardar con propósito"
// Concepto central: ahorro intencional, metas SMART, interés compuesto.
// ─────────────────────────────────────────────────────────────────────────────
export const WORLD_3_QUESTIONS: QuestionBankItem[] = [
  // ── Q1 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q01',
    worldId: 'world_3',
    concept: 'Diferencia entre guardar dinero y ahorrar con propósito',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál es la diferencia entre guardar dinero y ahorrar con propósito?',
      options: [
        'No hay diferencia: guardar y ahorrar son exactamente lo mismo',
        'Guardar es reservar dinero sin un objetivo claro; ahorrar con propósito implica una meta específica y un plan para alcanzarla',
        'Ahorrar con propósito significa invertir en bolsa de valores',
        'Guardar dinero es mejor porque no implica compromisos',
      ],
      correctAnswer:
        'Guardar es reservar dinero sin un objetivo claro; ahorrar con propósito implica una meta específica y un plan para alcanzarla',
      explanation:
        'Guardar es pasivo: el dinero se acumula sin dirección. Ahorrar con propósito es activo: tienes una meta definida, un monto objetivo, un plazo y una estrategia. El propósito convierte el ahorro en una herramienta poderosa.',
    },
    aiHints: {
      neutralContext:
        'Distinción entre acumular dinero pasivamente y ahorrar con intención y meta.',
      adaptableElements: ['ejemplo de meta específica de ahorro mencionada'],
    },
    metadata: meta(),
  },

  // ── Q2 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q02',
    worldId: 'world_3',
    concept: 'Metas SMART aplicadas al ahorro personal',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        '¿Cuál de estas metas de ahorro está formulada de manera SMART (Específica, Medible, Alcanzable, Relevante, con Tiempo definido)?',
      options: [
        '"Quiero ahorrar más este año"',
        '"Voy a ahorrar $250,000 cada mes durante 8 meses para comprar una bicicleta de $2,000,000"',
        '"Necesito tener mucho dinero pronto para algo importante"',
        '"Algún día voy a ahorrar para un viaje"',
      ],
      correctAnswer:
        '"Voy a ahorrar $250,000 cada mes durante 8 meses para comprar una bicicleta de $2,000,000"',
      explanation:
        'Una meta SMART es: Específica (bicicleta), Medible ($2,000,000), Alcanzable ($250,000/mes × 8 = $2,000,000), Relevante (tiene un propósito claro) y con Tiempo definido (8 meses). Las demás opciones son intenciones vagas que dificultan el seguimiento.',
    },
    aiHints: {
      neutralContext: 'Identificar una meta de ahorro formulada con criterios SMART.',
      adaptableElements: [
        'tipo de objeto o meta a ahorrar',
        'monto mensual de ahorro',
        'plazo en meses',
      ],
    },
    metadata: meta(),
  },

  // ── Q3 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q03',
    worldId: 'world_3',
    concept: 'Calcular el tiempo necesario para alcanzar una meta de ahorro',
    difficulty: 'basic',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Valeria quiere ahorrar $1,800,000 para un curso de diseño. Puede guardar $300,000 cada mes. ¿En cuántos meses alcanzará su meta?',
      options: [],
      correctAnswer: '6 meses',
      explanation:
        '$1,800,000 ÷ $300,000 = 6 meses. Si Valeria es constante y no toca ese dinero, en exactamente 6 meses tendrá el monto completo. La constancia es la clave: fallar un mes extiende el plazo.',
    },
    aiHints: {
      neutralContext: 'División simple: meta total entre ahorro mensual para obtener el plazo.',
      adaptableElements: [
        'nombre de persona',
        'tipo de meta',
        'monto total y monto mensual de ahorro',
      ],
    },
    metadata: meta(),
  },

  // ── Q4 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q04',
    worldId: 'world_3',
    concept: 'Método "págate primero a ti mismo"',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿Qué significa el principio "págate primero a ti mismo" en finanzas personales?',
      options: [
        'Gastarte todo el dinero en lo que quieres antes de pagar deudas',
        'Apartar tu ahorro programado en el momento en que recibes tu ingreso, antes de pagar cualquier gasto',
        'Darte un premio económico cada vez que cumples una meta laboral',
        'Abrir una cuenta bancaria a tu nombre antes de usarla para gastos comunes',
      ],
      correctAnswer:
        'Apartar tu ahorro programado en el momento en que recibes tu ingreso, antes de pagar cualquier gasto',
      explanation:
        'La mayoría ahorra "lo que sobra al final del mes", que casi siempre es cero. "Págate primero" invierte la lógica: en cuanto recibes tu ingreso, mueves el monto de ahorro a una cuenta separada. Lo que queda es lo que puedes gastar. Así el ahorro es garantizado, no opcional.',
    },
    aiHints: {
      neutralContext: 'Principio de ahorro automático al inicio del mes antes de cubrir gastos.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q5 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q05',
    worldId: 'world_3',
    concept: 'Interés simple: cálculo del crecimiento del ahorro',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Andrés deposita $2,000,000 en una cuenta de ahorros que paga 6% de interés simple anual. ¿Cuánto dinero tendrá después de 1 año?',
      options: [],
      correctAnswer: '$2,120,000',
      explanation:
        'Interés simple anual: $2,000,000 × 6% = $120,000 de intereses. Total: $2,000,000 + $120,000 = $2,120,000. El interés simple se calcula siempre sobre el capital original, sin importar si los intereses se acumulan.',
    },
    aiHints: {
      neutralContext: 'Cálculo de interés simple: capital × tasa × tiempo.',
      adaptableElements: [
        'nombre de persona',
        'monto del capital inicial',
        'tasa de interés anual',
      ],
    },
    metadata: meta(),
  },

  // ── Q6 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q06',
    worldId: 'world_3',
    concept: 'Interés compuesto vs interés simple: cuál crece más',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question:
        '¿Por qué el interés compuesto hace crecer el dinero más rápido que el interés simple?',
      options: [
        'Porque tiene una tasa porcentual más alta que el interés simple',
        'Porque los intereses generados se suman al capital y a su vez generan más intereses',
        'Porque solo aplica a inversiones en bolsa de valores, que tienen mayor rentabilidad',
        'No hay diferencia real entre los dos en plazos menores a 5 años',
      ],
      correctAnswer:
        'Porque los intereses generados se suman al capital y a su vez generan más intereses',
      explanation:
        'Con interés simple, los intereses siempre se calculan sobre el capital inicial. Con interés compuesto, los intereses se suman al capital cada período, y el siguiente período se calculan sobre ese total mayor. Con el tiempo, la diferencia se vuelve enorme: es el efecto "bola de nieve".',
    },
    aiHints: {
      neutralContext:
        'Diferencia mecánica entre interés simple y compuesto y por qué el compuesto crece más.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q7 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q07',
    worldId: 'world_3',
    concept: 'Ventaja de empezar a ahorrar a edad temprana',
    difficulty: 'intermediate',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        'Empezar a ahorrar a los 18 años genera más riqueza a largo plazo que empezar a los 30, aunque el monto mensual sea el mismo.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Verdadero',
      explanation:
        'El tiempo es el ingrediente más poderoso del interés compuesto. Quien empieza a los 18 tiene 12 años más de capitalización. Esos años adicionales pueden duplicar o triplicar el resultado final aunque ahorre exactamente lo mismo cada mes. Empezar tarde no es un fracaso, pero empezar joven es una ventaja enorme.',
    },
    aiHints: {
      neutralContext:
        'El factor tiempo como ventaja del ahorro temprano gracias al interés compuesto.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q8 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q08',
    worldId: 'world_3',
    concept: 'Elegir el instrumento de ahorro adecuado según el plazo',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Paula quiere ahorrar $500,000 que no va a tocar durante 2 años. ¿Qué opción le conviene más?',
      options: [
        'Guardarlos en efectivo en su casa para tenerlos disponibles en cualquier momento',
        'Dejarlos en la cuenta corriente donde recibe su salario',
        'Depositarlos en una cuenta de ahorros o CDT que pague intereses durante ese período',
        'Gastarlos en algo útil ahora y ahorrar más adelante',
      ],
      correctAnswer:
        'Depositarlos en una cuenta de ahorros o CDT que pague intereses durante ese período',
      explanation:
        'Si el dinero no se necesita por 2 años, dejarlo quieto en efectivo o en cuenta corriente significa perder rendimiento. Una cuenta de ahorros o un CDT (Certificado de Depósito a Término) paga intereses mientras el dinero está depositado. El dinero trabaja para Paula sin que ella haga nada.',
    },
    aiHints: {
      neutralContext:
        'Seleccionar instrumento de ahorro que genere rendimiento para dinero que no se usará pronto.',
      adaptableElements: ['nombre de persona', 'monto ahorrado', 'plazo de no uso'],
    },
    metadata: meta(),
  },

  // ── Q9 ───────────────────────────────────────────────────────────────────
  {
    id: 'w3_q09',
    worldId: 'world_3',
    concept: 'Clasificar metas de ahorro por plazo: corto, mediano y largo',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál de estas metas corresponde a un ahorro de largo plazo?',
      options: [
        'Ahorrar $80,000 para comprar una chaqueta el próximo mes',
        'Ahorrar para ir a un concierto dentro de 4 meses',
        'Ahorrar durante 20 años para tener un fondo de retiro',
        'Ahorrar durante 6 meses para cambiar el celular',
      ],
      correctAnswer: 'Ahorrar durante 20 años para tener un fondo de retiro',
      explanation:
        'Corto plazo: hasta 1 año (chaqueta, concierto). Mediano plazo: 1 a 5 años (celular, viaje, curso costoso). Largo plazo: más de 5 años (retiro, vivienda, educación universitaria). Clasificar la meta ayuda a elegir el instrumento de ahorro adecuado.',
    },
    aiHints: {
      neutralContext:
        'Clasificar una meta de ahorro según su horizonte temporal: corto, mediano o largo plazo.',
      adaptableElements: ['ejemplos de metas en cada categoría temporal'],
    },
    metadata: meta(),
  },

  // ── Q10 ──────────────────────────────────────────────────────────────────
  {
    id: 'w3_q10',
    worldId: 'world_3',
    concept: 'Consecuencia de ahorrar sin una meta clara',
    difficulty: 'basic',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        'Ahorrar dinero sin tener una meta definida hace más probable que ese dinero termine gastándose en cosas no planeadas.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Verdadero',
      explanation:
        'Sin una meta clara, el dinero ahorrado no tiene "destino reservado" en la mente. Ante cualquier impulso de compra o presión social, ese dinero está disponible y es fácil justificar usarlo. Una meta específica crea compromiso psicológico: es más difícil gastar lo que ya tiene nombre y propósito.',
    },
    aiHints: {
      neutralContext: 'Sin meta, el ahorro es vulnerable al gasto impulsivo.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q11 ──────────────────────────────────────────────────────────────────
  {
    id: 'w3_q11',
    worldId: 'world_3',
    concept: 'Calcular el ahorro mensual necesario para una meta en un plazo dado',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Rodrigo quiere reunir $4,200,000 para un viaje en 14 meses. ¿Cuánto debe ahorrar cada mes?',
      options: [],
      correctAnswer: '$300,000',
      explanation:
        '$4,200,000 ÷ 14 meses = $300,000 por mes. Si Rodrigo ahorra $300,000 cada mes sin interrupciones, alcanza exactamente su meta. Este cálculo simple convierte una cifra grande y lejana en una acción concreta y manejable.',
    },
    aiHints: {
      neutralContext:
        'División: meta total entre plazo en meses para obtener el ahorro mensual requerido.',
      adaptableElements: [
        'nombre de persona',
        'tipo de meta (viaje, curso, objeto)',
        'monto total y plazo en meses',
      ],
    },
    metadata: meta(),
  },

  // ── Q12 ──────────────────────────────────────────────────────────────────
  {
    id: 'w3_q12',
    worldId: 'world_3',
    concept: 'Las tres condiciones del ahorro efectivo',
    difficulty: 'intermediate',
    type: 'fill_blank',
    isAdaptable: true,
    content: {
      question:
        'Para que el ahorro sea efectivo necesita tres condiciones: tener una _______ clara, hacerlo de forma _______ (sin saltarse meses) y mantenerlo _______ del dinero de gastos diarios.',
      options: ['meta', 'constante', 'separado', 'grande', 'visible', 'automático'],
      correctAnswer: 'meta, constante, separado',
      explanation:
        'Meta: saber para qué ahorras da motivación y dirección. Constante: el ahorro irregular pierde el efecto compuesto y es fácil de abandonar. Separado: mezclar el ahorro con el dinero de gastos lo hace invisible y vulnerable. Las tres condiciones juntas transforman la intención en resultados reales.',
    },
    aiHints: {
      neutralContext: 'Las tres condiciones del ahorro efectivo: meta, constancia y separación.',
      adaptableElements: ['ejemplos de metas o instrumentos de ahorro separado mencionados'],
    },
    metadata: meta(),
  },

  // ── Q13 ──────────────────────────────────────────────────────────────────
  {
    id: 'w3_q13',
    worldId: 'world_3',
    concept: 'Importancia de separar el ahorro del dinero de gasto',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        '¿Por qué se recomienda guardar el ahorro en una cuenta separada de la cuenta donde recibes tu salario?',
      options: [
        'Porque los bancos cobran menos comisiones si tienes dos cuentas',
        'Para evitar gastar ese dinero por impulso al verlo disponible junto a tu saldo de gasto',
        'Porque es obligatorio por ley mantener cuentas separadas para el ahorro',
        'No hay razón real: es solo una preferencia personal sin impacto financiero',
      ],
      correctAnswer:
        'Para evitar gastar ese dinero por impulso al verlo disponible junto a tu saldo de gasto',
      explanation:
        'El dinero que se ve disponible se gasta más fácilmente. Al separarlo, creas una barrera psicológica: ese dinero tiene otro propósito y no lo asocias con tu saldo de gasto diario. La fricción adicional de tener que transferirlo te da tiempo para reconsiderar si realmente lo necesitas.',
    },
    aiHints: {
      neutralContext:
        'Separar ahorro de cuenta de gastos como barrera psicológica contra el gasto impulsivo.',
      adaptableElements: ['tipo de cuenta de ahorro recomendada', 'contexto del usuario'],
    },
    metadata: meta(),
  },

  // ── Q14 ──────────────────────────────────────────────────────────────────
  {
    id: 'w3_q14',
    worldId: 'world_3',
    concept: 'Impacto de la inflación en el ahorro guardado en efectivo',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question:
        'Mariana guarda $5,000,000 en efectivo bajo el colchón durante 3 años. La inflación anual promedio es del 8%. ¿Qué le pasó al poder adquisitivo real de ese dinero?',
      options: [
        'Aumentó porque el dinero se mantuvo intacto y no tuvo pérdidas',
        'Se mantuvo igual porque los billetes físicos no pierden su valor nominal',
        'Disminuyó: aunque siguen siendo $5,000,000 nominales, compran menos bienes que antes',
        'Se duplicó porque estuvo 3 años sin gastar',
      ],
      correctAnswer:
        'Disminuyó: aunque siguen siendo $5,000,000 nominales, compran menos bienes que antes',
      explanation:
        'Después de 3 años con 8% de inflación anual, el poder adquisitivo se erosiona aproximadamente un 22%. Los $5,000,000 siguen siendo $5,000,000 en número, pero compran lo equivalente a unos $3,900,000 de hace 3 años. El efectivo sin rendimiento pierde valor real con la inflación.',
    },
    aiHints: {
      neutralContext:
        'La inflación erosiona el poder adquisitivo del efectivo guardado sin rendimiento.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q15 ──────────────────────────────────────────────────────────────────
  {
    id: 'w3_q15',
    worldId: 'world_3',
    concept: '¿Ahorrar o pagar deuda primero?',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Sofía gana $1,400,000. Tiene una deuda con el gota-a-gota que le cobra 30% mensual sobre $500,000. También quiere empezar a ahorrar. ¿Qué debe priorizar?',
      options: [
        'Ahorrar primero: el hábito del ahorro es más importante que saldar deudas',
        'Pagar ambas cosas en partes iguales cada mes para avanzar en los dos frentes',
        'Pagar la deuda primero: el 30% mensual es imposible de superar con cualquier tasa de ahorro',
        'Ignorar la deuda por ahora y construir el fondo de emergencia completo primero',
      ],
      correctAnswer:
        'Pagar la deuda primero: el 30% mensual es imposible de superar con cualquier tasa de ahorro',
      explanation:
        'Una deuda al 30% mensual crece exponencialmente. Ninguna cuenta de ahorros ni inversión conservadora te da ese rendimiento. Cada mes que no pagas, la deuda se vuelve mayor que cualquier ahorro posible. La prioridad es eliminar primero las deudas de alto costo. Luego sí, construir el ahorro desde cero.',
    },
    aiHints: {
      neutralContext:
        'Decisión: pagar deuda de alto interés vs ahorrar — cuál priorizar y por qué.',
      adaptableElements: [
        'nombre de persona',
        'tipo de deuda y tasa de interés',
        'monto adeudado',
        'ingreso mensual',
      ],
    },
    metadata: meta(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MUNDO 4 — "Usar el crédito sin que te use"
// Concepto central: crédito, intereses, historial crediticio, uso responsable.
// ─────────────────────────────────────────────────────────────────────────────
export const WORLD_4_QUESTIONS: QuestionBankItem[] = [
  // ── Q1 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q01',
    worldId: 'world_4',
    concept: 'Qué es el crédito y cómo funciona',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿Qué es el crédito en términos financieros?',
      options: [
        'Un descuento que te da el banco por ser buen cliente',
        'Dinero que recibes hoy y te comprometes a devolver en el futuro, generalmente con intereses',
        'Un tipo de ahorro que el banco guarda por ti sin cobrarte nada',
        'El saldo disponible en tu cuenta de ahorros',
      ],
      correctAnswer:
        'Dinero que recibes hoy y te comprometes a devolver en el futuro, generalmente con intereses',
      explanation:
        'El crédito es capacidad de comprar o recibir dinero hoy a cambio de pagarlo después. El prestamista cobra intereses como "precio" por prestarte ese dinero. Es una herramienta poderosa si se usa bien y peligrosa si se abusa.',
    },
    aiHints: {
      neutralContext:
        'Definición básica de crédito como deuda con compromiso de pago futuro más intereses.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q2 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q02',
    worldId: 'world_4',
    concept: 'Diferencia entre tarjeta de crédito y tarjeta débito',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        '¿Cuál es la diferencia principal entre una tarjeta débito y una tarjeta de crédito?',
      options: [
        'La tarjeta débito es solo para compras en línea; la de crédito para compras físicas',
        'Con la débito gastas dinero que ya tienes en tu cuenta; con la de crédito el banco te presta dinero que deberás devolver',
        'La tarjeta de crédito es gratuita; la débito cobra comisión por cada transacción',
        'No hay diferencia real: ambas descuentan el dinero de tu cuenta en el momento de la compra',
      ],
      correctAnswer:
        'Con la débito gastas dinero que ya tienes en tu cuenta; con la de crédito el banco te presta dinero que deberás devolver',
      explanation:
        'Débito: el dinero sale directamente de tu cuenta, es tuyo. Crédito: el banco paga por ti y tú le debes ese dinero al banco. Si no pagas el total a fin de mes, empiezan a cobrar intereses sobre lo que debes.',
    },
    aiHints: {
      neutralContext:
        'Distinción entre débito (dinero propio) y crédito (dinero prestado por el banco).',
      adaptableElements: ['ejemplos de compras mencionadas en el contexto'],
    },
    metadata: meta(),
  },

  // ── Q3 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q03',
    worldId: 'world_4',
    concept: 'Qué es la tasa de interés en un crédito',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Un banco ofrece un préstamo de $1,000,000 con una tasa de interés del 2% mensual. ¿Qué significa esa tasa?',
      options: [
        'Que el banco te devuelve el 2% de lo que pagas cada mes',
        'Que cada mes pagas $20,000 adicionales sobre lo que debes, como costo por el préstamo',
        'Que el préstamo solo dura 2 meses',
        'Que el 2% del préstamo es un regalo del banco sin necesidad de devolverlo',
      ],
      correctAnswer:
        'Que cada mes pagas $20,000 adicionales sobre lo que debes, como costo por el préstamo',
      explanation:
        '2% de $1,000,000 = $20,000 de interés mensual. Eso es lo que el banco cobra por prestarte ese dinero. Si tardas 6 meses en pagar solo los intereses, habrás pagado $120,000 extra sin reducir el capital. Por eso importa entender la tasa antes de aceptar un crédito.',
    },
    aiHints: {
      neutralContext:
        'Interpretación práctica de la tasa de interés como costo mensual del préstamo.',
      adaptableElements: [
        'monto del préstamo',
        'tasa de interés porcentual',
        'cálculo de interés en pesos',
      ],
    },
    metadata: meta(),
  },

  // ── Q4 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q04',
    worldId: 'world_4',
    concept: 'Calcular el costo real de un crédito con intereses',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'David compra un televisor de $1,800,000 a crédito en 12 cuotas de $195,000. ¿Cuánto pagó en total y cuánto fue de intereses?',
      options: [],
      correctAnswer: 'Total: $2,340,000 — Intereses: $540,000',
      explanation:
        '12 × $195,000 = $2,340,000 total pagado. El televisor valía $1,800,000, por tanto los intereses fueron $2,340,000 − $1,800,000 = $540,000. Ese es el costo real del crédito: pagó un 30% más por comprar a cuotas en lugar de contado.',
    },
    aiHints: {
      neutralContext:
        'Calcular costo total del crédito multiplicando cuota por número de meses y restando el precio original.',
      adaptableElements: [
        'nombre de persona',
        'tipo de producto comprado',
        'precio, número de cuotas y valor de cuota',
      ],
    },
    metadata: meta(),
  },

  // ── Q5 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q05',
    worldId: 'world_4',
    concept: 'Historial crediticio: qué es y para qué sirve',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿Para qué sirve el historial crediticio de una persona?',
      options: [
        'Para que el gobierno sepa cuántos impuestos debes pagar',
        'Para que bancos y prestamistas evalúen qué tan confiable eres para pagar una deuda',
        'Para demostrar que tienes dinero ahorrado en el banco',
        'Solo sirve si quieres comprar una casa: no afecta créditos pequeños',
      ],
      correctAnswer:
        'Para que bancos y prestamistas evalúen qué tan confiable eres para pagar una deuda',
      explanation:
        'El historial crediticio es tu "reputación financiera". Registra si has pagado deudas a tiempo, cuánto debes, cuántos créditos tienes activos. Un buen historial te permite acceder a mejores tasas y montos; un historial negativo puede cerrar puertas o encarecerte los créditos.',
    },
    aiHints: {
      neutralContext:
        'El historial crediticio como registro de comportamiento de pago que determina acceso a crédito.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q6 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q06',
    worldId: 'world_4',
    concept: 'Comportamientos que dañan el historial crediticio',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál de estos comportamientos daña el historial crediticio?',
      options: [
        'Pagar todas las cuotas de un crédito puntualmente',
        'Tener una tarjeta de crédito que no usas frecuentemente',
        'No pagar una deuda en la fecha acordada de manera repetida',
        'Solicitar información sobre tu propio historial crediticio',
      ],
      correctAnswer: 'No pagar una deuda en la fecha acordada de manera repetida',
      explanation:
        'Los pagos tardíos o incumplidos quedan registrados y reducen tu puntaje crediticio. Esto puede impedirte acceder a créditos futuros o forzarte a pagar tasas más altas. Pagar a tiempo, aunque sean montos pequeños, construye un historial positivo.',
    },
    aiHints: {
      neutralContext:
        'Identificar el comportamiento que impacta negativamente el historial crediticio.',
      adaptableElements: ['tipo de deuda mencionada en el contexto de la pregunta'],
    },
    metadata: meta(),
  },

  // ── Q7 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q07',
    worldId: 'world_4',
    concept: 'La trampa oculta de pagar solo la cuota mínima de la tarjeta',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Gabriela tiene $800,000 de deuda en su tarjeta de crédito al 3% mensual. Solo paga la cuota mínima de $24,000 cada mes. ¿Qué le pasa a su deuda?',
      options: [
        'La deuda disminuye $24,000 cada mes hasta desaparecer en 33 meses',
        'La deuda se mantiene igual porque $24,000 solo cubre los intereses del mes',
        'El banco le perdona la deuda si paga la mínima durante un año',
        'La deuda desaparece automáticamente después de 5 años pagando la mínima',
      ],
      correctAnswer: 'La deuda se mantiene igual porque $24,000 solo cubre los intereses del mes',
      explanation:
        '3% de $800,000 = $24,000 de interés mensual. Si paga exactamente $24,000, no abona nada al capital: la deuda sigue siendo $800,000 al mes siguiente. Para reducirla, debe pagar más que los intereses. Pagar solo la mínima puede mantener una deuda activa durante años o décadas.',
    },
    aiHints: {
      neutralContext:
        'La cuota mínima puede cubrir solo intereses sin reducir el capital de la deuda.',
      adaptableElements: [
        'nombre de persona',
        'monto de deuda en tarjeta',
        'tasa de interés mensual',
        'valor de cuota mínima',
      ],
    },
    metadata: meta(),
  },

  // ── Q8 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q08',
    worldId: 'world_4',
    concept: 'Crédito bueno vs crédito malo: la diferencia clave',
    difficulty: 'intermediate',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        'Un crédito es "bueno" cuando el beneficio que obtienes con él es mayor al costo total de los intereses que pagarás.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Verdadero',
      explanation:
        'Un crédito es bueno si genera más valor del que cuesta: financiar estudios que aumentan tu ingreso, comprar herramientas para un negocio rentable. Es malo si te endeudas para consumo sin retorno: fiestas, ropa de moda, caprichos. La pregunta siempre es: ¿lo que obtengo vale más que lo que pagaré en intereses?',
    },
    aiHints: {
      neutralContext:
        'Criterio para evaluar si un crédito es bueno: beneficio mayor al costo de intereses.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q9 ───────────────────────────────────────────────────────────────────
  {
    id: 'w4_q09',
    worldId: 'world_4',
    concept: 'Calcular el total pagado al financiar una compra a cuotas',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Un celular cuesta $2,500,000 de contado. Si lo compras a 24 cuotas de $135,000, ¿cuánto pagas en total y cuánto de más respecto al precio de contado?',
      options: [],
      correctAnswer: 'Total: $3,240,000 — Costo adicional: $740,000',
      explanation:
        '24 × $135,000 = $3,240,000. Precio contado: $2,500,000. Diferencia: $740,000. Eso es lo que pagas de más por financiar. Equivale al 29.6% adicional sobre el precio original. No siempre es mala decisión, pero debes saber exactamente cuánto te cuesta.',
    },
    aiHints: {
      neutralContext:
        'Calcular sobrecosto de financiar una compra: total cuotas menos precio de contado.',
      adaptableElements: [
        'tipo de producto',
        'precio de contado',
        'número de cuotas y valor de cada una',
      ],
    },
    metadata: meta(),
  },

  // ── Q10 ──────────────────────────────────────────────────────────────────
  {
    id: 'w4_q10',
    worldId: 'world_4',
    concept: 'Señales de que estás usando mal el crédito',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál de estas situaciones es una señal de alerta de mal uso del crédito?',
      options: [
        'Pagar el total de la tarjeta de crédito cada mes antes de la fecha límite',
        'Usar el crédito para comprar comida porque ya no tienes efectivo a fin de mes',
        'Tener un crédito para comprar herramientas de trabajo que generen ingresos',
        'Consultar la tasa de interés antes de aceptar un préstamo',
      ],
      correctAnswer:
        'Usar el crédito para comprar comida porque ya no tienes efectivo a fin de mes',
      explanation:
        'Usar crédito para cubrir necesidades básicas porque "no alcanza el dinero" indica que los gastos superan los ingresos. El crédito no resuelve ese problema: lo agrava, porque el mes siguiente tendrás las mismas necesidades más la cuota adicional. Es la entrada a un ciclo de deuda.',
    },
    aiHints: {
      neutralContext: 'Identificar el comportamiento que indica uso problemático del crédito.',
      adaptableElements: ['tipo de necesidad básica cubierta con crédito en el ejemplo'],
    },
    metadata: meta(),
  },

  // ── Q11 ──────────────────────────────────────────────────────────────────
  {
    id: 'w4_q11',
    worldId: 'world_4',
    concept: 'El gota-a-gota y el crédito informal: riesgos reales',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question:
        '¿Por qué el "gota a gota" es considerado el crédito más peligroso al que puede acceder una persona?',
      options: [
        'Porque es ilegal y puede generarte multas del gobierno',
        'Porque cobra tasas de interés extremadamente altas (a veces 20-30% semanal) y usa métodos violentos de cobro',
        'Porque solo presta montos pequeños que no sirven para gastos importantes',
        'Porque el dinero se entrega en efectivo y eso dificulta llevar el registro',
      ],
      correctAnswer:
        'Porque cobra tasas de interés extremadamente altas (a veces 20-30% semanal) y usa métodos violentos de cobro',
      explanation:
        'El gota a gota opera fuera del sistema financiero regulado. Sus tasas pueden ser del 20% semanal o más — equivalente a miles de puntos porcentuales anuales. Si no pagas, los métodos de cobro pueden incluir amenazas o violencia. Es la forma más costosa y riesgosa de crédito, y debe evitarse absolutamente.',
    },
    aiHints: {
      neutralContext:
        'Riesgos del crédito informal extrajudicial: tasas extremas y métodos de cobro violentos.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q12 ──────────────────────────────────────────────────────────────────
  {
    id: 'w4_q12',
    worldId: 'world_4',
    concept: 'Los tres factores del crédito responsable',
    difficulty: 'intermediate',
    type: 'fill_blank',
    isAdaptable: true,
    content: {
      question:
        'Para usar el crédito de forma responsable debes conocer tres cosas: la _______ de interés (cuánto te cobra el prestamista), el plazo (cuánto tiempo tienes para pagar) y tu capacidad de _______ (cuánto puedes pagar cada mes sin desbalancear tu presupuesto).',
      options: ['tasa', 'pago', 'monto', 'garantía', 'historial', 'cuota'],
      correctAnswer: 'tasa, pago',
      explanation:
        'Tasa de interés: el costo del dinero prestado. Plazo: el tiempo disponible para devolver el dinero. Capacidad de pago: cuánto puedes aportar mensualmente sin comprometer tus necesidades básicas. Ignorar cualquiera de los tres puede llevarte a una deuda que no puedes manejar.',
    },
    aiHints: {
      neutralContext: 'Los tres pilares del crédito responsable: tasa, plazo y capacidad de pago.',
      adaptableElements: ['ejemplos de créditos mencionados en el contexto'],
    },
    metadata: meta(),
  },

  // ── Q13 ──────────────────────────────────────────────────────────────────
  {
    id: 'w4_q13',
    worldId: 'world_4',
    concept: 'Cuándo tiene sentido usar un crédito',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Diego quiere abrir un pequeño negocio de comidas. Necesita $3,000,000 para equipos y materiales. Estima que el negocio le generará $800,000 de ganancia mensual. El crédito disponible cobra $120,000 al mes de intereses. ¿Tiene sentido tomar el crédito?',
      options: [
        'No, porque endeudarse para un negocio siempre es arriesgado',
        'Sí, porque la ganancia esperada ($800,000) supera ampliamente el costo del crédito ($120,000)',
        'No, porque $3,000,000 es demasiado para empezar un negocio pequeño',
        'Solo si tiene un socio que comparta el riesgo de la deuda',
      ],
      correctAnswer:
        'Sí, porque la ganancia esperada ($800,000) supera ampliamente el costo del crédito ($120,000)',
      explanation:
        'El crédito tiene sentido cuando el retorno esperado supera el costo. Aquí: $800,000 de ganancia vs $120,000 de interés → ganancia neta de $680,000. El crédito financia un activo productivo. El riesgo existe, pero la relación ganancia/costo lo justifica si la estimación es realista.',
    },
    aiHints: {
      neutralContext:
        'Evaluar si tomar un crédito tiene sentido comparando ganancia esperada vs costo de intereses.',
      adaptableElements: [
        'nombre de persona',
        'tipo de negocio',
        'monto del crédito',
        'ganancia estimada y costo de intereses',
      ],
    },
    metadata: meta(),
  },

  // ── Q14 ──────────────────────────────────────────────────────────────────
  {
    id: 'w4_q14',
    worldId: 'world_4',
    concept: 'La garantía en un crédito: qué arriesgas',
    difficulty: 'intermediate',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        'Cuando un préstamo requiere una garantía (como un bien o propiedad), esa garantía puede perderse si no pagas la deuda.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Verdadero',
      explanation:
        'Una garantía es un activo que el prestamista puede reclamar si no cumples con el pago. Si pones tu moto como garantía de un préstamo y dejas de pagar, el prestamista tiene derecho legal a quedarse con la moto. Por eso antes de aceptar un crédito con garantía debes estar muy seguro de tu capacidad de pago.',
    },
    aiHints: {
      neutralContext: 'La garantía de un crédito puede perderse ante incumplimiento de pago.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q15 ──────────────────────────────────────────────────────────────────
  {
    id: 'w4_q15',
    worldId: 'world_4',
    concept: '¿Comprar a cuotas o ahorrar primero? Análisis de la decisión',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Un portátil cuesta $2,800,000 de contado o 18 cuotas de $200,000 ($3,600,000 total). Natalia puede ahorrar $300,000 al mes. ¿Qué le conviene más financieramente?',
      options: [
        'Comprarlo a cuotas inmediatamente: tenerlo ya vale más que el sobrecosto',
        'Ahorrar durante 10 meses y comprarlo de contado: ahorra $800,000 en intereses y tiene el portátil igual',
        'No comprar el portátil: el ahorro siempre es mejor que cualquier compra',
        'Pedir prestado a un familiar sin intereses en lugar de usar cualquiera de las dos opciones',
      ],
      correctAnswer:
        'Ahorrar durante 10 meses y comprarlo de contado: ahorra $800,000 en intereses y tiene el portátil igual',
      explanation:
        '$2,800,000 ÷ $300,000 = 9.3 → 10 meses de ahorro. Costo a cuotas: $3,600,000. Ahorrando: $2,800,000. Diferencia: $800,000 menos. La paciencia de 10 meses le ahorra $800,000. No siempre se puede esperar, pero cuando sí, el ahorro previo siempre gana al financiamiento.',
    },
    aiHints: {
      neutralContext: 'Comparar costo total de cuotas vs tiempo de ahorro para compra de contado.',
      adaptableElements: [
        'nombre de persona',
        'tipo de producto',
        'precio contado',
        'cuotas disponibles',
        'capacidad de ahorro mensual',
      ],
    },
    metadata: meta(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// MUNDO 5 — "Salir de las deudas"
// Concepto central: sobreendeudamiento, métodos de pago, refinanciación, recuperación.
// ─────────────────────────────────────────────────────────────────────────────
export const WORLD_5_QUESTIONS: QuestionBankItem[] = [
  // ── Q1 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q01',
    worldId: 'world_5',
    concept: 'Qué es el sobreendeudamiento',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuándo se considera que una persona está sobreendeudada?',
      options: [
        'Cuando tiene cualquier tipo de deuda, sin importar el monto',
        'Cuando el pago de sus deudas supera su capacidad de cubrirlas con su ingreso habitual',
        'Cuando tiene más de dos tarjetas de crédito activas al mismo tiempo',
        'Cuando pide un segundo crédito antes de terminar de pagar el primero',
      ],
      correctAnswer:
        'Cuando el pago de sus deudas supera su capacidad de cubrirlas con su ingreso habitual',
      explanation:
        'El sobreendeudamiento no depende del número de deudas sino de la relación deuda-ingreso. Si el total de cuotas mensuales supera lo que puedes pagar con tu ingreso y aún cubrir tus necesidades básicas, estás sobreendeudado. La regla general: las deudas no deberían superar el 30-35% de tu ingreso neto.',
    },
    aiHints: {
      neutralContext:
        'Definición de sobreendeudamiento como exceso de deuda sobre la capacidad de pago.',
      adaptableElements: ['ejemplo de porcentaje del ingreso comprometido en deudas'],
    },
    metadata: meta(),
  },

  // ── Q2 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q02',
    worldId: 'world_5',
    concept: 'Señales de que estás entrando en una espiral de deudas',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: '¿Cuál de estas situaciones es una señal de alerta de espiral de deudas?',
      options: [
        'Pagar el total de tu tarjeta de crédito cada mes puntualmente',
        'Pedir un préstamo nuevo para pagar la cuota de otro préstamo que vence',
        'Tener un fondo de emergencia que cubre 3 meses de gastos',
        'Refinanciar una deuda para obtener una tasa de interés más baja',
      ],
      correctAnswer: 'Pedir un préstamo nuevo para pagar la cuota de otro préstamo que vence',
      explanation:
        'Usar deuda para pagar deuda es la señal más clara de espiral: cada préstamo nuevo añade más intereses a los ya existentes. La deuda total crece aunque hagas pagos. Otras señales: no saber exactamente cuánto debes, evitar abrir el extracto, o sentir angustia constante por el dinero.',
    },
    aiHints: {
      neutralContext: 'Identificar el comportamiento que indica entrada en espiral de deudas.',
      adaptableElements: ['tipo de deuda mencionada en las opciones'],
    },
    metadata: meta(),
  },

  // ── Q3 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q03',
    worldId: 'world_5',
    concept: 'Método avalancha: pagar primero la deuda con mayor interés',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿En qué consiste el método avalancha para pagar deudas?',
      options: [
        'Pagar todas las deudas en cantidades iguales cada mes',
        'Pagar primero la deuda más pequeña para eliminarla rápido y ganar motivación',
        'Pagar primero la deuda con la tasa de interés más alta para minimizar el costo total',
        'Ignorar las deudas pequeñas y concentrarse solo en la deuda más grande',
      ],
      correctAnswer:
        'Pagar primero la deuda con la tasa de interés más alta para minimizar el costo total',
      explanation:
        'El método avalancha es matemáticamente óptimo: pagas el mínimo en todas las deudas excepto en la de mayor tasa, donde pones todo el dinero extra disponible. Al eliminarla, ese dinero se redirige a la siguiente deuda de mayor tasa. Resultado: pagas menos intereses en total.',
    },
    aiHints: {
      neutralContext: 'Definición y lógica del método avalancha para pago de deudas múltiples.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q4 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q04',
    worldId: 'world_5',
    concept: 'Método bola de nieve: pagar primero la deuda más pequeña',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿En qué consiste el método bola de nieve para pagar deudas?',
      options: [
        'Pagar la deuda con mayor tasa de interés primero para ahorrar dinero',
        'Pagar la deuda de menor saldo primero para eliminarla rápido y usar esa motivación en las siguientes',
        'Pagar todas las deudas simultáneamente en cuotas iguales hasta liquidarlas todas',
        'Consolidar todas las deudas en una sola con menor tasa antes de empezar a pagar',
      ],
      correctAnswer:
        'Pagar la deuda de menor saldo primero para eliminarla rápido y usar esa motivación en las siguientes',
      explanation:
        'El método bola de nieve prioriza la psicología sobre las matemáticas: eliminar deudas pequeñas rápidamente genera victorias visibles que mantienen la motivación. Aunque pagas más intereses en total que con el método avalancha, muchas personas lo sostienen mejor porque ven resultados pronto.',
    },
    aiHints: {
      neutralContext: 'Definición y lógica del método bola de nieve para pago de deudas múltiples.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q5 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q05',
    worldId: 'world_5',
    concept: 'Comparar avalancha vs bola de nieve: cuál conviene más',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Renata tiene dos deudas: Deuda A de $200,000 al 5% mensual y Deuda B de $1,500,000 al 1.5% mensual. ¿Qué método recomiendas y por qué?',
      options: [
        'Bola de nieve: pagar primero la Deuda A (más pequeña) para eliminarla en pocos meses',
        'Avalancha: pagar primero la Deuda A (mayor tasa, 5%) para reducir el costo total de intereses',
        'Pagar ambas en montos iguales cada mes para avanzar en las dos simultáneamente',
        'Refinanciar las dos en una sola deuda antes de decidir cómo pagarla',
      ],
      correctAnswer:
        'Avalancha: pagar primero la Deuda A (mayor tasa, 5%) para reducir el costo total de intereses',
      explanation:
        'La Deuda A cobra 5% mensual — más de tres veces la tasa de la Deuda B (1.5%). Cada mes que la Deuda A existe, genera más interés proporcional. El método avalancha indica atacarla primero. Coincide con bola de nieve porque también es la más pequeña, pero la razón correcta es la tasa, no el tamaño.',
    },
    aiHints: {
      neutralContext:
        'Elegir entre avalancha y bola de nieve dado montos y tasas de dos deudas concretas.',
      adaptableElements: [
        'nombre de persona',
        'montos y tasas de las dos deudas',
        'tipo de deudas',
      ],
    },
    metadata: meta(),
  },

  // ── Q6 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q06',
    worldId: 'world_5',
    concept: 'Cómo funciona la refinanciación de deudas',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: false,
    content: {
      question: '¿En qué consiste refinanciar una deuda y cuándo tiene sentido hacerlo?',
      options: [
        'Borrar la deuda del historial crediticio pagando una tarifa al banco',
        'Reemplazar una deuda existente por una nueva con mejores condiciones (menor tasa o mayor plazo) para reducir la carga mensual',
        'Dividir la deuda entre varios familiares para que cada uno pague una parte',
        'Cancelar la deuda actual y abrirla de nuevo como si fuera un crédito nuevo',
      ],
      correctAnswer:
        'Reemplazar una deuda existente por una nueva con mejores condiciones (menor tasa o mayor plazo) para reducir la carga mensual',
      explanation:
        'Refinanciar tiene sentido cuando consigues una tasa más baja que la actual: reduces el costo total o la cuota mensual. No tiene sentido si extiende el plazo sin bajar la tasa, porque pagarás más intereses en total aunque la cuota mensual sea menor. Siempre compara el costo total, no solo la cuota.',
    },
    aiHints: {
      neutralContext:
        'Refinanciación como herramienta para mejorar condiciones de una deuda existente.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q7 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q07',
    worldId: 'world_5',
    concept: 'Calcular cuántos meses para liquidar una deuda con pago fijo',
    difficulty: 'intermediate',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Esteban debe $900,000 a tasa 0% (sin intereses). Puede pagar $150,000 al mes. ¿En cuántos meses queda libre de esa deuda?',
      options: [],
      correctAnswer: '6 meses',
      explanation:
        '$900,000 ÷ $150,000 = 6 meses. Con tasa 0% el cálculo es directo. En deudas con intereses el cálculo es más complejo porque parte del pago mensual cubre intereses y solo el resto reduce el capital. Por eso pagar más que la cuota mínima acelera significativamente la salida de deuda.',
    },
    aiHints: {
      neutralContext: 'División simple para deuda sin interés: total adeudado entre pago mensual.',
      adaptableElements: ['nombre de persona', 'monto adeudado', 'pago mensual disponible'],
    },
    metadata: meta(),
  },

  // ── Q8 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q08',
    worldId: 'world_5',
    concept: 'El efecto bola de nieve negativo: deuda que crece sola',
    difficulty: 'intermediate',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        'Una deuda con interés compuesto puede crecer más rápido de lo que la pagas si los intereses mensuales superan lo que abonas.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Verdadero',
      explanation:
        'Si debes $2,000,000 al 3% mensual, el interés mensual es $60,000. Si solo pagas $50,000, la deuda crece $10,000 ese mes. Al mes siguiente el interés se calcula sobre $2,010,000. Así, aunque hagas pagos, la deuda aumenta. Es el "efecto bola de nieve negativo": la única salida es pagar más que los intereses.',
    },
    aiHints: {
      neutralContext:
        'El interés compuesto puede hacer que una deuda crezca aunque se hagan pagos insuficientes.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q9 ───────────────────────────────────────────────────────────────────
  {
    id: 'w5_q09',
    worldId: 'world_5',
    concept: 'Negociación de deudas: es posible hablar con el acreedor',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question: 'Isabela no puede pagar su deuda este mes. ¿Qué es más recomendable que hacer?',
      options: [
        'Ignorar los cobros y esperar a tener dinero para pagar todo de una vez',
        'Contactar al acreedor, explicar la situación y negociar un plan de pago ajustado a su capacidad actual',
        'Pedir otro crédito para pagar este y ganar tiempo',
        'Cerrar la cuenta bancaria para que no puedan descontar el dinero automáticamente',
      ],
      correctAnswer:
        'Contactar al acreedor, explicar la situación y negociar un plan de pago ajustado a su capacidad actual',
      explanation:
        'La mayoría de bancos y acreedores prefieren negociar antes de llevar una deuda a cobro jurídico. Pueden ofrecer períodos de gracia, reestructuración o reducción de intereses. Ignorar el problema lo agrava: los intereses siguen corriendo, el historial se daña más y eventualmente pueden embargarte.',
    },
    aiHints: {
      neutralContext:
        'Negociar directamente con el acreedor como primera acción ante imposibilidad de pago.',
      adaptableElements: ['nombre de persona', 'tipo de deuda o acreedor'],
    },
    metadata: meta(),
  },

  // ── Q10 ──────────────────────────────────────────────────────────────────
  {
    id: 'w5_q10',
    worldId: 'world_5',
    concept: 'Qué hacer primero cuando tienes múltiples deudas',
    difficulty: 'basic',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Tienes cuatro deudas distintas. ¿Cuál es el primer paso antes de decidir cuál pagar primero?',
      options: [
        'Pagar la más reciente porque es la que menos intereses ha acumulado',
        'Listar todas las deudas con su monto, tasa de interés y cuota mínima para tener el panorama completo',
        'Pedir un préstamo grande que cubra todas las deudas de una sola vez',
        'Llamar al banco y pedir que cancelen los intereses como cortesía',
      ],
      correctAnswer:
        'Listar todas las deudas con su monto, tasa de interés y cuota mínima para tener el panorama completo',
      explanation:
        'Antes de elegir estrategia, necesitas información. Muchas personas no saben exactamente cuánto deben ni a qué tasa. Hacer el inventario de deudas revela el tamaño real del problema y permite aplicar avalancha o bola de nieve de manera informada.',
    },
    aiHints: {
      neutralContext:
        'Inventariar todas las deudas como primer paso antes de cualquier estrategia de pago.',
      adaptableElements: ['número de deudas y tipos en el contexto del usuario'],
    },
    metadata: meta(),
  },

  // ── Q11 ──────────────────────────────────────────────────────────────────
  {
    id: 'w5_q11',
    worldId: 'world_5',
    concept: 'Calcular el total adeudado con intereses acumulados en meses',
    difficulty: 'advanced',
    type: 'calculation',
    isAdaptable: true,
    content: {
      question:
        'Mateo tomó un préstamo de $500,000 al 4% mensual y no pagó nada durante 3 meses. ¿Cuánto debe ahora (interés compuesto)?',
      options: [],
      correctAnswer: '$562,432',
      explanation:
        'Con interés compuesto: $500,000 × (1.04)³ = $500,000 × 1.124864 = $562,432. En solo 3 meses sin pagar, la deuda creció $62,432. A 6 meses sería $632,659 — un 26.5% más. Cada mes que no se paga, la base sobre la que se calcula el interés es mayor.',
    },
    aiHints: {
      neutralContext: 'Cálculo de interés compuesto: capital × (1 + tasa)^meses sin pago.',
      adaptableElements: [
        'nombre de persona',
        'monto original del préstamo',
        'tasa mensual',
        'número de meses sin pago',
      ],
    },
    metadata: meta(),
  },

  // ── Q12 ──────────────────────────────────────────────────────────────────
  {
    id: 'w5_q12',
    worldId: 'world_5',
    concept: 'Los pasos para salir de deudas',
    difficulty: 'intermediate',
    type: 'fill_blank',
    isAdaptable: true,
    content: {
      question:
        'El plan básico para salir de deudas tiene tres pasos: primero _______ todas tus deudas (monto, tasa, cuota), luego elegir una _______ de pago (avalancha o bola de nieve) y finalmente liberar _______ extra en tu presupuesto para acelerar los pagos.',
      options: ['listar', 'estrategia', 'dinero', 'negociar', 'ignorar', 'crédito'],
      correctAnswer: 'listar, estrategia, dinero',
      explanation:
        'Paso 1 — Listar: conoce el enemigo. Paso 2 — Estrategia: decide el orden de ataque. Paso 3 — Dinero extra: recorta gastos variables, vende cosas que no usas, o genera ingresos adicionales. Sin dinero extra, salir de deudas es posible pero mucho más lento.',
    },
    aiHints: {
      neutralContext: 'Los tres pasos esenciales para construir un plan de salida de deudas.',
      adaptableElements: ['ejemplos de formas de liberar dinero extra mencionados'],
    },
    metadata: meta(),
  },

  // ── Q13 ──────────────────────────────────────────────────────────────────
  {
    id: 'w5_q13',
    worldId: 'world_5',
    concept: 'La deuda genera estrés: impacto en el bienestar mental',
    difficulty: 'basic',
    type: 'true_false',
    isAdaptable: false,
    content: {
      question:
        'El estrés financiero causado por las deudas puede afectar la salud mental y el rendimiento laboral o académico de una persona.',
      options: ['Verdadero', 'Falso'],
      correctAnswer: 'Verdadero',
      explanation:
        'Las deudas no son solo un problema económico: generan ansiedad, dificultades para dormir, problemas de concentración y conflictos en relaciones personales. Estudios muestran que el estrés financiero impacta directamente el rendimiento y la toma de decisiones. Salir de deudas mejora tanto las finanzas como el bienestar general.',
    },
    aiHints: {
      neutralContext: 'El impacto psicológico y en el bienestar del sobreendeudamiento.',
      adaptableElements: [],
    },
    metadata: meta(),
  },

  // ── Q14 ──────────────────────────────────────────────────────────────────
  {
    id: 'w5_q14',
    worldId: 'world_5',
    concept: 'Hábitos que evitan volver a endeudarse después de salir',
    difficulty: 'intermediate',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Después de salir de deudas, ¿cuál hábito es más importante para no volver a caer en ellas?',
      options: [
        'No usar nunca más ningún tipo de crédito o tarjeta de crédito',
        'Construir un fondo de emergencia que cubra al menos 3 meses de gastos',
        'Guardar todos los estados de cuenta anteriores como recordatorio del sufrimiento pasado',
        'Gastar todo lo que se puede ahora que ya no hay deudas, como recompensa',
      ],
      correctAnswer: 'Construir un fondo de emergencia que cubra al menos 3 meses de gastos',
      explanation:
        'La razón número uno por la que las personas vuelven a endeudarse es una emergencia sin respaldo: enfermedad, pérdida de empleo, daño de un equipo. Sin fondo de emergencia, cualquier imprevisto los devuelve al crédito. El fondo es el escudo que interrumpe el ciclo.',
    },
    aiHints: {
      neutralContext: 'El fondo de emergencia como principal protección contra recaída en deudas.',
      adaptableElements: ['ejemplos de emergencias que llevan de vuelta al crédito'],
    },
    metadata: meta(),
  },

  // ── Q15 ──────────────────────────────────────────────────────────────────
  {
    id: 'w5_q15',
    worldId: 'world_5',
    concept: 'Plan integral de recuperación financiera',
    difficulty: 'advanced',
    type: 'multiple_choice',
    isAdaptable: true,
    content: {
      question:
        'Juliana gana $1,800,000. Tiene tres deudas: $300,000 al 5% mensual, $800,000 al 2% mensual y $1,200,000 al 1% mensual. Sus gastos básicos son $1,100,000. ¿Cuál es su mejor plan?',
      options: [
        'Pagar cuotas mínimas en todas y usar los $700,000 restantes en lo que quiera',
        'Pagar mínimos en las deudas de 2% y 1%, y destinar todo el dinero disponible sobre mínimos a la deuda del 5%',
        'Refinanciar las tres deudas en una sola antes de hacer cualquier pago',
        'Dejar de pagar la deuda más grande y concentrarse en las pequeñas para eliminarlas primero',
      ],
      correctAnswer:
        'Pagar mínimos en las deudas de 2% y 1%, y destinar todo el dinero disponible sobre mínimos a la deuda del 5%',
      explanation:
        'Ingreso disponible sobre gastos: $1,800,000 − $1,100,000 = $700,000. Método avalancha: la deuda del 5% es la más costosa. Se pagan mínimos en las otras dos y todo el dinero extra va a la deuda del 5%. Al liquidarla, ese dinero se suma al pago de la del 2%, y así hasta salir completamente. Es el camino más eficiente.',
    },
    aiHints: {
      neutralContext: 'Aplicar el método avalancha con múltiples deudas y presupuesto limitado.',
      adaptableElements: [
        'nombre de persona',
        'montos y tasas de cada deuda',
        'ingreso y gastos básicos',
      ],
    },
    metadata: meta(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// RUNNER — ejecuta el seed contra Firestore
// ─────────────────────────────────────────────────────────────────────────────
async function seed() {
  const admin = await import('firebase-admin');
  const fs = await import('fs');
  const path = await import('path');

  if (!admin.apps.length) {
    const saPath = path.resolve(__dirname, '../serviceAccount.json');
    if (fs.existsSync(saPath)) {
      // Usa serviceAccount.json si existe en la raíz del proyecto
      admin.initializeApp({
        credential: admin.credential.cert(require(saPath)),
      });
      console.log('🔑 Usando serviceAccount.json');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Usa la variable de entorno si está seteada
      admin.initializeApp();
      console.log('🔑 Usando GOOGLE_APPLICATION_CREDENTIALS');
    } else {
      console.error(
        '❌ No se encontraron credenciales.\n' +
          '   Opción A: Descarga el Service Account JSON desde Firebase Console → Project Settings → Service Accounts\n' +
          '             y guárdalo como serviceAccount.json en la raíz del proyecto.\n' +
          '   Opción B: Setea GOOGLE_APPLICATION_CREDENTIALS=<ruta al json>'
      );
      process.exit(1);
    }
  }

  const db = admin.firestore();

  // Contar documentos existentes por mundo antes del seed
  console.log('\n📊 Estado ANTES del seed:');
  const worlds = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'];
  for (const worldId of worlds) {
    const snap = await db.collection('questionBank').where('worldId', '==', worldId).get();
    console.log(`  ${worldId}: ${snap.size} documentos`);
  }

  const batch = db.batch();
  const allQuestions = [
    ...WORLD_1_QUESTIONS,
    ...WORLD_2_QUESTIONS,
    ...WORLD_3_QUESTIONS,
    ...WORLD_4_QUESTIONS,
    ...WORLD_5_QUESTIONS,
  ];

  for (const q of allQuestions) {
    const ref = db.collection('questionBank').doc(q.id);
    batch.set(ref, q, { merge: true });
  }

  await batch.commit();

  // Contar documentos existentes por mundo después del seed
  console.log('\n📊 Estado DESPUÉS del seed:');
  for (const worldId of worlds) {
    const snap = await db.collection('questionBank').where('worldId', '==', worldId).get();
    console.log(`  ${worldId}: ${snap.size} documentos`);
  }

  console.log(`\n✅ ${allQuestions.length} preguntas escritas en Firestore (upsert).`);
}

seed().catch((err) => {
  console.error('❌ Error en seed:', err);
  process.exit(1);
});
