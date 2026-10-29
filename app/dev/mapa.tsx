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
// (/dev/mapa?hechas=2&mundo=world_3; mundo=cw_x&pos=1 para los planetas de reserva). Siembra
// una racha de 12 días, 1 escudo y Cetis de ejemplo; racha, escudos, cetis, meta y hoy (lecciones
// de hoy) los cambian, p. ej. para las capturas del portafolio.
const UID_DEV = 'dev-mapa';

export default function MapaDevRoute() {
  const { hechas, mundo, pos, nombre, racha, escudos, cetis, meta, hoy: hechasHoy } = useLocalSearchParams<{
    hechas?: string;
    mundo?: string;
    pos?: string;
    nombre?: string;
    racha?: string;
    escudos?: string;
    cetis?: string;
    meta?: 'crucero' | 'orbita' | 'hiper';
    hoy?: string;
  }>();
  const [listo, setListo] = useState(false);
  useEffect(() => {
    if (!__DEV__) return;
    useUserStore.setState({ id: UID_DEV });
    const now = Date.now();
    const hoy = dayKey(now);
    // Con racha=N la racha incluye hoy (ya practicó); sin ella, 12 días hasta ayer.
    const dias = racha
      ? Array.from({ length: Number(racha) }, (_, i) => sumarDias(hoy, -Number(racha) + 1 + i))
      : Array.from({ length: 12 }, (_, i) => sumarDias(hoy, -12 + i));
    const base = estadoInicial(now, dias);
    useOrbitaStore.getState().reemplazar(UID_DEV, {
      ...base,
      racha: { ...base.racha, escudos: Number(escudos ?? 1), mejor: dias.length },
      progreso: { ...base.progreso, leccionesPorDia: { [hoy]: Number(hechasHoy ?? 2) } },
      boveda: { ...base.boveda, bolsillo: Number(cetis ?? 1240), boveda: 500 },
      ajustes: { ...base.ajustes, meta: meta ?? 'orbita' },
    });
    setListo(true);
    // Se siembra una sola vez al entrar (los parámetros no cambian dentro de la ruta).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!__DEV__) return <Redirect href="/" />;
  if (!listo) return null;
  return (
    <MapaPlaneta
      nombre={nombre ?? 'Planeta Origen'}
      planeta={planetaDeMundo(mundo ?? 'world_1', Number(pos ?? 0))}
      nodos={nodosMapa(4, Number(hechas ?? 1), false)}
      totalLecciones={4}
      onNodo={() => {}}
      onVolver={() => {}}
      onGuia={() => {}}
    />
  );
}
