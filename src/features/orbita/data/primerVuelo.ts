/**
 * Primer vuelo del onboarding: tres preguntas muy fáciles de plata, una de cada
 * tipo, para que la primera victoria llegue en menos de 90 segundos. Cada una
 * explica el porqué, también cuando se falla.
 */
import type { QuizItem } from '@features/learning/data/quiz.types';

export const PRIMER_VUELO: QuizItem[] = [
  {
    id: 'primer_vuelo_mc',
    tipo: 'multiple_choice',
    enunciado: '¿Qué es ahorrar?',
    competencia: 'ahorro',
    dificultad: 1,
    opciones: [
      'Guardar una parte de tu plata para después',
      'Gastarte todo apenas te llega',
      'Pedirle prestado a un amigo',
    ],
    correctIndex: 0,
    explicacion:
      'Ahorrar es separar una parte hoy para algo que quieres mañana. Pequeño, pero poderoso.',
  },
  {
    id: 'primer_vuelo_vf',
    tipo: 'true_false',
    enunciado: 'Si guardas $5.000 cada semana, en 4 semanas tienes $20.000.',
    competencia: 'ahorro',
    dificultad: 1,
    respuesta: true,
    explicacion: '$5.000 × 4 semanas = $20.000. Así, de a poquito, se arma un ahorro.',
  },
  {
    id: 'primer_vuelo_ord',
    tipo: 'ordenar',
    enunciado: 'Ordena de lo más barato a lo más caro.',
    competencia: 'presupuesto',
    dificultad: 1,
    elementos: ['Una moto ($8.000.000)', 'Un chicle ($500)', 'Unos tenis ($200.000)'],
    ordenCanonico: [1, 2, 0],
    explicacion:
      'Primero el chicle, luego los tenis y al final la moto. Comparar precios es tu primer superpoder.',
  },
];
