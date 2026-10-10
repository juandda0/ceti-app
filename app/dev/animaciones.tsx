import { Redirect } from 'expo-router';
import AnimationLabScreen from '@features/animations/screens/AnimationLabScreen';

// Herramienta interna: en builds de producción la ruta no lleva a ningún sitio.
export default function AnimacionesRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <AnimationLabScreen />;
}
