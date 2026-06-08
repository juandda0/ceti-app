/** Stub — no remote seed needed for single-user architecture. */
export async function seedLocalDataToRemoteIfNeeded(): Promise<void> {
  // No-op: user profile is written directly in UserSetupScreen via userRepository.upsertProfile
}
