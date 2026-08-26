import { parseProfessorAssignment } from './assignRolePolicy';

test('solo acepta profesor con colegio', () => {
  expect(parseProfessorAssignment({ role: 'profesor', colegioId: ' colA ' })).toEqual({
    role: 'profesor',
    colegioId: 'colA',
  });
});

test.each([
  { role: 'admin' },
  { role: 'estudiante', colegioId: 'colA' },
  { role: 'profesor', colegioId: 'colA', cursoId: 'cursoA1' },
])('rechaza %o', (input) => {
  expect(() => parseProfessorAssignment(input)).toThrow('invalid assignment');
});
