import { useEffect, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import { useAuthStore } from '@features/auth/store/useAuthStore';

// Herramienta interna: abre el panel docente con datos de ejemplo, sin cuenta.
// En builds de producción la ruta no lleva a ningún sitio.
export default function ProfeDemoRoute() {
  const authReady = useAuthStore((s) => s.authReady);
  const [lista, setLista] = useState(false);

  useEffect(() => {
    if (!__DEV__ || !authReady) return;
    void import('@features/dashboard/dev/demoProfe').then((m) => {
      m.activarDemoProfe();
      setLista(true);
    });
  }, [authReady]);

  if (!__DEV__) return <Redirect href="/" />;
  if (!lista) return null;
  return <Redirect href={'/(staff)' as Href} />;
}
