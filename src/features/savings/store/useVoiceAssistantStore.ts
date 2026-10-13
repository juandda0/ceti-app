/**
 * Estado compartido del asistente de voz global (FloatingVoiceButton, montado en
 * el layout de pestañas). Otras pantallas (Movimientos) leen el estado y llaman
 * `start`/`stop` de forma SÍNCRONA dentro de su onPress, para conservar el gesto
 * del usuario que Safari iOS exige al iniciar SpeechRecognition.
 */
import { create } from 'zustand';
import type { VoiceState } from '@features/savings/hooks/useVoiceCapture';

type VoiceAssistantState = {
  voiceState: VoiceState;
  processing: boolean;
  sheetOpen: boolean;
  start: () => void;
  stop: () => void;
  openWriting: () => void;
};

const noop = () => undefined;

export const useVoiceAssistantStore = create<VoiceAssistantState>(() => ({
  voiceState: 'unavailable',
  processing: false,
  sheetOpen: false,
  start: noop,
  stop: noop,
  openWriting: noop,
}));
