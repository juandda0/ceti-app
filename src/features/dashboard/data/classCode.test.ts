import { normalizeClassCode } from './classCode';

describe('normalizeClassCode', () => {
  it.each([
    [' abc123 ', 'ABC123'],
    [' ab c12 ', 'AB C12'],
    ['   ', ''],
  ])('normalizes %p', (rawCode, expected) => {
    expect(normalizeClassCode(rawCode)).toBe(expected);
  });
});
