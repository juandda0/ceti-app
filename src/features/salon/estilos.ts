import { DarkColors } from '@shared/constants/colors';

// CSS del Salón (solo web). Se inyecta con un <style> desde la pantalla: el
// escenario es DOM puro (iframes escalados), así que hover, animaciones y
// medidas exactas son más simples en CSS que con StyleSheet.
const acento = DarkColors.brand.primary;

export const CSS_SALON = `
.salon-raiz {
  position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden;
  background:
    radial-gradient(1200px 700px at 12% -10%, rgba(91, 158, 245, 0.10), transparent 60%),
    radial-gradient(900px 600px at 105% 110%, rgba(168, 132, 255, 0.10), transparent 60%),
    #0b1020;
  color: #e6e9f5;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Barra de controles */
.salon-barra {
  flex: 0 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px;
  padding: 10px 18px; background: rgba(10, 14, 30, 0.82);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06); backdrop-filter: blur(8px);
}
.salon-titulo { display: flex; align-items: baseline; gap: 10px; margin-right: 6px; }
.salon-titulo strong { font-size: 14px; font-weight: 700; letter-spacing: 0.01em; }
.salon-titulo a { font-size: 12px; color: ${acento}; text-decoration: none; }
.salon-titulo a:hover { text-decoration: underline; }
.salon-grupo { display: flex; align-items: center; gap: 6px; }
.salon-grupo-nombre {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #8b93b0;
  margin-right: 2px;
}
.salon-chip {
  appearance: none; border: 1px solid rgba(255, 255, 255, 0.10); background: rgba(255, 255, 255, 0.04);
  color: #c9cee3; font: inherit; font-size: 12px; line-height: 1; padding: 7px 10px;
  border-radius: 999px; cursor: pointer; transition: background 120ms, border-color 120ms, color 120ms;
  white-space: nowrap;
}
.salon-chip:hover:not(:disabled) { background: rgba(255, 255, 255, 0.09); color: #fff; }
.salon-chip:disabled { opacity: 0.35; cursor: default; }
.salon-chip--activo, .salon-chip--activo:hover:not(:disabled) {
  background: ${acento}; border-color: ${acento}; color: #2b1407; font-weight: 700;
}
.salon-chip--redondo { width: 28px; padding: 7px 0; text-align: center; }
.salon-cantidad { min-width: 22px; text-align: center; font-variant-numeric: tabular-nums; font-weight: 700; font-size: 13px; }
.salon-interruptor { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #c9cee3; cursor: pointer; user-select: none; }
.salon-interruptor input { accent-color: ${acento}; width: 15px; height: 15px; margin: 0; cursor: pointer; }
.salon-espacio { flex: 1 1 auto; }

/* Escenario */
.salon-escenario {
  flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; gap: 24px; padding: 20px;
}
.salon-escenario--lado { flex-direction: row; }
.salon-escenario--arriba { flex-direction: column; }
.salon-raiz--presentacion .salon-escenario { padding: 24px; gap: 28px; }
.salon-ranura {
  position: relative; min-width: 0; min-height: 0;
  display: flex; align-items: center; justify-content: center;
}
.salon-ranura--profe-lado { flex: 0 0 45%; }
.salon-ranura--profe-arriba { flex: 0 0 56%; }
.salon-ranura--salon { flex: 1 1 auto; }
.salon-rejilla { display: flex; flex-wrap: wrap; justify-content: center; align-content: center; }

/* Dispositivos */
.salon-dispositivo { display: flex; flex-direction: column; align-items: center; }
.salon-caja { position: relative; }
.salon-marco {
  position: absolute; top: 0; left: 0; transform-origin: 0 0; box-sizing: border-box;
  background: linear-gradient(160deg, #262c40, #141828 55%, #0f1220);
  box-shadow: 0 0 0 1.5px rgba(255, 255, 255, 0.07) inset, 0 0 0 2px #05070f,
    0 30px 80px rgba(0, 0, 0, 0.55), 0 8px 24px rgba(0, 0, 0, 0.35);
}
.salon-marco--telefono { border-radius: 58px; }
.salon-marco--tableta { border-radius: 40px; }
.salon-pantalla { position: relative; overflow: hidden; background: #0e0e11; }
.salon-marco--telefono .salon-pantalla { border-radius: 46px; }
.salon-marco--tableta .salon-pantalla { border-radius: 22px; }
.salon-camara {
  position: absolute; width: 8px; height: 8px; border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #3a4a78, #070910 70%);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.05);
}
.salon-marco--telefono .salon-camara { top: 2px; left: 50%; margin-left: -4px; }
.salon-marco--tableta .salon-camara { left: 5px; top: 50%; margin-top: -4px; }
.salon-iframe {
  position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block;
  background: transparent; transition: opacity 220ms ease;
}
.salon-recargar {
  position: absolute; top: -8px; right: -8px; width: 28px; height: 28px; border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.14); background: rgba(16, 21, 40, 0.92); color: #e6e9f5;
  font-size: 15px; line-height: 1; cursor: pointer; opacity: 0; transition: opacity 140ms;
  display: flex; align-items: center; justify-content: center; z-index: 2;
}
.salon-caja:hover .salon-recargar, .salon-recargar:focus-visible { opacity: 1; }
.salon-recargar:hover { border-color: ${acento}; color: ${acento}; }
.salon-etiqueta {
  max-width: 100%; margin-top: 6px; height: 16px; font-size: 12px; line-height: 16px; color: #aab1cc;
  text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.salon-dispositivo--tableta .salon-etiqueta { margin-top: 10px; height: 20px; font-size: 14px; line-height: 20px; color: #d3d8ea; font-weight: 600; }
.salon-raiz--presentacion .salon-etiqueta { margin-top: 8px; height: 22px; font-size: 17px; line-height: 22px; color: #dfe3f2; }
.salon-raiz--presentacion .salon-dispositivo--tableta .salon-etiqueta { margin-top: 12px; height: 28px; font-size: 22px; line-height: 28px; }

/* Esqueleto mientras el dispositivo espera o carga */
.salon-esqueleto {
  position: absolute; inset: 0; padding: 64px 28px 28px; display: flex; flex-direction: column; gap: 22px;
  background: #10152a;
}
.salon-esqueleto > div, .salon-esqueleto-fila > div {
  border-radius: 22px;
  background: linear-gradient(100deg, rgba(255,255,255,0.04) 30%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 70%);
  background-size: 300% 100%; animation: salon-brillo 1.8s ease-in-out infinite;
}
.salon-esqueleto > .salon-esqueleto-fila { background: none; animation: none; display: flex; gap: 18px; }
.salon-esqueleto-barra { height: 46px; width: 55%; }
.salon-esqueleto-bloque { height: 180px; }
.salon-esqueleto-bloque--bajo { flex: 1; }
.salon-esqueleto-fila > div { flex: 1; height: 140px; }
.salon-esqueleto-texto {
  position: absolute; left: 0; right: 0; bottom: 40px; text-align: center;
  font-size: 30px; font-weight: 600; color: rgba(230, 233, 245, 0.35);
}
@keyframes salon-brillo { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

/* Modo presentación */
.salon-salir {
  position: fixed; top: 12px; right: 12px; z-index: 10; appearance: none; font: inherit; font-size: 12px;
  padding: 7px 14px; border-radius: 999px; border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(10, 14, 30, 0.7); color: #c9cee3; cursor: pointer; opacity: 0.35; transition: opacity 160ms;
}
.salon-salir:hover, .salon-salir:focus-visible { opacity: 1; }
.salon-vacio { color: #8b93b0; font-size: 13px; }
`;

// Alto (sin escalar) que ocupa la etiqueta bajo cada dispositivo: margen + línea.
// Debe coincidir con .salon-etiqueta arriba.
export const ALTO_ETIQUETA = {
  telefono: { normal: 6 + 16, presentacion: 8 + 22 },
  tableta: { normal: 10 + 20, presentacion: 12 + 28 },
} as const;
