import { afterEach, expect, it, vi } from 'vitest';
import { importEpub } from '../src/features/importer/import-controller';
import { LIMITS } from '../src/features/importer/limits';
const workers: FakeWorker[] = [];
class FakeWorker {
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminate = vi.fn();
  postMessage = vi.fn();
  constructor() { workers.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); workers.length = 0; });
it('cancelar termina el worker y rechaza la importación', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  const controller = new AbortController();
  const pending = importEpub(new File(['zip'], 'book.epub'), controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
it('un tiempo excesivo termina realmente el worker', async () => {
  vi.useFakeTimers(); vi.stubGlobal('Worker', FakeWorker);
  const pending = importEpub(new File(['zip'], 'book.epub'), new AbortController().signal);
  const assertion = expect(pending).rejects.toThrow('20 seconds');
  await vi.advanceTimersByTimeAsync(LIMITS.timeout);
  await assertion;
  expect(workers[0].terminate).toHaveBeenCalledOnce();
});
it('archivo vacío no llega al worker', async () => {
  vi.stubGlobal('Worker', FakeWorker);
  await expect(importEpub(new File([], 'empty.epub'), new AbortController().signal)).rejects.toThrow('empty');
  expect(workers).toHaveLength(0);
});
