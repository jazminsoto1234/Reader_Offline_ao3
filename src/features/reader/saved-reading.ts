import type { Destination, ReadingSession } from '../../domain/reading-session';

export interface ReadingProgress extends Destination {
  scrollY: number;
  anchor?: number;
  offset?: number;
}
export const readingCacheVersion = 2;
export interface SavedFile {
  id: string; file: Blob; name: string; lastModified: number;
  // Bump this version when the parser/sanitizer changes to invalidate old cached text.
  reading?: { version: number; session: ReadingSession };
}
const progressKey = 'lector.reading-progress.v1';
const legacyProgressKey = 'lector.pdf-progress.v1';

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('lector-reading', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('files');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadSavedFile(): Promise<SavedFile | undefined> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('files').objectStore('files').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function storeFile(file: File, signal: AbortSignal, session?: ReadingSession, id: string = crypto.randomUUID()): Promise<string> {
  const db = await database();
  try {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      const abort = () => { try { transaction.abort(); } catch { /* Transacción ya finalizada. */ } };
      signal.addEventListener('abort', abort, { once: true });
      transaction.objectStore('files').put({ id, file, name: file.name, lastModified: file.lastModified,
        reading: session ? { version: readingCacheVersion, session } : undefined } satisfies SavedFile, 'current');
      transaction.oncomplete = () => { signal.removeEventListener('abort', abort); resolve(); };
      transaction.onabort = transaction.onerror = () => { signal.removeEventListener('abort', abort); reject(transaction.error || new Error('Saving cancelled.')); };
    });
    return id;
  } finally { db.close(); }
}

export async function forgetSavedFile() {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('files', 'readwrite');
      transaction.objectStore('files').delete('current');
      transaction.oncomplete = () => resolve();
      transaction.onabort = transaction.onerror = () => reject(transaction.error);
    });
    localStorage.removeItem(progressKey);
    localStorage.removeItem(legacyProgressKey);
  } finally { db.close(); }
}

export function loadProgress(id: string): ReadingProgress | undefined {
  try {
    // Compatibilidad con los PDF guardados antes de admitir EPUB.
    const value = JSON.parse(localStorage.getItem(progressKey) || localStorage.getItem(legacyProgressKey) || 'null');
    if (value?.id !== id || typeof value.path !== 'string' || typeof value.fragment !== 'string' || !Number.isFinite(value.scrollY) || value.scrollY < 0) return;
    return { path: value.path, fragment: value.fragment, scrollY: value.scrollY,
      anchor: Number.isInteger(value.anchor) && value.anchor >= 0 ? value.anchor : undefined,
      offset: Number.isFinite(value.offset) ? value.offset : undefined };
  } catch { return; }
}

export function storeProgress(id: string, progress: ReadingProgress) {
  localStorage.setItem(progressKey, JSON.stringify({ id, ...progress }));
  localStorage.removeItem(legacyProgressKey);
}
