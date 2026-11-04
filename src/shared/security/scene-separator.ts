// Regla estructural: cualquier línea de signos o adornos aislada del texto.
// No depende de una lista de glifos, de repeticiones ni de un ancho máximo.
export function isSceneSeparator(text: string) {
  const value = text.trim();
  return /[\p{P}\p{S}]/u.test(value) && /^[\p{P}\p{S}\p{M}\s\u200d]+$/u.test(value);
}
