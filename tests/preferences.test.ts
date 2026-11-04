import { expect, it } from 'vitest';
import { defaults, validatePreferences } from '../src/features/reader/preferences';
it('solo acepta opciones conocidas y descarta contenido ajeno a preferencias', () => {
  expect(validatePreferences({ size: '9000', theme: 'evil', text: 'una obra privada' })).toEqual(defaults);
  expect(validatePreferences({ size: '20', spacing: 'wide', width: 'narrow', theme: 'dark', title: 'Privado' })).toEqual({ size: '20', spacing: 'wide', width: 'narrow', theme: 'dark' });
  expect(validatePreferences(null)).toEqual(defaults);
});
