import { useState } from 'react';
export const PREFERENCES_KEY = 'lector.preferences.v1';
export interface Preferences { size: '16' | '18' | '20' | '22' | '24'; spacing: 'compact' | 'normal' | 'wide'; width: 'narrow' | 'normal' | 'wide'; theme: 'light' | 'sepia' | 'dark' }
export const defaults: Preferences = { size: '16', spacing: 'normal', width: 'normal', theme: 'light' };
export function validatePreferences(value: unknown): Preferences {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    size: ['16', '18', '20', '22', '24'].includes(source.size as string) ? source.size as Preferences['size'] : defaults.size,
    spacing: ['compact', 'normal', 'wide'].includes(source.spacing as string) ? source.spacing as Preferences['spacing'] : defaults.spacing,
    width: ['narrow', 'normal', 'wide'].includes(source.width as string) ? source.width as Preferences['width'] : defaults.width,
    theme: ['light', 'sepia', 'dark'].includes(source.theme as string) ? source.theme as Preferences['theme'] : defaults.theme,
  };
}
export function usePreferences() {
  const [preferences, setPreferences] = useState<Preferences>(() => {
    try { return validatePreferences(JSON.parse(localStorage.getItem(PREFERENCES_KEY) || '{}')); } catch { return { ...defaults }; }
  });
  const updatePreferences = (value: Preferences) => {
    const safe = validatePreferences(value);
    setPreferences(safe);
    try { localStorage.setItem(PREFERENCES_KEY, JSON.stringify(safe)); } catch { /* Sigue funcionando en memoria si el navegador bloquea almacenamiento. */ }
  };
  return { preferences, updatePreferences };
}
