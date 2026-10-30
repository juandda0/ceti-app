/**
 * HTML de una cotización de entidad (Fase 6) para imprimir o compartir como
 * PDF. Puro.
 */
import {
  RESPONSABILIDADES_FISCALES,
  fechaBogota,
  formatoCop,
  itemFacturaEntidad,
  type Cotizacion,
  type DatosFacturacion,
} from '@/functions/src/educadores/dominio';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

export const NOMBRE_RESPONSABILIDAD: Record<(typeof RESPONSABILIDADES_FISCALES)[number], string> = {
  'R-99-PN': 'No responsable (R-99-PN)',
  'O-13': 'Gran contribuyente (O-13)',
  'O-15': 'Autorretenedor (O-15)',
  'O-23': 'Agente de retención de IVA (O-23)',
  'O-47': 'Régimen simple (O-47)',
};

function fecha(ms: number): string {
  const [a, m, d] = fechaBogota(ms).split('-');
  return `${d}/${m}/${a}`;
}

export function cotizacionHtml(c: Cotizacion, entidad: string, datos: DatosFacturacion | null): string {
  const cliente = datos
    ? `${esc(datos.razonSocial)}<br>NIT ${esc(datos.nit)}-${esc(datos.dv)}<br>${esc(datos.direccion)}, ${esc(datos.ciudad)}<br>${esc(datos.correoFactura)}`
    : esc(entidad);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización ${esc(c.numero)}</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;color:#16161a;margin:40px;font-size:14px}h1{font-size:22px;margin:0 0 4px}
.meta{color:#666;margin:0 0 24px}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px;border-bottom:1px solid #ddd;text-align:left}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}.total td{font-weight:800;border-top:2px solid #16161a}.nota{color:#666;font-size:12px;margin-top:24px}</style></head><body>
<h1>Cotización ${esc(c.numero)}</h1>
<p class="meta">Ceti Educadores · ${fecha(c.creadaAt)} · válida hasta el ${fecha(c.validaHasta)}</p>
<p><b>Para</b><br>${cliente}</p>
<table><thead><tr><th>Concepto</th><th class="n">Cantidad</th><th class="n">Valor unitario</th><th class="n">Subtotal</th></tr></thead><tbody>
<tr><td>${esc(itemFacturaEntidad(c))}</td><td class="n">${c.cantidad}</td><td class="n">${formatoCop(c.unitario)}</td><td class="n">${formatoCop(c.base)}</td></tr>
<tr><td colspan="3">IVA 19 %</td><td class="n">${formatoCop(c.iva)}</td></tr>
<tr class="total"><td colspan="3">Total</td><td class="n">${formatoCop(c.total)}</td></tr></tbody></table>
${c.solicitada < c.cantidad ? `<p>Incluye el mínimo del plan (${c.cantidad}); pidieron ${c.solicitada}.</p>` : ''}
${c.ordenCompra ? `<p><b>Orden de compra:</b> ${esc(c.ordenCompra)}</p>` : ''}
<p>Incluye el panel de la entidad y el informe de cobertura de educación económica y financiera por grado o programa, alineado con los ámbitos y competencias del Documento 26 del MEN, como evidencia para el PEI (Ley 1450 de 2011, art. 145; CONPES 4005 de 2020).</p>
<p class="nota">Pago por transferencia o PSE. Cuando confirmemos el pago activamos la licencia por ${c.meses} meses y emitimos la factura electrónica a nombre de la entidad. El IVA del 19 % está pendiente de confirmar con un tributarista.</p>
</body></html>`;
}
