/**
 * Legal links surfaced in-app. The privacy / data-treatment policy must be
 * linked in-app per Ley 1581 (see docs/COMPLIANCE.md). Set via
 * EXPO_PUBLIC_PRIVACY_POLICY_URL.
 */
import Constants from 'expo-constants';

export const PRIVACY_POLICY_URL: string =
  (Constants.expoConfig?.extra as { privacyPolicyUrl?: string } | undefined)?.privacyPolicyUrl ??
  '';

export function hasPrivacyPolicy(): boolean {
  return PRIVACY_POLICY_URL.trim().length > 0;
}
