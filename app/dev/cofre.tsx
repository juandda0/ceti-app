import { useState } from 'react';
import { Redirect } from 'expo-router';
import AbrirCofre from '@features/orbita/components/cofre/AbrirCofre';

// Herramienta interna: la entrega del cofre de una zona sin jugar el nivel (/dev/cofre).
// "Reclamar" lo vuelve a cerrar para repetir la animación.
export default function CofreDevRoute() {
  const [vuelta, setVuelta] = useState(0);
  if (!__DEV__) return <Redirect href="/" />;
  return (
    <AbrirCofre
      key={vuelta}
      titulo="¡Ganaste un cofre!"
      subtitulo="Cofre de la zona 3 · Planeta Origen"
      color="#FF9F45"
      cetis={15}
      onReclamar={() => setVuelta((v) => v + 1)}
    />
  );
}
