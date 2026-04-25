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

export const LESSONS: Lesson[] = [
  {
    id: 'lesson_1',
    title: '¿Qué es el dinero?',
    icon: 'cash-outline',
    description: 'Aprende para qué sirve el dinero y por qué es importante',
    xpReward: 50,
    cetisReward: 20,
    color: '#3498DB',
    steps: [
      {
        type: 'story',
        title: 'El trueque',
        content: 'Hace mucho tiempo, las personas intercambiaban cosas directamente. ¿Quieres un pollo? Dame 3 manzanas. Pero era muy difícil porque no siempre teníamos lo que el otro quería...',
        illustration: 'barter',
      },
      {
        type: 'story',
        title: 'Nació el dinero',
        content: 'El dinero fue inventado para hacer los intercambios más fáciles. Con dinero puedes comprar cualquier cosa. Es como un lenguaje que todos entienden.',
        illustration: 'money_birth',
      },
      {
        type: 'quiz',
        question: '¿Para qué sirve el dinero principalmente?',
        options: [
          { text: 'Para jugar', correct: false },
          { text: 'Para intercambiar por cosas que necesitamos', correct: true },
          { text: 'Para guardarlo debajo del colchón', correct: false },
          { text: 'Para hacer papiroflexia', correct: false },
        ],
        explanation: 'El dinero nos permite intercambiar trabajo y productos de forma justa.',
      },
      {
        type: 'quiz',
        question: '¿Qué pasaba antes de que existiera el dinero?',
        options: [
          { text: 'La gente no compraba nada', correct: false },
          { text: 'Todo era gratis', correct: false },
          { text: 'Las personas intercambiaban objetos directamente', correct: true },
          { text: 'Los robots hacían todo', correct: false },
        ],
        explanation: 'Se llamaba trueque, y era complicado porque no siempre coincidían los intercambios.',
      },
    ],
  },
  {
    id: 'lesson_2',
    title: 'Necesidades vs. Deseos',
    icon: 'bulb-outline',
    description: 'Aprende la diferencia entre lo que necesitas y lo que quieres',
    xpReward: 60,
    cetisReward: 25,
    color: '#9B59B6',
    steps: [
      {
        type: 'story',
        title: '¿Necesidad o deseo?',
        content: 'Imagina que tienes 10 Cetis. Tienes hambre y también quieres un juguete nuevo. ¿Qué compras primero? La comida es una necesidad — sin ella no puedes vivir. El juguete es un deseo — lo quieres, pero no lo necesitas para vivir.',
        illustration: 'needs_vs_wants',
      },
      {
        type: 'interactive',
        title: 'Clasifica estos ejemplos',
        instruction: 'Arrastra cada item a necesidad o deseo',
        items: [
          { text: 'Comida', category: 'need' },
          { text: 'Videojuego', category: 'want' },
          { text: 'Casa', category: 'need' },
          { text: 'Tenis de moda', category: 'want' },
          { text: 'Medicina', category: 'need' },
          { text: 'Helado', category: 'want' },
        ],
      },
      {
        type: 'quiz',
        question: '¿Cuál de estos es una necesidad?',
        options: [
          { text: 'Un juguete nuevo', correct: false },
          { text: 'Agua limpia', correct: true },
          { text: 'El último celular', correct: false },
          { text: 'Chocolate', correct: false },
        ],
        explanation: 'El agua es esencial para vivir. Sin agua no podemos sobrevivir más de unos días.',
      },
    ],
  },
  {
    id: 'lesson_3',
    title: 'El Poder del Ahorro',
    icon: 'archive-outline',
    description: 'Descubre cómo el ahorro puede cumplir tus sueños',
    xpReward: 70,
    cetisReward: 30,
    color: '#E67E22',
    steps: [
      {
        type: 'story',
        title: 'El hormiguero sabio',
        content: 'Las hormigas ahorran comida en el verano para el invierno. No gastan todo lo que encuentran de una vez. Los humanos podemos hacer lo mismo con el dinero.',
        illustration: 'ant_savings',
      },
      {
        type: 'story',
        title: 'La regla mágica',
        content: 'Aquí hay un secreto: cuando recibas dinero, guarda una parte antes de gastar. ¿Recibiste 10 Cetis? Guarda 3. Siempre. Esto se llama "págate a ti primero".',
        illustration: 'savings_rule',
      },
      {
        type: 'simulation',
        title: 'Simula tu ahorro',
        instruction: 'Si ahorras 5 Cetis cada semana, ¿cuánto tendrás en 4 semanas?',
        answer: 20,
        hint: 'Suma 5 cuatro veces.',
      },
      {
        type: 'quiz',
        question: '¿Cuándo debes ahorrar?',
        options: [
          { text: 'Solo cuando sobra dinero', correct: false },
          { text: 'Nunca, el dinero es para gastarlo', correct: false },
          { text: 'Primero que nada, antes de gastar', correct: true },
          { text: 'Solo si tus papás te dicen', correct: false },
        ],
        explanation: '"Págate primero a ti" significa ahorrar antes de gastar en cualquier cosa.',
      },
    ],
  },
  {
    id: 'lesson_4',
    title: 'Ingresos y Gastos',
    icon: 'bar-chart-outline',
    description: 'Entiende de dónde viene el dinero y a dónde va',
    xpReward: 80,
    cetisReward: 35,
    color: '#1ABC9C',
    steps: [
      {
        type: 'story',
        title: '¿De dónde viene el dinero?',
        content: 'El dinero que entra a tu bolsillo se llama ingreso. Las personas adultas trabajan y reciben un salario. Tú puedes ganar Cetis completando lecciones o ayudando en casa.',
        illustration: 'income',
      },
      {
        type: 'story',
        title: '¿A dónde va el dinero?',
        content: 'El dinero que sale de tu bolsillo se llama gasto. Cuando compras algo, gastas. El secreto es que tus gastos nunca sean más que tus ingresos.',
        illustration: 'expenses',
      },
      {
        type: 'quiz',
        question: 'Si ganas 20 Cetis y gastas 25, ¿qué pasa?',
        options: [
          { text: 'Tienes 5 Cetis de sobra', correct: false },
          { text: 'Debes 5 Cetis — gastaste más de lo que tenías', correct: true },
          { text: 'Todo está bien', correct: false },
          { text: 'Ganas más Cetis', correct: false },
        ],
        explanation: 'Cuando gastas más de lo que ganas, quedas en deuda. Eso no es bueno para tu ciudad.',
      },
    ],
  },
  {
    id: 'lesson_5',
    title: 'Metas Financieras',
    icon: 'rocket-outline',
    description: 'Aprende a soñar grande y planear para lograrlo',
    xpReward: 100,
    cetisReward: 50,
    color: '#E74C3C',
    steps: [
      {
        type: 'story',
        title: '¿Qué es una meta?',
        content: 'Una meta es algo que quieres lograr en el futuro. Para lograrla, necesitas un plan: ¿cuánto cuesta? ¿cuánto puedo ahorrar por semana? ¿en cuánto tiempo la tendré?',
        illustration: 'goal_setting',
      },
      {
        type: 'goal_creator',
        title: 'Crea tu primera meta',
        instruction: 'Escribe qué quieres lograr y cuántos Cetis necesitas',
        fields: ['¿Qué quieres?', '¿Cuántos Cetis cuesta?', '¿Cuánto puedes ahorrar por semana?'],
      },
      {
        type: 'quiz',
        question: 'Quieres algo que cuesta 40 Cetis. Ahorras 10 Cetis por semana. ¿En cuántas semanas lo tienes?',
        options: [
          { text: '2 semanas', correct: false },
          { text: '4 semanas', correct: true },
          { text: '40 semanas', correct: false },
          { text: '10 semanas', correct: false },
        ],
        explanation: 'Planear hace que tus sueños se vuelvan realidad.',
      },
    ],
  },
];
