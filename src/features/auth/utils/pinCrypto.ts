import * as Crypto from 'expo-crypto';
import Constants from 'expo-constants';

function getPinPepper(): string {
  const extra = Constants.expoConfig?.extra as { pinPepper?: string } | undefined;
  return (
    extra?.pinPepper || process.env.EXPO_PUBLIC_PIN_PEPPER || 'ceti-local-pepper-change-in-prod'
  );
}

export async function hashParentPin(pin: string): Promise<string> {
  const normalized = pin.trim();
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${normalized}:${getPinPepper()}`
  );
}
