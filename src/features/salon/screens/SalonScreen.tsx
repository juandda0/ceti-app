import { useCallback, useEffect, useMemo, useState } from 'react';
import { buscarCuenta, estudiantesSalon } from '@features/salon/cuentas';
import { BarraControles } from '@features/salon/components/BarraControles';
import { MarcoDispositivo } from '@features/salon/components/MarcoDispositivo';
import { ALTO_ETIQUETA, CSS_SALON } from '@features/salon/estilos';
import { useTamano } from '@features/salon/hooks/useTamano';
import {
  escalaParaCaja,
  escribirAjustes,
  leerAjustes,
  repartirTelefonos,
  SEGUNDOS_REFRESCO,
  TABLETA,
  tamanoMarco,
  TELEFONO,
  urlEstudiante,
  urlProfe,
  type AjustesSalon,
  type UbicacionSalon,
} from '@features/salon/salon';

// Montar 25 apps de Expo a la vez congela el navegador: el profe entra
// primero y luego un estudiante cada INTERVALO_MONTAJE_MS.
const ESPERA_PRIMER_ESTUDIANTE_MS = 1200;
const INTERVALO_MONTAJE_MS = 600;
// Margen para que redondeos de subpíxel no desborden la ranura.
const HOLGURA = 0.995;

const marcoTelefono = tamanoMarco(TELEFONO);
const marcoTableta = tamanoMarco(TABLETA);

function ubicacionActual(): UbicacionSalon {
  return { protocolo: window.location.protocol, puerto: window.location.port };
}

function useAjustesEnUrl() {
  const [ajustes, setAjustes] = useState<AjustesSalon>(() => leerAjustes(window.location.search));

  useEffect(() => {
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${escribirAjustes(ajustes)}${hash}`
    );
  }, [ajustes]);

  const cambiar = useCallback((parcial: Partial<AjustesSalon>) => {
    setAjustes((prev) => ({ ...prev, ...parcial }));
  }, []);

  return [ajustes, cambiar] as const;
}

function usePantallaCompleta() {
  const [activa, setActiva] = useState(() => Boolean(document.fullscreenElement));

  useEffect(() => {
    const alCambiar = () => setActiva(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', alCambiar);
    return () => document.removeEventListener('fullscreenchange', alCambiar);
  }, []);

  const alternar = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
    } else {
      void document.documentElement.requestFullscreen?.().catch(() => undefined);
    }
  }, []);

  return [activa, alternar] as const;
}

/** Cuántos estudiantes ya pueden montar su iframe (crece de a uno). */
function useTurnosDeMontaje(n: number, hosts: string, conProfe: boolean) {
  const [estado, setEstado] = useState({ hosts, turno: 0 });

  // Al cambiar de hosts todos los iframes recargan: se vuelve a escalonar
  // (en el mismo render, para no montar los 24 con el src nuevo).
  if (estado.hosts !== hosts) setEstado({ hosts, turno: 0 });
  const turno = estado.hosts === hosts ? Math.min(estado.turno, n) : 0;

  // Si se quitan estudiantes y luego se agregan, los nuevos también hacen fila.
  useEffect(() => {
    setEstado((e) => (e.turno > n ? { ...e, turno: n } : e));
  }, [n]);

  useEffect(() => {
    if (turno >= n) return;
    const espera = turno === 0 && conProfe ? ESPERA_PRIMER_ESTUDIANTE_MS : INTERVALO_MONTAJE_MS;
    const t = setTimeout(() => setEstado((e) => ({ ...e, turno: e.turno + 1 })), espera);
    return () => clearTimeout(t);
  }, [turno, n, conProfe]);

  return turno;
}

export default function SalonScreen() {
  const [ajustes, cambiar] = useAjustesEnUrl();
  const [pantallaCompleta, alternarPantallaCompleta] = usePantallaCompleta();
  const [refRanuraProfe, tamanoProfe] = useTamano<HTMLDivElement>();
  const [refRanuraSalon, tamanoSalon] = useTamano<HTMLDivElement>();
  const [versiones, setVersiones] = useState<Record<string, number>>({});

  const { n, disposicion, presentacion, hosts, profe, refresco } = ajustes;
  const conProfe = disposicion !== 'estudiantes';
  const turno = useTurnosDeMontaje(n, hosts, conProfe);
  const [ubicacion] = useState(ubicacionActual);

  const recargar = useCallback((id: string) => {
    setVersiones((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
  }, []);

  // El tablero del profe no se actualiza en vivo: se recarga cada 20 s.
  useEffect(() => {
    if (!conProfe || !refresco) return;
    const t = setInterval(() => recargar('profe'), SEGUNDOS_REFRESCO * 1000);
    return () => clearInterval(t);
  }, [conProfe, refresco, recargar]);

  // Esc sale del modo presentación.
  useEffect(() => {
    if (!presentacion) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cambiar({ presentacion: false });
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [presentacion, cambiar]);

  const estudiantes = useMemo(() => estudiantesSalon(), []);
  const nombreProfe = buscarCuenta('profe-piloto')?.nombre ?? 'Andrés Rojas';
  const modo = presentacion ? 'presentacion' : 'normal';

  // Tableta: escala para caber en su ranura, descontando la etiqueta.
  const escalaProfe =
    escalaParaCaja(
      { ancho: tamanoProfe.ancho, alto: tamanoProfe.alto - ALTO_ETIQUETA.tableta[modo] },
      marcoTableta
    ) * HOLGURA;

  // Teléfonos: columnas y escala que aprovechan mejor la ranura.
  const separacion = presentacion ? 18 : 14;
  const reparto = repartirTelefonos(n, tamanoSalon, {
    separacion,
    etiqueta: ALTO_ETIQUETA.telefono[modo],
    marco: marcoTelefono,
  });
  const escalaTelefono = reparto.escala * HOLGURA;
  const anchoCelda = marcoTelefono.ancho * escalaTelefono;
  const anchoRejilla = reparto.columnas * anchoCelda + separacion * (reparto.columnas - 1);

  const clasesRaiz = ['salon-raiz'];
  if (presentacion) clasesRaiz.push('salon-raiz--presentacion');

  return (
    <div className={clasesRaiz.join(' ')}>
      <style>{CSS_SALON}</style>

      {presentacion ? (
        <button
          type="button"
          className="salon-salir"
          title="Salir del modo presentación (Esc)"
          onClick={() => cambiar({ presentacion: false })}
        >
          Salir
        </button>
      ) : (
        <BarraControles
          ajustes={ajustes}
          cambiar={cambiar}
          pantallaCompleta={pantallaCompleta}
          alternarPantallaCompleta={alternarPantallaCompleta}
        />
      )}

      <div
        className={`salon-escenario salon-escenario--${disposicion === 'arriba' ? 'arriba' : 'lado'}`}
      >
        {conProfe ? (
          <div ref={refRanuraProfe} className={`salon-ranura salon-ranura--profe-${disposicion}`}>
            {escalaProfe > 0 ? (
              <MarcoDispositivo
                tipo="tableta"
                escala={escalaProfe}
                src={urlProfe(profe, hosts, ubicacion)}
                montar
                version={versiones.profe ?? 0}
                etiqueta={`Profe · ${nombreProfe} — 10°B`}
                titulo={`Profe ${nombreProfe}`}
                onRecargar={() => recargar('profe')}
              />
            ) : null}
          </div>
        ) : null}

        <div ref={refRanuraSalon} className="salon-ranura salon-ranura--salon">
          {escalaTelefono > 0 ? (
            <div
              className="salon-rejilla"
              style={{ width: anchoRejilla, columnGap: separacion, rowGap: separacion }}
            >
              {Array.from({ length: n }, (_, i) => {
                const numero = i + 1;
                const id = `est-${numero}`;
                const nombre = estudiantes[i]?.nombre ?? `Estudiante ${numero}`;
                return (
                  <MarcoDispositivo
                    key={id}
                    tipo="telefono"
                    escala={escalaTelefono}
                    src={urlEstudiante(numero, hosts, ubicacion)}
                    montar={numero <= turno}
                    version={versiones[id] ?? 0}
                    etiqueta={nombre}
                    titulo={`Estudiante ${nombre}`}
                    onRecargar={() => recargar(id)}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
