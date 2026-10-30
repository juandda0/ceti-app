import { strFromU8, unzipSync } from 'fflate';
import { construirXlsx, letraColumna } from './xlsx';

describe('construirXlsx', () => {
  it('arma un zip con el libro, las hojas y los valores escapados', () => {
    const bytes = construirXlsx([
      {
        nombre: 'Estudiantes',
        filas: [
          ['Nombre', 'Nota'],
          ['Ana <López> & co', 4.5],
          ['Leo', null],
        ],
      },
      { nombre: 'Estudiantes', filas: [['otra']] },
    ]);
    const zip = unzipSync(bytes);
    expect(Object.keys(zip)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/worksheets/sheet2.xml',
      ])
    );
    const libro = strFromU8(zip['xl/workbook.xml']);
    expect(libro).toContain('name="Estudiantes"');
    expect(libro).toContain('name="Estudiantes 2"');
    const hoja = strFromU8(zip['xl/worksheets/sheet1.xml']);
    expect(hoja).toContain('<c r="B2"><v>4.5</v></c>');
    expect(hoja).toContain('Ana &lt;López&gt; &amp; co');
    expect(hoja).toContain('<c r="A1" t="inlineStr" s="1">');
    expect(hoja).not.toContain('r="B3"');
  });

  it('letras de columna', () => {
    expect([0, 25, 26, 27, 701].map(letraColumna)).toEqual(['A', 'Z', 'AA', 'AB', 'ZZ']);
  });
});
