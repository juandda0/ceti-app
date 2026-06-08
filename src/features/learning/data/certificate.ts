/**
 * Certificate HTML builder. Pure (data → printable HTML string) so it is
 * testable; the browser turns it into a PDF via print (see printHtml). Carries
 * the school logo/name — tangible evidence of completion the school values.
 */
export interface CertificateData {
  colegioNombre: string;
  colegioLogoUrl?: string;
  /** Student's own display name (self-provided nickname). */
  studentName: string;
  competenciaLabel: string;
  worldName: string;
  masteryPct: number;
  dateLabel: string;
}

function esc(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }) as const)[c as '&']
  );
}

export function buildCertificateHtml(d: CertificateData): string {
  const logo = d.colegioLogoUrl
    ? `<img src="${esc(d.colegioLogoUrl)}" alt="logo" style="max-height:72px;max-width:220px;object-fit:contain" />`
    : '';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>Certificado — ${esc(d.studentName)}</title>
<style>
  @page { size: A4 landscape; margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #0F1B2D; }
  .sheet { width: 297mm; height: 210mm; padding: 24mm; display: flex; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    border: 10px solid #0F1B2D; }
  .logo { height: 72px; margin-bottom: 12px; }
  .school { font-size: 18px; letter-spacing: 1px; text-transform: uppercase; color: #46566e; }
  .title { font-size: 40px; font-weight: 700; margin: 18px 0 6px; }
  .sub { font-size: 16px; color: #46566e; }
  .name { font-size: 34px; font-weight: 700; margin: 22px 0 6px; }
  .body { font-size: 18px; max-width: 600px; line-height: 1.5; }
  .meta { margin-top: 26px; font-size: 15px; color: #46566e; }
  strong { color: #0F1B2D; }
</style></head>
<body><div class="sheet">
  <div class="logo">${logo}</div>
  <div class="school">${esc(d.colegioNombre)}</div>
  <div class="title">Certificado de logro</div>
  <div class="sub">otorgado a</div>
  <div class="name">${esc(d.studentName)}</div>
  <div class="body">por dominar la competencia de <strong>${esc(d.competenciaLabel)}</strong>
    (${esc(d.worldName)}) con un ${d.masteryPct}% de dominio.</div>
  <div class="meta">${esc(d.dateLabel)} · Ceti — Educación Financiera</div>
</div></body></html>`;
}
