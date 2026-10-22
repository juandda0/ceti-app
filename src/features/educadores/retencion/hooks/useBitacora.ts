/**
 * La Bitácora de la semana en vivo: lee las clases del profe, arma cada
 * `CursoBitacora` desde su tablero y deja que el dominio decida cifras, alertas,
 * tono y siguiente paso. Si no puede calcularla (sin red), usa la que guardó el
 * servidor el domingo. Funciona igual con cualquier plan.
 *
 * La tarjeta de Clases y la pantalla completa comparten el resultado (caché por
 * profe de unos minutos), así abrir la Bitácora no vuelve a leer todo.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthStore } from '@features/auth/store/useAuthStore';
import { rosterRepository } from '@features/dashboard/data/rosterRepository';
import { construirBitacora, semanaIso, type Bitacora } from '@/functions/src/educadores/dominio';
import { cursoBitacoraDesdeReporte } from '../data/bitacoraCursos';
import { cargarCursoDetalle } from '../data/cursoDetalle';
import { bitacoraRepository } from '../data/bitacoraRepository';
import { destinoSiguientePaso, type CursoDeBitacora, type Destino } from '../data/siguientePaso';

const VIGENCIA_MS = 5 * 60 * 1000;

export interface ResultadoBitacora {
  bitacora: Bitacora;
  cursos: CursoDeBitacora[];
  destino: Destino;
  /** true si viene de la copia del servidor y no del cálculo en vivo. */
  delServidor: boolean;
}

let cache: { uid: string; at: number; valor: ResultadoBitacora } | null = null;

async function calcular(colegioId: string, uid: string, ahora: number): Promise<ResultadoBitacora> {
  const semana = semanaIso(ahora);
  try {
    const lista = await rosterRepository.getCursosByProfesor(colegioId, uid);
    const cursos: CursoDeBitacora[] = await Promise.all(
      lista.map(async (c) => {
        const d = await cargarCursoDetalle(colegioId, c.id, c.nombre, ahora);
        return {
          id: c.id,
          nombre: c.nombre,
          curso: cursoBitacoraDesdeReporte({
            cursoId: c.id,
            nombre: c.nombre,
            estudiantes: d.report.students,
            progreso: d.progreso,
            asignaciones: d.asignaciones,
            nombreMundo: d.nombreMundo,
            ahora,
          }),
        };
      })
    );
    const bitacora = construirBitacora(
      cursos.map((c) => c.curso),
      semana,
      ahora
    );
    return {
      bitacora,
      cursos,
      destino: destinoSiguientePaso(bitacora, cursos),
      delServidor: false,
    };
  } catch (e) {
    const guardada = await bitacoraRepository.leerSemana(uid, semana).catch(() => null);
    if (!guardada) throw e;
    return {
      bitacora: guardada,
      cursos: [],
      destino: destinoSiguientePaso(guardada, []),
      delServidor: true,
    };
  }
}

export function useBitacora(): {
  estado: 'cargando' | 'lista' | 'error';
  resultado: ResultadoBitacora | null;
  recargar: () => void;
} {
  const colegioId = useAuthStore((s) => s.colegioId);
  const uid = useAuthStore((s) => s.firebaseUid);
  const enCache =
    cache && cache.uid === uid && Date.now() - cache.at < VIGENCIA_MS ? cache.valor : null;
  const [resultado, setResultado] = useState<ResultadoBitacora | null>(enCache);
  const [estado, setEstado] = useState<'cargando' | 'lista' | 'error'>(
    enCache ? 'lista' : 'cargando'
  );
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    if (!colegioId || !uid) {
      setEstado('error');
      return;
    }
    const fresca = cache && cache.uid === uid && Date.now() - cache.at < VIGENCIA_MS;
    if (fresca && vuelta === 0) {
      setResultado(cache!.valor);
      setEstado('lista');
      return;
    }
    let cancelado = false;
    if (!resultado) setEstado('cargando');
    const ahora = Date.now();
    void calcular(colegioId, uid, ahora)
      .then((valor) => {
        cache = { uid, at: ahora, valor };
        if (!cancelado) {
          setResultado(valor);
          setEstado('lista');
        }
      })
      .catch(() => {
        if (!cancelado && !resultado) setEstado('error');
      });
    return () => {
      cancelado = true;
    };
    // `resultado` solo decide si se muestra el esqueleto: no debe relanzar la carga.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colegioId, uid, vuelta]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);
  return { estado, resultado, recargar };
}

/** Solo pruebas y demo: olvida la Bitácora en caché. */
export function olvidarBitacora(): void {
  cache = null;
}
