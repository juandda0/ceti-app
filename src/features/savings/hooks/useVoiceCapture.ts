/**
 * Captura de voz vía Web Speech API del navegador (RQ-ES10 CA1). El audio no
 * se graba ni sube a servidores propios: solo entregamos el transcript. Con
 * `interimResults` exponemos el texto EN VIVO mientras la persona habla; con
 * `continuous` seguimos capturando hasta que toca "Listo" (stop). En nativo o
 * navegadores sin SpeechRecognition (Firefox) el estado queda 'unavailable'.
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
    recognition.continuous = true;
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
      }
      // 'no-speech'/'aborted' se resuelven en onend sin clasificar.
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
    recognition.start();
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
