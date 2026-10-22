import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import BovedaScreen from '@features/orbita/screens/BovedaScreen';
import { useUidJuego } from '@features/orbita/hooks/useOrbita';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';

/** La Bóveda liquida lo pendiente (interés de los lunes, CDT vencidos) cada vez que se abre. */
export default function BovedaRoute() {
  const uid = useUidJuego();
  useFocusEffect(
    useCallback(() => {
      if (uid) useOrbitaStore.getState().abrir(uid);
    }, [uid])
  );
  return <BovedaScreen />;
}
