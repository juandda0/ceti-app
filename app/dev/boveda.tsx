import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import BovedaScreen from '@features/orbita/screens/BovedaScreen';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { estadoInicial, type EstadoOrbita } from '@features/orbita/domain/orbita';
import { dayKey, lunesDe, sumarDias } from '@features/orbita/domain/tiempo';

// Herramienta interna: la Bóveda sin iniciar sesión, con un uid propio y un estado
// de ejemplo (bolsillo, Bóveda, un CDT a mitad de camino y un escudo). Se vuelve a
// sembrar cada vez que se abre. En producción la ruta no lleva a ningún sitio.
const UID_DEV = 'dev-boveda';

function ejemplo(now: number): EstadoOrbita {
  const hoy = dayKey(now);
  const lunes = lunesDe(hoy);
  const base = estadoInicial(now);
  const inicio = sumarDias(hoy, -19);
  return {
    ...base,
    racha: { ...base.racha, escudos: 1 },
    boveda: {
      bolsillo: 340,
      boveda: 1240,
      cdts: [{ id: 'cdt_dev', monto: 500, semanas: 4, inicio, vence: sumarDias(inicio, 28) }],
      ultimoLunes: lunes,
      ultimoPago: { lunes, monto: 36 },
      interesTotal: 210,
    },
  };
}

export default function BovedaDevRoute() {
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!__DEV__) return;
    useOrbitaStore.getState().reemplazar(UID_DEV, ejemplo(Date.now()));
    setListo(true);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  return listo ? <BovedaScreen uid={UID_DEV} /> : null;
}
