import { Redirect } from 'expo-router';

/** Ruta legada: el flujo unificado pasa por `choose-role`. */
export default function SelectProfileRedirect() {
  return <Redirect href="/(auth)/choose-role" />;
}
