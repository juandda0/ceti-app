import { Redirect, type Href } from 'expo-router';

export default function SavingsRedirect() {
  return <Redirect href={'/(app)/actividad' as Href} />;
}
