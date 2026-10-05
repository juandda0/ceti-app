import { api } from '@shared/lib/api/client';
import type { SessionProfile, SessionUser } from '@shared/lib/auth/session';

export type UserProfileDraft = SessionProfile;

export const userRepository = {
  /** Guarda nombre visible + perfil; email/proveedor los fija el servidor al login. */
  async upsertProfile(data: { displayName: string; profile: UserProfileDraft }): Promise<SessionUser> {
    return api.put<SessionUser>('/api/me/profile', data);
  },
};
