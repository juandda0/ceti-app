/**
 * Thin wrapper to call deployed callable Cloud Functions from the client.
 * Region must match deployment (us-central1).
 */
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseClients } from '@shared/lib/firebase/app';

export async function callFunction<T = unknown>(name: string, data?: unknown): Promise<T> {
  const clients = getFirebaseClients();
  if (!clients) throw new Error('Firebase no configurado');
  const functions = getFunctions(clients.app, 'us-central1');
  const fn = httpsCallable(functions, name);
  const res = await fn(data ?? {});
  return res.data as T;
}
