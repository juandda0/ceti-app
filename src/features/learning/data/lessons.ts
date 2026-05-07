// data/lessons.ts — Contenido de las 5 lecciones del MVP sin emojis
export type StepType = 'story' | 'quiz' | 'interactive' | 'simulation' | 'goal_creator';

export interface StoryStep {
  type: 'story';
  title: string;
  content: string;
  illustration: string;
}

export interface QuizOption {
  text: string;
  correct: boolean;
}

export interface QuizStep {
  type: 'quiz';
  question: string;
  options: QuizOption[];
  explanation: string;
}

export interface InteractiveItem {
  text: string;
  category: 'need' | 'want';
}

export interface InteractiveStep {
  type: 'interactive';
  title: string;
  instruction: string;
  items: InteractiveItem[];
}

export interface SimulationStep {
  type: 'simulation';
  title: string;
  instruction: string;
  answer: number;
  hint: string;
}

export interface GoalCreatorStep {
  type: 'goal_creator';
  title: string;
  instruction: string;
  fields: string[];
}

export type LessonStep = StoryStep | QuizStep | InteractiveStep | SimulationStep | GoalCreatorStep;

export interface Lesson {
  id: string;
  title: string;
  icon: string; // Cambiado de emoji a nombre de icono Ionicons
  description: string;
  xpReward: number;
  cetisReward: number;
  color: string;
  steps: LessonStep[];
}

const q = (
  question: string,
  correct: string,
  wrongA: string,
  wrongB: string,
  wrongC: string,
  explanation: string
): QuizStep => ({
  type: 'quiz',
  question,
  options: [
    { text: wrongA, correct: false },
    { text: correct, correct: true },
    { text: wrongB, correct: false },
    { text: wrongC, correct: false },
  ],
  explanation,
});

export const LESSONS: Lesson[] = [
  {
    id: 'lesson_1',
    title: '¿Qué es el Dinero?',
    icon: 'cash-outline',
    description: 'Objetivo: entender para qué usamos el dinero en la vida real.',
    xpReward: 50,
    cetisReward: 20,
    color: '#3498DB',
    steps: [
      {
        type: 'story',
        title: 'Del trueque a la tienda',
        content:
          'Antes la gente cambiaba cosas por cosas. Hoy usamos dinero para comprar fácil, como una merienda o un cuaderno.',
        illustration: 'barter',
      },
      q(
        '¿Para qué sirve el dinero?',
        'Para comprar cosas y pagar servicios',
        'Para decorar',
        'Para hacer magia',
        'Para romperlo',
        'Con dinero puedes pagar cosas útiles del día a día.'
      ),
      q(
        'Antes del dinero, la gente usaba...',
        'El trueque',
        'Tarjetas',
        'Aplicaciones',
        'Cajeros',
        'El trueque era intercambio directo de objetos.'
      ),
      q(
        '¿Qué problema resolvió el dinero?',
        'Que no siempre se podía cambiar justo',
        'Que llovía mucho',
        'Que no había juguetes',
        'Que no había escuelas',
        'Con dinero es más fácil hacer intercambios justos.'
      ),
      q(
        'Si vendes limonada y recibes monedas, eso es...',
        'Ganar dinero por tu trabajo',
        'Un castigo',
        'Un préstamo',
        'Un regalo sin razón',
        'Si haces una actividad y te pagan, es dinero ganado.'
      ),
      q(
        'La mejor frase sobre el dinero es...',
        'Es una herramienta que hay que usar bien',
        'Es un juguete',
        'No sirve para nada',
        'Solo los adultos lo usan',
        'Usar bien el dinero te ayuda a decidir mejor.'
      ),
    ],
  },
  {
    id: 'lesson_2',
    title: 'Necesidades y Deseos',
    icon: 'bulb-outline',
    description: 'Objetivo: aprender qué va primero cuando tienes que elegir en qué gastar.',
    xpReward: 60,
    cetisReward: 25,
    color: '#9B59B6',
    steps: [
      {
        type: 'story',
        title: 'Primero lo importante',
        content:
          'Si tienes poco dinero, primero va lo necesario: comida, agua o transporte. Lo demás puede esperar.',
        illustration: 'needs_vs_wants',
      },
      q(
        '¿Cuál es una necesidad?',
        'Agua',
        'Videojuego',
        'Helado',
        'Sticker',
        'El agua es esencial para vivir.'
      ),
      q(
        '¿Cuál es un deseo?',
        'Un juguete nuevo',
        'Medicina',
        'Comida básica',
        'Vivienda',
        'Un juguete puede esperar, no es básico para vivir.'
      ),
      q(
        'Si tienes poco dinero, ¿qué pagas primero?',
        'Necesidades',
        'Deseos',
        'Nada',
        'Juegos siempre',
        'Priorizar necesidades evita problemas básicos.'
      ),
      q(
        'Comida, salud y vivienda son...',
        'Necesidades',
        'Lujo',
        'Caprichos',
        'Premios',
        'Son cosas básicas para vivir bien.'
      ),
      q(
        'Elegir bien entre necesidad y deseo ayuda a...',
        'Que el dinero te alcance mejor',
        'Gastar más rápido',
        'Comprar por impulso',
        'No pensar',
        'Cuando eliges bien, evitas quedarte sin dinero rápido.'
      ),
    ],
  },
  {
    id: 'lesson_3',
    title: 'Ingresos y Gastos',
    icon: 'archive-outline',
    description: 'Objetivo: entender el dinero que entra y el dinero que sale.',
    xpReward: 70,
    cetisReward: 30,
    color: '#E67E22',
    steps: [
      {
        type: 'story',
        title: 'Como una alcancía',
        content: 'Ingreso es lo que entra a tu bolsillo. Gasto es lo que sale cuando compras algo.',
        illustration: 'income',
      },
      q(
        'Si recibes 20 Cetis por una tarea, eso es...',
        'Ingreso',
        'Gasto',
        'Deuda',
        'Multa',
        'El ingreso es dinero que entra.'
      ),
      q(
        'Si compras una merienda, eso es...',
        'Gasto',
        'Ingreso',
        'Ahorro',
        'Inversión avanzada',
        'Un gasto es salida de dinero.'
      ),
      q('Si entra 30 y sale 10, te quedan...', '20', '40', '10', '0', 'Saldo = ingresos - gastos.'),
      q(
        'Si gastas más de lo que recibes, ¿qué pasa?',
        'Te quedas sin dinero o debes',
        'Te sobra más dinero',
        'No cambia nada',
        'Ganas premio',
        'Si gastas de más, tendrás problemas con tu plata.'
      ),
      q(
        'Una buena práctica es...',
        'Anotar lo que entra y lo que sale',
        'Gastar sin mirar',
        'Olvidar tus gastos',
        'No revisar saldo',
        'Anotar te ayuda a saber cómo vas.'
      ),
    ],
  },
  {
    id: 'lesson_4',
    title: 'Decisiones de Compra',
    icon: 'bar-chart-outline',
    description: 'Objetivo: comprar con calma y comparar antes de elegir.',
    xpReward: 80,
    cetisReward: 35,
    color: '#1ABC9C',
    steps: [
      {
        type: 'story',
        title: 'Pausa antes de comprar',
        content:
          'Antes de comprar, pregúntate: ¿lo necesito?, ¿me alcanza?, ¿hay una opción mejor?',
        illustration: 'smart_buy',
      },
      q(
        '¿Qué conviene hacer antes de comprar?',
        'Comparar opciones',
        'Comprar sin mirar',
        'Elegir lo primero',
        'Copiar al amigo',
        'Comparar mejora la decisión.'
      ),
      q(
        'Una compra impulsiva es...',
        'Comprar sin pensar',
        'Planear con tiempo',
        'Comparar calidad',
        'Revisar presupuesto',
        'Comprar por impulso suele ser mala idea.'
      ),
      q(
        'Si dos productos sirven igual, ¿qué revisas?',
        'Precio y calidad',
        'Solo color',
        'Solo marca',
        'Solo moda',
        'Elige el que te dé más por tu dinero.'
      ),
      q(
        'Una buena pregunta antes de comprar es...',
        '¿Lo necesito ahora?',
        '¿Se ve bonito?',
        '¿Todos lo tienen?',
        '¿Es tendencia?',
        'La necesidad ayuda a priorizar mejor.'
      ),
      q(
        'Comprar bien te ayuda a...',
        'Cuidar tu dinero',
        'Gastar más siempre',
        'No ahorrar nunca',
        'Perder control',
        'Si eliges bien, tu dinero dura más.'
      ),
    ],
  },
  {
    id: 'lesson_5',
    title: 'Resumen de Fundamentos',
    icon: 'rocket-outline',
    description: 'Objetivo: usar todo lo básico en ejemplos de la vida real.',
    xpReward: 100,
    cetisReward: 50,
    color: '#E74C3C',
    steps: [
      {
        type: 'story',
        title: 'Todo junto',
        content:
          'Ya sabes qué es el dinero, qué va primero al gastar y cómo revisar lo que entra y sale.',
        illustration: 'full_plan',
      },
      q(
        'Si tienes 15 y gastas 6, ¿saldo final?',
        '9',
        '21',
        '6',
        '0',
        'Restar gastos al total da el saldo.'
      ),
      q(
        '¿Qué va primero en una decisión sana?',
        'Necesidad',
        'Deseo',
        'Impulso',
        'Moda',
        'Primero se cubren necesidades.'
      ),
      q(
        'Recibir Cetis por ayudar en casa es...',
        'Ingreso',
        'Gasto',
        'Deuda',
        'Multa',
        'El ingreso es entrada de dinero.'
      ),
      q(
        'Comprar por impulso suele causar...',
        'Desorden en el dinero',
        'Más control',
        'Más ahorro',
        'Mejor plan',
        'Comprar sin pensar trae errores de gasto.'
      ),
      q(
        'La mejor frase de esta sección es...',
        'Piensa antes de gastar',
        'Gasta todo hoy',
        'Nunca revises saldo',
        'Ahorra solo si sobra',
        'Pensar antes de gastar mejora todo.'
      ),
    ],
  },
  {
    id: 'lesson_6',
    title: '¿Qué es Ahorrar?',
    icon: 'calculator-outline',
    description: 'Objetivo: entender el ahorro como hábito fácil y útil.',
    xpReward: 110,
    cetisReward: 55,
    color: '#16A085',
    steps: [
      {
        type: 'story',
        title: 'Tu yo del futuro te lo agradece',
        content: 'Ahorrar es guardar un poquito hoy para usarlo después en algo que te importa.',
        illustration: 'savings_rule',
      },
      q(
        'Ahorrar significa...',
        'Guardar una parte del dinero',
        'Gastar todo',
        'Prestar todo',
        'No planear nada',
        'Ahorrar es separar dinero para el futuro.'
      ),
      q(
        'Si recibes 10 y guardas 2, ahorraste...',
        '2',
        '8',
        '10',
        '0',
        'Ahorro es la parte apartada.'
      ),
      q(
        '¿Cuándo conviene ahorrar?',
        'Cada vez que recibes dinero',
        'Solo cuando sobra mucho',
        'Nunca',
        'Solo en vacaciones',
        'Guardar un poco siempre funciona mejor.'
      ),
      q(
        'Ahorrar te ayuda a...',
        'Cumplir metas después',
        'Gastar más impulsivo',
        'Olvidar tus gastos',
        'No decidir',
        'Ahorrar hoy te ayuda mañana.'
      ),
      q(
        'La mejor regla básica es...',
        'Ahorrar primero',
        'Gastar primero',
        'No registrar nada',
        'Comprar por emoción',
        'Primero guarda, después gasta.'
      ),
    ],
  },
  {
    id: 'lesson_7',
    title: 'Metas de Ahorro',
    icon: 'pricetags-outline',
    description: 'Objetivo: crear metas claras, simples y fáciles de seguir.',
    xpReward: 120,
    cetisReward: 60,
    color: '#2980B9',
    steps: [
      {
        type: 'story',
        title: 'Meta clara = camino claro',
        content: 'Una meta clara responde: qué quieres, cuánto cuesta y para cuándo.',
        illustration: 'goal_setting',
      },
      q(
        'Una meta clara incluye...',
        'Monto y tiempo',
        'Solo deseo',
        'Solo emoción',
        'Solo color',
        'Una meta buena tiene número y fecha.'
      ),
      q(
        'Si tu meta cuesta 30 y ahorras 5 por semana, tardas...',
        '6 semanas',
        '3 semanas',
        '10 semanas',
        '2 semanas',
        '30/5 = 6 semanas.'
      ),
      q(
        '¿Qué frase es una meta clara?',
        'Ahorrar 20 en 4 semanas',
        'Quiero algo algún día',
        'Me gusta comprar',
        'Veremos después',
        'Una meta clara es específica y medible.'
      ),
      q(
        '¿Para qué sirve poner fecha?',
        'Para saber cuánto ahorrar cada semana',
        'Para gastar más',
        'Para olvidar la meta',
        'Para no medir',
        'La fecha te ayuda a hacer un plan real.'
      ),
      q(
        'Si no revisas tu avance...',
        'Es más difícil cumplir la meta',
        'Es más fácil',
        'No cambia nada',
        'Se cumple sola',
        'Revisar te dice si vas bien o no.'
      ),
    ],
  },
  {
    id: 'lesson_8',
    title: 'Ahorro Semanal',
    icon: 'trending-up-outline',
    description: 'Objetivo: practicar cuentas fáciles de ahorro semanal.',
    xpReward: 130,
    cetisReward: 65,
    color: '#8E44AD',
    steps: [
      {
        type: 'story',
        title: 'De poquito en poquito',
        content: 'Ahorrar poco cada semana funciona. No tienes que guardar mucho de una sola vez.',
        illustration: 'compound_habit',
      },
      q('Si ahorras 3 por semana durante 4 semanas, tienes...', '12', '7', '8', '3', '3x4 = 12.'),
      q('Si ahorras 2 por semana en 10 semanas, tienes...', '20', '12', '8', '30', '2x10 = 20.'),
      q(
        '¿Qué vale más para ahorrar?',
        'Ser constante',
        'Suerte',
        'Impulso',
        'Olvido',
        'Guardar seguido da mejores resultados.'
      ),
      q(
        'Si una semana no ahorras, lo mejor es...',
        'Retomar la siguiente',
        'Rendirse',
        'Gastar más',
        'Olvidar la meta',
        'El progreso real viene de volver al plan.'
      ),
      q(
        'Ahorro semanal es...',
        'Guardar un monto cada semana',
        'Gastar un monto fijo',
        'Comprar cada semana',
        'Esperar regalos',
        'Es una forma fácil de juntar dinero.'
      ),
    ],
  },
  {
    id: 'lesson_9',
    title: 'Plan para Cumplir Metas',
    icon: 'shield-checkmark-outline',
    description: 'Objetivo: convertir una meta en pasos fáciles de cumplir.',
    xpReward: 140,
    cetisReward: 70,
    color: '#D35400',
    steps: [
      {
        type: 'story',
        title: 'Paso a paso',
        content:
          'Para cumplir una meta: define cuánto cuesta, cuánto ahorrarás por semana y en cuánto tiempo.',
        illustration: 'full_plan',
      },
      q(
        'Primer paso para cumplir una meta:',
        'Definir cuánto cuesta',
        'Comprar de una vez',
        'Esperar suerte',
        'No calcular',
        'Sin monto no hay plan posible.'
      ),
      q(
        'Si tu meta es 24 y ahorras 4 por semana, tardas...',
        '6 semanas',
        '4 semanas',
        '10 semanas',
        '2 semanas',
        '24/4 = 6.'
      ),
      q(
        'Si subes tu ahorro semanal, la meta llega...',
        'Más rápido',
        'Más lento',
        'Igual siempre',
        'Nunca',
        'Si guardas más, llegas antes.'
      ),
      q(
        'Si te atrasas una semana, ¿qué haces?',
        'Ajustas y sigues',
        'Cancelas la meta',
        'Gastas todo',
        'Ignoras el problema',
        'Lo importante es seguir, no rendirse.'
      ),
      q(
        'Un buen plan de meta tiene...',
        'Monto, tiempo y ahorro semanal',
        'Solo emoción',
        'Solo deseo',
        'Solo premio',
        'Con esos 3 datos, la meta es clara.'
      ),
    ],
  },
  {
    id: 'lesson_10',
    title: 'Resumen de Ahorro y Metas',
    icon: 'flag-outline',
    description: 'Objetivo: cerrar ahorro y metas con ejercicios simples y prácticos.',
    xpReward: 160,
    cetisReward: 80,
    color: '#C0392B',
    steps: [
      {
        type: 'story',
        title: 'Cierre de sección 2',
        content:
          'Ya sabes ahorrar, definir metas y calcular tiempos. Ahora toca organizar mejor tu dinero.',
        illustration: 'savings_rule',
      },
      q(
        'Si una meta cuesta 60 y ahorras 15 por semana, tardas...',
        '4 semanas',
        '2 semanas',
        '6 semanas',
        '10 semanas',
        '60/15 = 4.'
      ),
      q(
        '¿Qué hábito te acerca más a tu meta?',
        'Ahorrar cada semana',
        'Gastar sin plan',
        'No revisar avance',
        'Cambiar de meta siempre',
        'La constancia es el motor principal.'
      ),
      q(
        'Una meta sin fecha suele ser...',
        'Difícil de cumplir',
        'Más fácil',
        'Automática',
        'Siempre perfecta',
        'Sin fecha es fácil dejarla para después.'
      ),
      q(
        'Si quieres avanzar más rápido en tu meta...',
        'Ahorras un poco más',
        'Esperas suerte',
        'No haces cuentas',
        'Gastas más',
        'Si guardas más, avanzas más rápido.'
      ),
      q(
        'Ahorro + meta + seguimiento =',
        'Un plan que funciona',
        'Compra impulsiva',
        'Riesgo alto',
        'Desorden',
        'Así tienes más control de tu dinero.'
      ),
    ],
  },
  {
    id: 'lesson_11',
    title: '¿Qué es un Presupuesto?',
    icon: 'calculator-outline',
    description: 'Objetivo: entender el presupuesto como un mapa sencillo del dinero.',
    xpReward: 170,
    cetisReward: 85,
    color: '#16A085',
    steps: [
      {
        type: 'story',
        title: 'Tu mapa de dinero',
        content:
          'Un presupuesto es como un mapa: te dice cuánto entra, cuánto guardas y cuánto puedes gastar.',
        illustration: 'budget_map',
      },
      q(
        'Un presupuesto sirve para...',
        'Planear cómo usar tu dinero',
        'Gastar sin pensar',
        'Pedir prestado siempre',
        'No ahorrar',
        'Te ayuda a decidir mejor en qué gastar.'
      ),
      q(
        'Si haces presupuesto, sabes...',
        'En qué puedes gastar y cuánto',
        'Solo cuánto deseas',
        'Nada de tus gastos',
        'Solo tus juguetes',
        'El presupuesto da claridad del dinero disponible.'
      ),
      q(
        'Presupuestar ayuda a...',
        'Evitar gastar de más',
        'Perder control',
        'Gastar impulsivo',
        'Olvidar metas',
        'Planear previene errores de gasto.'
      ),
      q(
        'La frase correcta es...',
        'Sin plan, el dinero se desordena',
        'Planear no sirve',
        'Ahorro es suerte',
        'Gastar todo es mejor',
        'El plan mejora resultados financieros.'
      ),
      q(
        'Presupuesto básico =',
        'Ingresos - ahorro - gastos',
        'Solo gastos',
        'Solo deseos',
        'Nada de números',
        'Es una forma simple de ordenar tu plata.'
      ),
    ],
  },
  {
    id: 'lesson_12',
    title: 'Categorías del Dinero',
    icon: 'albums-outline',
    description: 'Objetivo: dividir el dinero en grupos fáciles: necesidad, deseo y ahorro.',
    xpReward: 180,
    cetisReward: 90,
    color: '#2980B9',
    steps: [
      {
        type: 'story',
        title: 'Tres cajitas',
        content: 'Imagina 3 cajitas: una para necesidades, otra para gustos y otra para ahorro.',
        illustration: 'budget_rule',
      },
      q(
        'Categoría esencial del presupuesto:',
        'Necesidades',
        'Caprichos',
        'Moda',
        'Impulso',
        'Necesidades son la base.'
      ),
      q(
        '¿Qué categoría protege tu futuro?',
        'Ahorro',
        'Deseos',
        'Antojos',
        'Compras rápidas',
        'El ahorro cuida objetivos futuros.'
      ),
      q(
        'Una compra de entretenimiento va en...',
        'Deseos',
        'Necesidades',
        'Salud',
        'Ingreso',
        'No es esencial para vivir.'
      ),
      q(
        'Separar por categorías ayuda a...',
        'Tener más control',
        'Confundirte más',
        'Gastar sin límite',
        'No decidir',
        'Si separas, sabes cuánto va en cada cosa.'
      ),
      q(
        'Si te pasas en una categoría, debes...',
        'Ajustar otra parte del plan',
        'Ignorarlo',
        'Gastar más',
        'Eliminar ahorro primero',
        'Ajustar te ayuda a volver al orden.'
      ),
    ],
  },
  {
    id: 'lesson_13',
    title: 'Regla Básica de Distribución',
    icon: 'pie-chart-outline',
    description: 'Objetivo: repartir el dinero con una regla fácil de recordar.',
    xpReward: 190,
    cetisReward: 95,
    color: '#8E44AD',
    steps: [
      {
        type: 'story',
        title: 'Repartir con regla simple',
        content:
          'Puedes usar una regla básica: la mayor parte a necesidades, una parte a deseos y otra al ahorro.',
        illustration: 'budget_rule',
      },
      q(
        'De cada 10, si ahorras 2, guardas...',
        '20%',
        '2%',
        '50%',
        '80%',
        '2 de 10 equivale a 20%.'
      ),
      q(
        'En una distribución sana, la parte mayor suele ir a...',
        'Necesidades',
        'Deseos',
        'Antojos',
        'Nada',
        'Lo esencial va primero.'
      ),
      q(
        'Si recibes 50 y ahorras 10, te quedan para gastar...',
        '40',
        '50',
        '10',
        '60',
        '50 - 10 = 40.'
      ),
      q(
        'La regla de reparto ayuda a...',
        'No improvisar cada semana',
        'Gastar por impulso',
        'Olvidar metas',
        'No medir nada',
        'Con regla, decides más fácil.'
      ),
      q(
        'Si no te alcanza en deseos, lo mejor es...',
        'Recortar deseos primero',
        'Recortar comida',
        'No ahorrar nunca',
        'Endeudarte siempre',
        'Primero se recorta lo menos importante.'
      ),
    ],
  },
  {
    id: 'lesson_14',
    title: 'Ajustes del Presupuesto',
    icon: 'options-outline',
    description: 'Objetivo: saber ajustar el plan cuando una semana no sale perfecta.',
    xpReward: 200,
    cetisReward: 100,
    color: '#D35400',
    steps: [
      {
        type: 'story',
        title: 'Corregir es normal',
        content: 'Si una semana te pasas, no pasa nada: revisas, ajustas y sigues.',
        illustration: 'risk_check',
      },
      q(
        'Si gastaste de más en una categoría, debes...',
        'Ajustar el resto del plan',
        'Ignorarlo',
        'Gastar más',
        'Cancelar todo',
        'Ajustar evita repetir el desorden.'
      ),
      q(
        'Revisar presupuesto cada semana permite...',
        'Ver errores a tiempo',
        'No saber nada',
        'Gastar igual siempre',
        'Perder metas',
        'Si revisas, corriges antes de que empeore.'
      ),
      q(
        'Un buen ajuste cuida primero...',
        'Necesidades y ahorro',
        'Antojos',
        'Compras impulsivas',
        'Caprichos',
        'Primero cuidas lo más importante.'
      ),
      q(
        'Si tu ingreso baja una semana, lo ideal es...',
        'Reducir deseos temporalmente',
        'Dejar de planear',
        'Gastar más',
        'Ignorar la baja',
        'El ajuste temporal mantiene equilibrio.'
      ),
      q(
        'La mejor actitud con tu plan es...',
        'Flexible y constante',
        'Rígida y sin revisar',
        'Impulsiva',
        'Desordenada',
        'Puedes ajustar, pero sin abandonar el plan.'
      ),
    ],
  },
  {
    id: 'lesson_15',
    title: 'Presupuesto y Meta Juntos',
    icon: 'flag-outline',
    description: 'Objetivo: usar presupuesto, ahorro y metas juntos en la vida diaria.',
    xpReward: 220,
    cetisReward: 110,
    color: '#C0392B',
    steps: [
      {
        type: 'story',
        title: 'Todo conectado',
        content:
          'Si haces presupuesto, ahorras y sigues una meta, tu dinero trabaja mejor para ti.',
        illustration: 'full_plan',
      },
      q(
        'Presupuesto + ahorro + meta sirve para...',
        'Tomar decisiones con rumbo',
        'Gastar al azar',
        'Evitar planear',
        'No medir nada',
        'Así sabes qué hacer con tu dinero.'
      ),
      q(
        'Si tu meta es 80 y ahorras 20 por semana, tardas...',
        '4 semanas',
        '8 semanas',
        '2 semanas',
        '6 semanas',
        '80/20 = 4 semanas.'
      ),
      q(
        'Si quieres mantener tu plan, debes...',
        'Revisarlo cada semana',
        'No volver a verlo',
        'Gastar sin límite',
        'Cambiar meta diario',
        'Revisar seguido te mantiene en orden.'
      ),
      q(
        '¿Qué protege mejor tu futuro?',
        'Ahorrar seguido dentro del plan',
        'Impulsos frecuentes',
        'No registrar gastos',
        'Comprar por moda',
        'Ahorrar seguido te da más tranquilidad.'
      ),
      q(
        'La idea final de la sección 3 es...',
        'Organizar para cumplir',
        'Improvisar siempre',
        'Gastar primero',
        'No usar metas',
        'Organizar dinero acerca a metas reales.'
      ),
    ],
  },
];
