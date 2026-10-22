import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import WorldQuizScreen from '@features/learning/screens/WorldQuizScreen';
import { useQuestionBankStore } from '@features/learning/store/useQuestionBankStore';
import { useUserStore } from '@features/auth/store/useUserStore';
import type { QuizItem } from '@features/learning/data/quiz.types';

// Herramienta interna: el quiz con vidas sin iniciar sesión, con tres preguntas de ejemplo
// (/dev/quiz-vidas?worldId=world_1). En builds de producción la ruta no lleva a ningún sitio.
const PREGUNTAS: QuizItem[] = [
  {
    id: 'dev-mc',
    tipo: 'multiple_choice',
    enunciado: '¿Qué es un presupuesto?',
    competencia: 'presupuesto',
    dificultad: 1,
    opciones: ['Un plan de ingresos y gastos', 'Un préstamo del banco', 'Un tipo de impuesto'],
    correctIndex: 0,
    explicacion: 'Un presupuesto planea en qué se va el dinero antes de gastarlo.',
  },
  {
    id: 'dev-vf',
    tipo: 'true_false',
    enunciado: 'Ahorrar es guardar una parte de lo que recibes.',
    competencia: 'ahorro',
    dificultad: 1,
    respuesta: true,
    explicacion: 'Ahorrar es separar una parte del dinero para después.',
  },
  {
    id: 'dev-ord',
    tipo: 'ordenar',
    enunciado: 'Ordena los pasos para ahorrar para una meta.',
    competencia: 'ahorro',
    dificultad: 1,
    elementos: ['Ahorrar cada semana', 'Elegir la meta', 'Calcular cuánto cuesta'],
    ordenCanonico: [1, 2, 0],
    explicacion: 'Primero la meta, luego su costo y después el ahorro constante.',
  },
];

export default function QuizVidasRoute() {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!__DEV__) return;
    useQuestionBankStore.setState((s) => ({
      questionsByWorld: { ...s.questionsByWorld, world_1: PREGUNTAS },
      fetchStatus: { ...s.fetchStatus, world_1: 'success' },
      // Sin sesión no hay banco remoto: que la pantalla use las preguntas de ejemplo.
      fetchWorldQuestions: async () => {},
    }));
    if (!useUserStore.getState().id) useUserStore.setState({ id: 'dev-quiz-vidas' });
    setListo(true);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return listo ? <WorldQuizScreen /> : null;
}
