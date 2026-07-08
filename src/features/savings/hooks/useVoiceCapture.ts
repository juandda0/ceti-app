/**
 * Captura de voz vía Web Speech API del navegador (RQ-ES10 CA1). El audio no
 * se graba ni sube a servidores propios: solo entregamos el transcript. En
 * nativo o navegadores sin SpeechRecognition (Firefox) el estado queda
 * 'unavailable' (CA9 — riesgo aceptado, sin formulario alternativo).
 */
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type VoiceState = 'unavailable' | 'idle' | 'listening' | 'denied';

function getRecognitionCtor(): (new () => WebSpeechRecognition) | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition;
}

export function useVoiceCapture(onTranscript: (texto: string) => void): {
  state: VoiceState;
  start: () => void;
  stop: () => void;
} {
  const [state, setState] = useState<VoiceState>(() =>
    getRecognitionCtor() ? 'idle' : 'unavailable'
  );
  const recognitionRef = useRef<WebSpeechRecognition | null>(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    return () => recognitionRef.current?.abort();
  }, []);

  const start = () => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognitionRef.current) return;

    const recognition = new Ctor();
    recognition.lang = 'es-CO';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? '';
      if (transcript) onTranscriptRef.current(transcript);
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      // 'no-speech'/'aborted' vuelven a idle vía onend; solo el permiso es terminal.
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setState('denied');
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setState((s) => (s === 'denied' ? s : 'idle'));
    };

    recognitionRef.current = recognition;
    setState('listening');
    recognition.start();
  };

  const stop = () => {
    recognitionRef.current?.stop();
  };

  return { state, start, stop };
}
