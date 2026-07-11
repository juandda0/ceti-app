import { Stack } from 'expo-router';
import { Colors } from '@shared/constants/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'default',
        contentStyle: { backgroundColor: Colors.background.primary },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="onboarding/user-setup" />
      <Stack.Screen name="unirse" />
    </Stack>
  );
}
