import { Redirect, type Href } from 'expo-router';

// `/(staff)` entra a la pestaña Clases. La pestaña no es un `index` anidado: así
// `/` (sin grupo) sigue cayendo en el resolver raíz app/index, como antes.
export default function StaffIndex() {
  return <Redirect href={'/(staff)/clases' as Href} />;
}
