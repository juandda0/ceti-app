/**
 * Captura de voz vía Web Speech API del navegador (RQ-ES10 CA1). El audio no
 * se graba ni sube a servidores propios: solo entregamos el transcript. Con
 * `interimResults` exponemos el texto EN VIVO mientras la persona habla, y con
 * `continuous:false` la captura se detiene sola al hacer silencio y clasifica
 * automáticamente (el botón "Listo" solo adelanta ese fin). En nativo o
 * navegadores sin SpeechRecognition (Firefox) el estado queda 'unavailable'.
 */
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type VoiceState = 'unavailable' | 'idle' | 'listening' | 'denied';
export type VoiceCaptureError = 'no-speech' | 'audio-capture' | 'network' | 'start-failed';

/** iOS en modo PWA (pantalla de inicio): SpeechRecognition existe pero no funciona. */
function isIosStandalone(): boolean {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  const ios =
    /iPad|iPhone|iPod/.test(nav.userAgent ?? '') ||
    (nav.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1);
  if (!ios) return false;
  if (nav.standalone === true) return true;
  try {
    return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
  } catch {
    return false;
  }
}

function getRecognitionCtor(): (new () => WebSpeechRecognition) | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  if (isIosStandalone()) return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function useVoiceCapture(
  onTranscript: (texto: string) => void,
  onError?: (error: VoiceCaptureError) => void
): {
  state: VoiceState;
  transcript: string;
  start: () => void;
  stop: () => void;
  cancel: () => void;
} {
  const [state, setState] = useState<VoiceState>(() =>
    getRecognitionCtor() ? 'idle' : 'unavailable'
  );
  const [transcript, setTranscript] = useState('');
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const finalRef = useRef('');
  const fullTextRef = useRef('');
  const abortedRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    finalRef.current = '';
    fullTextRef.current = '';
    abortedRef.current = false;
    setTranscript('');

    const recognition = new Ctor();
    recognition.lang = 'es-CO';
    // false = una sola frase: se detiene sola al hacer silencio y dispara onend
    // (clasificación automática), como funcionaba antes de la transcripción en vivo.
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) finalRef.current += chunk;
        else interim += chunk;
      }
      const full = `${finalRef.current}${interim}`.trim();
      fullTextRef.current = full;
      setTranscript(full);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        abortedRef.current = true;
        setState('denied');
        return;
      }
      if (
        event.error === 'no-speech' ||
        event.error === 'audio-capture' ||
        event.error === 'network'
      ) {
        // Sin texto útil: avisamos y no clasificamos (salvo que ya haya transcript).
        if (!fullTextRef.current.trim()) {
          abortedRef.current = true;
          onErrorRef.current?.(event.error);
        }
      }
      // 'aborted' se resuelve en onend sin clasificar.
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      const text = fullTextRef.current.trim();
      setState((s) => (s === 'denied' ? s : 'idle'));
      // Solo clasificamos si la persona terminó normalmente (no canceló) y dijo algo.
      if (!abortedRef.current && text) onTranscriptRef.current(text);
    };

    recognitionRef.current = recognition;
    setState('listening');
    try {
      // Debe llamarse síncrono dentro del gesto del usuario (Safari iOS).
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setState('idle');
      onErrorRef.current?.('start-failed');
    }
  };

  // "Listo": finaliza y dispara la clasificación con lo dicho.
  const stop = () => recognitionRef.current?.stop();

  // "Cancelar": aborta sin clasificar ni conservar el transcript.
  const cancel = () => {
    abortedRef.current = true;
    setTranscript('');
    recognitionRef.current?.abort();
  };

  return { state, transcript, start, stop, cancel };
}
