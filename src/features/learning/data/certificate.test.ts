import { buildCertificateHtml } from '@features/learning/data/certificate';

const base = {
  colegioNombre: 'Colegio Ceti',
  studentName: 'Ana',
  competenciaLabel: 'Ahorro',
  worldName: 'Estrella del Ahorro',
  masteryPct: 90,
  dateLabel: '3 de junio de 2026',
};

describe('buildCertificateHtml', () => {
  it('includes the school, student, competency and mastery', () => {
    const html = buildCertificateHtml(base);
    expect(html).toContain('Colegio Ceti');
    expect(html).toContain('Ana');
    expect(html).toContain('Ahorro');
    expect(html).toContain('90%');
  });

  it('renders a logo img when a url is provided, none otherwise', () => {
    expect(buildCertificateHtml({ ...base, colegioLogoUrl: 'https://x/logo.png' })).toContain(
      '<img'
    );
    expect(buildCertificateHtml(base)).not.toContain('<img');
  });

  it('escapes HTML in user-provided fields', () => {
    const html = buildCertificateHtml({ ...base, studentName: '<script>x</script>' });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
