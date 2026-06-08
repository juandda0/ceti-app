import type { Href, Router } from 'expo-router';

/** Evita GO_BACK sin historial (p. ej. tras un `<Redirect />` inicial). */
export function safeRouterBack(router: Router, fallback: Href): void {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
