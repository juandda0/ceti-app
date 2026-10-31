import { Redirect } from 'expo-router';
import MiDineroScreen from '@features/savings/screens/MiDineroScreen';

// Herramienta interna: «Mis topes» (MiDineroScreen), que hoy ninguna pantalla de la
// app enlaza (/dinero redirige a Gastos y ahorros). La usa el manual interactivo para
// mostrarla con los datos de la cuenta abierta. En producción la ruta no lleva a ningún sitio.
export default function TopesDevRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <MiDineroScreen />;
}
