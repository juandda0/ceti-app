/**
 * Fase 8b — el certificado en HTML para el PDF (expo-print en el celular, un
 * iframe en web). Cita las normas vigentes del tipo de entidad y aclara que
 * Ceti no es una entidad certificadora. Puro.
 */
import { textoNormas, type CertificadoPublico } from '@/functions/src/educadores/dominio';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const fechaLarga = (t: number) =>
  new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Bogota' });

/** «A, B y C». */
export function lista(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;
}

export function certificadoHtml(c: CertificadoPublico, urlVerificacion: string): string {
  const revocado = c.revocadoAt
    ? `<p class="revocado">Este certificado fue revocado el ${esc(fechaLarga(c.revocadoAt))}.</p>`
    : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificado ${esc(c.codigo)}</title>
<style>
@page{size:A4 landscape;margin:14mm}
body{font-family:Helvetica,Arial,sans-serif;color:#1E1A18;margin:0}
.marco{border:10px solid #FFE7CF;outline:2px solid #FF8A1F;outline-offset:-18px;padding:40px 48px;text-align:center}
.sobre{color:#B85A00;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700}
h1{font-size:30px;margin:12px 0 6px}
.nombre{font-size:34px;font-weight:800;color:#B85A00;margin:10px 0}
p{font-size:15px;line-height:1.5;margin:6px auto;max-width:640px}
.legal{font-size:11px;color:#6B625C;max-width:720px;margin-top:22px}
.pie{display:flex;justify-content:space-between;margin-top:30px;font-size:12px;color:#6B625C;text-align:left}
.codigo{font-family:Menlo,monospace;font-weight:700;color:#1E1A18;font-size:14px}
.revocado{color:#B3261E;font-weight:700}
</style></head><body><div class="marco">
<div class="sobre">Ceti · Educación económica y financiera</div>
<h1>Certificado de participación</h1>
<p>Se certifica que</p>
<div class="nombre">${esc(c.nombre)}</div>
<p>completó en la clase <b>${esc(c.clase)}</b> de <b>${esc(c.institucion)}</b> ${c.mundos.length === 1 ? 'el mundo' : 'los mundos'} <b>${esc(lista(c.mundos))}</b>${c.desempenos > 0 ? `, con ${c.desempenos} desempeños del MEN trabajados` : ''}, entre el ${esc(fechaLarga(c.desde))} y el ${esc(fechaLarga(c.hasta))}.</p>
${revocado}
<p class="legal">Actividad de educación económica y financiera según ${esc(textoNormas(c.tipoEntidad))}. Ceti no es una entidad certificadora: este documento da constancia de la participación del estudiante en su clase.</p>
<div class="pie"><div>${esc(c.profe)}<br>${esc(fechaLarga(c.emitidoAt))}</div><div>Verificar en ${esc(urlVerificacion)}<br><span class="codigo">${esc(c.codigo)}</span></div></div>
</div></body></html>`;
}
