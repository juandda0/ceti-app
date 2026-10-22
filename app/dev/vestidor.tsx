import { Redirect } from 'expo-router';
import VestidorScreen from '@features/avatar/screens/VestidorScreen';

// Herramienta interna: el vestidor del avatar sin iniciar sesión. En builds de
// producción la ruta no lleva a ningún sitio.
export default function VestidorDevRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <VestidorScreen />;
}
