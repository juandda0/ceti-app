/**
 * Cliente HTTP del backend Spring Boot. Adjunta el token de sesión y convierte
 * las respuestas de error `{code, message}` en `ApiError`.
 */
import Constants from 'expo-constants';
import { tokenStore } from '@shared/lib/auth/tokenStore';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function baseUrl(): string {
  const extra = Constants.expoConfig?.extra as { apiUrl?: string } | undefined;
  return (extra?.apiUrl ?? '').replace(/\/+$/, '');
}

/** Sin EXPO_PUBLIC_API_URL la app corre en modo solo local (sin cuenta). */
export function isBackendConfigured(): boolean {
  return baseUrl().length > 0;
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (!isBackendConfigured()) throw new ApiError(0, 'unavailable', 'Backend no configurado');
  const token = await tokenStore.get();
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'unavailable', 'Sin conexión con el servidor. Inténtalo de nuevo.');
  }
  const text = await res.text();
  const data: unknown = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = (data ?? {}) as { code?: string; message?: string };
    throw new ApiError(
      res.status,
      err.code ?? (res.status === 401 ? 'unauthenticated' : 'internal'),
      err.message ?? `Error ${res.status}`
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  del: (path: string) => request<void>('DELETE', path),
  /** GET de un recurso que puede no existir (config, contenido propio, agregado). */
  async getOrNull<T>(path: string): Promise<T | null> {
    try {
      return await request<T>('GET', path);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
};

/** Segmento de URL seguro para ids que vienen de datos (uids, docIds). */
export const seg = encodeURIComponent;
