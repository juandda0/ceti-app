import { useCallback, useEffect, useState } from 'react';
import { TABLETA, TELEFONO, tamanoMarco } from '@features/salon/salon';

// Tras el `load` del iframe la app aún arranca, inicia sesión y redirige: se
// espera un poco antes de mostrarla para no enseñar la pantalla intermedia.
const ESPERA_TRAS_CARGA_MS = 1500;
// Si el iframe nunca avisa (error de red), se muestra igual pasado este tiempo.
const ESPERA_MAXIMA_MS = 20000;

type Capa = { version: number; lista: boolean };

function CapaIframe({
  src,
  version,
  titulo,
  visible,
  onLista,
}: {
  src: string;
  version: number;
  titulo: string;
  visible: boolean;
  onLista: (version: number) => void;
}) {
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => onLista(version), cargado ? ESPERA_TRAS_CARGA_MS : ESPERA_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [cargado, onLista, version]);

  return (
    <iframe
      className="salon-iframe"
      src={src}
      title={titulo}
      loading="eager"
      allow="fullscreen"
      onLoad={() => setCargado(true)}
      style={{ opacity: visible ? 1 : 0 }}
    />
  );
}

/**
 * Pantalla del dispositivo. Al recargar (nueva `version`) monta un iframe
 * nuevo debajo del actual y solo cambia cuando el nuevo está listo, así el
 * tablero del profe se refresca sin parpadeo.
 */
function PantallaIframe({
  src,
  version,
  titulo,
}: {
  src: string;
  version: number;
  titulo: string;
}) {
  const [capas, setCapas] = useState<Capa[]>([{ version, lista: false }]);

  useEffect(() => {
    setCapas((prev) =>
      prev.some((c) => c.version === version) ? prev : [...prev, { version, lista: false }]
    );
  }, [version]);

  const marcarLista = useCallback((v: number) => {
    setCapas((prev) => {
      const i = prev.findIndex((c) => c.version === v);
      if (i < 0 || prev[i].lista) return prev;
      // La capa lista reemplaza a todas las anteriores.
      return prev.slice(i).map((c, j) => (j === 0 ? { ...c, lista: true } : c));
    });
  }, []);

  const hayLista = capas.some((c) => c.lista);

  return (
    <>
      {hayLista ? null : <Esqueleto texto="Cargando…" />}
      {capas.map((c) => (
        <CapaIframe
          key={c.version}
          src={src}
          version={c.version}
          titulo={titulo}
          visible={c.lista}
          onLista={marcarLista}
        />
      ))}
    </>
  );
}

function Esqueleto({ texto }: { texto: string }) {
  return (
    <div className="salon-esqueleto">
      <div className="salon-esqueleto-barra" />
      <div className="salon-esqueleto-bloque" />
      <div className="salon-esqueleto-fila">
        <div className="salon-esqueleto-tarjeta" />
        <div className="salon-esqueleto-tarjeta" />
      </div>
      <div className="salon-esqueleto-bloque salon-esqueleto-bloque--bajo" />
      <span className="salon-esqueleto-texto">{texto}</span>
    </div>
  );
}

export type MarcoDispositivoProps = {
  tipo: 'telefono' | 'tableta';
  /** Escala del marco completo (1 = tamaño lógico real). */
  escala: number;
  src: string;
  /** false mientras el dispositivo espera su turno para montar el iframe. */
  montar: boolean;
  /** Cambiarla recarga la pantalla. */
  version: number;
  etiqueta: string;
  titulo: string;
  onRecargar: () => void;
};

export function MarcoDispositivo({
  tipo,
  escala,
  src,
  montar,
  version,
  etiqueta,
  titulo,
  onRecargar,
}: MarcoDispositivoProps) {
  const logico = tipo === 'tableta' ? TABLETA : TELEFONO;
  const marco = tamanoMarco(logico);
  const ancho = marco.ancho * escala;
  const alto = marco.alto * escala;

  return (
    <div className={`salon-dispositivo salon-dispositivo--${tipo}`} style={{ width: ancho }}>
      <div className="salon-caja" style={{ width: ancho, height: alto }}>
        <div
          className={`salon-marco salon-marco--${tipo}`}
          style={{
            width: marco.ancho,
            height: marco.alto,
            padding: logico.bisel,
            transform: `scale(${escala})`,
          }}
        >
          <span className="salon-camara" />
          <div className="salon-pantalla" style={{ width: logico.ancho, height: logico.alto }}>
            {montar ? (
              <PantallaIframe key={src} src={src} version={version} titulo={titulo} />
            ) : (
              <Esqueleto texto="En fila…" />
            )}
          </div>
        </div>
        <button
          type="button"
          className="salon-recargar"
          title={`Recargar · ${etiqueta}`}
          aria-label={`Recargar ${etiqueta}`}
          onClick={onRecargar}
        >
          ↻
        </button>
      </div>
      <div className="salon-etiqueta" title={etiqueta}>
        {etiqueta}
      </div>
    </div>
  );
}
