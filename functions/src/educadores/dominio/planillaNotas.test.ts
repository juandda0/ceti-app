import { armarPlanilla, planillaCsv, separarNombre } from './planillaNotas';

describe('planilla de notas (F9)', () => {
  it('separa nombres y apellidos como en Colombia', () => {
    expect(separarNombre('Mariana López')).toEqual({ nombres: 'Mariana', apellidos: 'López' });
    expect(separarNombre('Mariana López Ruiz')).toEqual({ nombres: 'Mariana', apellidos: 'López Ruiz' });
    expect(separarNombre('Ana María López Ruiz')).toEqual({ nombres: 'Ana María', apellidos: 'López Ruiz' });
    expect(separarNombre('Cher')).toEqual({ nombres: 'Cher', apellidos: '' });
  });

  it('la nota lleva el uid de su estudiante (las notas vienen ordenadas por nombre)', () => {
    const p = armarPlanilla([{ nombre: 'Zoe Paz', correo: 'zoe@x.co', nota: 4, desempeno: 'alto', observacion: '' }], ['correo', 'nota']);
    expect(p.filas).toEqual([['zoe@x.co', 4]]);
  });

  it('ordena por apellidos con las columnas elegidas', () => {
    const p = armarPlanilla(
      [
        { nombre: 'Samuel Torres', correo: 's@x.co', nota: 4.25, desempeno: 'alto', observacion: 'Bien' },
        { nombre: 'Ana María Ávila Ruiz', correo: null, nota: null, desempeno: null, observacion: 'Sin actividad' },
      ],
      ['apellidos', 'nombres', 'correo', 'nota', 'desempeno']
    );
    expect(p.encabezados).toEqual(['Apellidos', 'Nombres', 'Correo', 'Nota', 'Desempeño']);
    expect(p.filas).toEqual([
      ['Ávila Ruiz', 'Ana María', '', null, ''],
      ['Torres', 'Samuel', 's@x.co', 4.25, 'Alto'],
    ]);
    expect(planillaCsv(p)).toBe('Apellidos;Nombres;Correo;Nota;Desempeño\r\nÁvila Ruiz;Ana María;;;\r\nTorres;Samuel;s@x.co;4,3;Alto\r\n');
  });
});
