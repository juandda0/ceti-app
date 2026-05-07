// app/(auth)/_layout.tsx — Auth layout with smooth iOS transitions
import { Stack } from 'expo-router';
import { Colors } from '@shared/constants/colors';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'default', // Transición nativa suave de iOS/Android
        contentStyle: { backgroundColor: Colors.background.primary },
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="login" />
      <Stack.Screen name="choose-role" />
      <Stack.Screen name="child-entry" />
      <Stack.Screen name="select-profile" />
      <Stack.Screen name="onboarding/child-setup" />
      <Stack.Screen name="onboarding/child-link" />
      <Stack.Screen name="onboarding/parent-setup" />
    </Stack>
  );
}
