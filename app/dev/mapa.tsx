import { useEffect, useState } from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';
import MapaPlaneta from '@features/learning/components/galaxia/MapaPlaneta';
import { planetaDeMundo } from '@features/learning/data/planetas';
import { nodosMapa } from '@features/orbita/domain/niveles';
import { useUserStore } from '@features/auth/store/useUserStore';
import { useOrbitaStore } from '@features/orbita/store/useOrbitaStore';
import { estadoInicial } from '@features/orbita/domain/orbita';
import { dayKey, sumarDias } from '@features/orbita/domain/tiempo';

// Herramienta interna: el mapa de un planeta y el Puente de mando sin iniciar sesión
// (/dev/mapa?hechas=2). Siembra una racha de 12 días, 1 escudo y Cetis de ejemplo.
const UID_DEV = 'dev-mapa';

export default function MapaDevRoute() {
  const { hechas } = useLocalSearchParams<{ hechas?: string }>();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!__DEV__) return;
    useUserStore.setState({ id: UID_DEV });
    const now = Date.now();
    const hoy = dayKey(now);
    const base = estadoInicial(
      now,
      Array.from({ length: 12 }, (_, i) => sumarDias(hoy, -12 + i))
    );
    useOrbitaStore.getState().reemplazar(UID_DEV, {
      ...base,
      racha: { ...base.racha, escudos: 1, mejor: 12 },
      progreso: { ...base.progreso, leccionesPorDia: { [hoy]: 2 } },
      boveda: { ...base.boveda, bolsillo: 1240, boveda: 500 },
      ajustes: { ...base.ajustes, meta: 'orbita' },
    });
    setListo(true);
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  if (!listo) return null;
  return (
    <MapaPlaneta
      nombre="Planeta Origen"
      planeta={planetaDeMundo('world_1', 0)}
      nodos={nodosMapa(4, Number(hechas ?? 1), false)}
      totalLecciones={4}
      onNodo={() => {}}
      onVolver={() => {}}
      onGuia={() => {}}
    />
  );
}
