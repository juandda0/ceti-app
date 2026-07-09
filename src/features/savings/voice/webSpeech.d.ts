/**
 * Declaración ambiente mínima de la Web Speech API (RQ-ES10 CA1). TS strict no
 * la trae en el lib DOM que usa RN-web. El STT corre 100% en el navegador; el
 * audio jamás se graba ni se transmite a servidores propios.
 */
interface WebSpeechRecognitionResult {
  readonly 0: { readonly transcript: string };
  readonly isFinal: boolean;
}

interface WebSpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: ArrayLike<WebSpeechRecognitionResult>;
}

interface WebSpeechRecognitionErrorEvent {
  readonly error: string;
}

interface WebSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface Window {
  SpeechRecognition?: new () => WebSpeechRecognition;
  webkitSpeechRecognition?: new () => WebSpeechRecognition;
}
