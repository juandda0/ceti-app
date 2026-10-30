import { Stack } from 'expo-router';
import { Colors } from '@shared/constants/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        animationDuration: 200,
        contentStyle: { backgroundColor: Colors.background.primary },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="institucion" />
      <Stack.Screen name="onboarding/user-setup" />
    </Stack>
  );
}
