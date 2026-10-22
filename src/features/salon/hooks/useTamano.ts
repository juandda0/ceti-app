import { useEffect, useState } from 'react';

export type Tamano = { ancho: number; alto: number };

/**
 * Mide un elemento del DOM (solo web). Devuelve un ref de callback y su tamaño,
 * que se actualiza con ResizeObserver (o con `resize` de la ventana si no hay).
 */
export function useTamano<T extends HTMLElement>() {
  const [nodo, setNodo] = useState<T | null>(null);
  const [tamano, setTamano] = useState<Tamano>({ ancho: 0, alto: 0 });

  useEffect(() => {
    if (!nodo) return;
    const medir = () => {
      const ancho = nodo.clientWidth;
      const alto = nodo.clientHeight;
      setTamano((prev) => (prev.ancho === ancho && prev.alto === alto ? prev : { ancho, alto }));
    };
    medir();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', medir);
      return () => window.removeEventListener('resize', medir);
    }
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, [nodo]);

  return [setNodo, tamano] as const;
}
