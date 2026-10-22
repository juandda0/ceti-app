/**
 * Animación de tipo C: una entrada que se reproduce una vez y, al terminar, un reposo en loop (dos fichas del
 * catálogo cuyo empalme coincide: último fotograma de la entrada = primero del reposo). El reposo se monta
 * desde el inicio, quieto y oculto, para que el cambio no parpadee mientras carga. Con "reducir movimiento"
 * se salta la entrada y muestra el reposo quieto.
 */
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import type LottieView from 'lottie-react-native';
import { useReducedMotion } from 'react-native-reanimated';
import CetiAnimation from './CetiAnimation';
import type { AnimationId } from './catalog';

export default function CetiEntradaReposo({
  entrada,
  reposo,
  size,
}: {
  entrada: AnimationId;
  reposo: AnimationId;
  size: number;
}) {
  const reducir = useReducedMotion();
  const [enReposo, setEnReposo] = useState(reducir);
  const reposoRef = useRef<LottieView>(null);

  const alTerminar = useCallback(() => {
    if (enReposo) return;
    setEnReposo(true);
    reposoRef.current?.play();
  }, [enReposo]);

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute', opacity: enReposo ? 1 : 0 }}>
        <CetiAnimation ref={reposoRef} id={reposo} size={size} autoPlay={false} />
      </View>
      {enReposo ? null : <CetiAnimation id={entrada} size={size} onFinish={alTerminar} />}
    </View>
  );
}
