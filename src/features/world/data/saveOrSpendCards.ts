import type { IoniconsName } from '@shared/types/ionicons';

export type SmartChoice = 'save' | 'spend';

export interface SaveOrSpendCard {
  id: string;
  icon: IoniconsName;
  iconColor: string;
  title: string;
  context: string;
  smartChoice: SmartChoice;
  explanation: string;
}

export const SAVE_OR_SPEND_CARDS: SaveOrSpendCard[] = [
  {
    id: 'c01',
    icon: 'ice-cream-outline',
    iconColor: '#FF88AA',
    title: 'Helado con amigos',
    context: 'Tienes 200 Cetis. Tus amigos te invitan a tomar helado. Cuesta 30 Cetis.',
    smartChoice: 'spend',
    explanation: 'Compartir momentos con amigos es valioso. 30 de 200 es poco y te quedan muchos.',
  },
  {
    id: 'c02',
    icon: 'pricetag-outline',
    iconColor: '#FFD966',
    title: 'Oferta por tiempo limitado',
    context: 'Hay una oferta de un juguete que no necesitas. Cuesta 500 Cetis y solo tienes 520.',
    smartChoice: 'save',
    explanation:
      'Gastar casi todo en algo que no necesitas no es sabio. Es mejor guardar y esperar.',
  },
  {
    id: 'c03',
    icon: 'book-outline',
    iconColor: '#6BBFFF',
    title: 'Libro para aprender',
    context: 'Encuentras un libro sobre inversiones para niños. Cuesta 80 Cetis y tienes 500.',
    smartChoice: 'spend',
    explanation:
      'Invertir en aprendizaje siempre vale la pena. El conocimiento es el mejor activo.',
  },
  {
    id: 'c04',
    icon: 'gift-outline',
    iconColor: '#FF6699',
    title: 'Regalo para mamá',
    context: 'Es el cumpleaños de mamá. Un detalle bonito cuesta 100 Cetis. Tienes 300.',
    smartChoice: 'spend',
    explanation: 'Dar a personas que amamos tiene un valor que no se puede medir en Cetis.',
  },
  {
    id: 'c05',
    icon: 'game-controller-outline',
    iconColor: '#AA66FF',
    title: 'Videojuego nuevo',
    context:
      'Sale un juego nuevo. Cuesta 800 Cetis. Solo tienes 820 y necesitas el resto para otra cosa.',
    smartChoice: 'save',
    explanation: 'Gastar casi todo cuando tienes una necesidad pendiente no es buen plan.',
  },
  {
    id: 'c06',
    icon: 'restaurant-outline',
    iconColor: '#FF9900',
    title: 'Almuerzo especial',
    context: 'Tu comida favorita cuesta 50 Cetis hoy. Tienes 600 Cetis ahorrados.',
    smartChoice: 'spend',
    explanation:
      'Disfrutar de lo que te gusta de vez en cuando, cuando tienes suficiente, está bien.',
  },
  {
    id: 'c07',
    icon: 'school-outline',
    iconColor: '#58C88C',
    title: 'Curso de dibujo',
    context: 'Hay un taller de arte que te gusta mucho. Cuesta 150 Cetis y tienes 400.',
    smartChoice: 'spend',
    explanation:
      'Invertir en habilidades y hobbies enriquece tu vida y puede ser útil en el futuro.',
  },
  {
    id: 'c08',
    icon: 'phone-portrait-outline',
    iconColor: '#5B9EF5',
    title: 'Funda de teléfono de moda',
    context: 'Está de moda una funda nueva. Cuesta 200 Cetis pero la tuya funciona perfectamente.',
    smartChoice: 'save',
    explanation:
      'Comprar algo solo porque está de moda, cuando lo que tienes funciona bien, es malgastar.',
  },
  {
    id: 'c09',
    icon: 'medkit-outline',
    iconColor: '#F06676',
    title: 'Medicina necesaria',
    context: 'Necesitas un medicamento que cuesta 120 Cetis. Tienes 150 ahorrados.',
    smartChoice: 'spend',
    explanation:
      'La salud es la prioridad. Nunca escatimes en lo que es necesario para tu bienestar.',
  },
  {
    id: 'c10',
    icon: 'shirt-outline',
    iconColor: '#FFAE66',
    title: 'Ropa que ya tienes',
    context: 'Ves una camiseta linda, pero ya tienes 10 muy parecidas. Cuesta 180 Cetis.',
    smartChoice: 'save',
    explanation:
      'Comprar lo que no necesitas porque te gusta en el momento es impulsivo. Ahorra mejor.',
  },
  {
    id: 'c11',
    icon: 'bicycle-outline',
    iconColor: '#58C88C',
    title: 'Arreglar tu bicicleta',
    context: 'Tu bici necesita repuestos. Cuesta 90 Cetis y la usas todos los días. Tienes 300.',
    smartChoice: 'spend',
    explanation:
      'Mantener lo que ya tienes en buen estado es inteligente. Es una inversión en durabilidad.',
  },
  {
    id: 'c12',
    icon: 'pizza-outline',
    iconColor: '#FF9900',
    title: 'Pizza con el equipo',
    context:
      'Ganan el partido y el equipo quiere celebrar con pizza. Tu parte: 40 Cetis. Tienes 180.',
    smartChoice: 'spend',
    explanation:
      'Celebrar logros con otros es parte de la vida. El gasto moderado en momentos especiales vale.',
  },
  {
    id: 'c13',
    icon: 'cash-outline',
    iconColor: '#F7C95F',
    title: 'Prestar Cetis a un amigo',
    context: 'Tu amigo te pide 200 Cetis prestados. No tiene claro cuándo te los devuelve.',
    smartChoice: 'save',
    explanation:
      'Prestar dinero sin un plan claro de devolución puede generar problemas. Sé cuidadoso.',
  },
  {
    id: 'c14',
    icon: 'trophy-outline',
    iconColor: '#FFD700',
    title: 'Participar en concurso',
    context:
      'Hay un concurso donde el costo de inscripción es 30 Cetis, y podrías ganar 300. Tienes 200.',
    smartChoice: 'spend',
    explanation:
      'Invertir en una oportunidad con buen potencial de retorno puede ser una decisión inteligente.',
  },
  {
    id: 'c15',
    icon: 'save-outline',
    iconColor: '#5FCFC8',
    title: 'Meta de ahorro',
    context: 'Tu meta es ahorrar 1000 Cetis. Ya tienes 950 y ves algo que quieres por 100 Cetis.',
    smartChoice: 'save',
    explanation: 'Estás a 50 de tu meta. Vale la pena resistir un poco más para lograrla completa.',
  },
];

export const SAVE_OR_SPEND_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 horas

/** Selecciona 5 cartas al azar sin repetir */
export function drawCards(count: number = 5): SaveOrSpendCard[] {
  const shuffled = [...SAVE_OR_SPEND_CARDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
