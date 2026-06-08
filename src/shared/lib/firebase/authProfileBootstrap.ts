import type { User } from 'firebase/auth';
import { userRepository } from '@features/auth/data/userRepository';

/** Ensures `users/{uid}` doc exists after OAuth sign-in. */
export async function tryBootstrapUserDoc(authUser: User): Promise<void> {
  try {
    await userRepository.ensureUserStub(authUser.uid, authUser);
  } catch {
    /* noop — will retry on next snapshot */
  }
}
