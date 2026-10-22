import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import LeccionScreen, { type ResultadoLeccion } from '@features/learning/screens/LeccionScreen';
import FinLeccion from '@features/orbita/components/FinLeccion';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import type { RecompensaPractica } from '@features/orbita/domain/orbita';
import { useUserStore } from '@features/auth/store/useUserStore';
import type { QuizItem } from '@features/learning/data/quiz.types';

// Herramienta interna: una lección (o el jefe con vidas: ?modo=jefe) sin iniciar sesión, con tres
// preguntas de ejemplo y el cierre con recompensas. En producción la ruta no lleva a ningún sitio.
const UID_DEV = 'dev-quiz-vidas';
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
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  const tipo = modo === 'jefe' ? 'jefe' : 'leccion';
  const [ronda, setRonda] = useState(0);
  const [fin, setFin] = useState<{ r: RecompensaPractica; res: ResultadoLeccion } | null>(null);
  useEffect(() => {
    if (!__DEV__) return;
    if (!useUserStore.getState().id) useUserStore.setState({ id: UID_DEV });
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  const uid = useUserStore.getState().id || UID_DEV;
  if (fin) {
    return (
      <FinLeccion
        recompensa={fin.r}
        modo={tipo}
        titulo="Planeta Origen"
        color="#FF9F45"
        aciertos={fin.res.acertadasALaPrimera}
        total={fin.res.total}
        onContinuar={() => {
          setFin(null);
          setRonda((n) => n + 1);
        }}
      />
    );
  }
  return (
    <LeccionScreen
      key={ronda}
      items={PREGUNTAS}
      modo={tipo}
      titulo={tipo === 'jefe' ? 'Jefe de Planeta Origen' : 'Lección 1 de 4'}
      color="#FF8A1F"
      mundo="dev"
      onSalir={() => setRonda((n) => n + 1)}
      onTerminar={(res) => {
        const r = useOrbitaStore.getState().completar(uid, {
          tipo,
          worldId: 'dev',
          nivel: 0,
          xpRespuestas: res.xpRespuestas,
          perfecta: res.perfecta,
        });
        setFin({ r, res });
      }}
    />
  );
}
