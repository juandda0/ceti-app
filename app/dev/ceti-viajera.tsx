import { useState } from 'react';
import { Redirect } from 'expo-router';
import { View, useWindowDimensions } from 'react-native';
import { ESPACIO, FondoEstrellas } from '@features/learning/components/galaxia/espacio';
import CarruselPlanetas from '@features/learning/components/galaxia/CarruselPlanetas';
import { planetaDeMundo } from '@features/learning/data/planetas';

// Herramienta interna: el carrusel de Tu Galaxia con mundos de ejemplo, para ver a Ceti saltar entre
// planetas sin iniciar sesión. En builds de producción la ruta no lleva a ningún sitio.
const MUNDOS = ['world_1', 'world_2', 'world_3', 'world_4', 'world_5'].map((id, i) => ({
  id,
  nombre: `Mundo ${i + 1}`,
  planeta: planetaDeMundo(id, i),
  bloqueado: false,
}));

export default function CetiViajeraRoute() {
  const { width, height } = useWindowDimensions();
  const [activo, setActivo] = useState(0);
  if (!__DEV__) return <Redirect href="/" />;
  const ancho = Math.min(width, 680);
  return (
    <View style={{ flex: 1, backgroundColor: ESPACIO.fondo, alignItems: 'center', justifyContent: 'center' }}>
      <FondoEstrellas ancho={width} alto={height} />
      <CarruselPlanetas
        mundos={MUNDOS}
        activo={activo}
        onCambio={setActivo}
        onTocar={() => {}}
        ancho={ancho}
        alto={Math.round(Math.min(320, Math.max(240, height * 0.36)))}
      />
    </View>
  );
}
