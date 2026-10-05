import { Redirect, type Href } from 'expo-router';

export default function DineroRedirect() {
  return <Redirect href={'/(app)/actividad' as Href} />;
}
