import { LIMITS } from './limits';
import { parseEpub } from './epub-parser';
export async function importEpub(file: File, signal: AbortSignal) {
  if (!file.size) throw new Error('The file is empty.');
  if (file.size > LIMITS.file) throw new Error('The file exceeds the 20 MiB limit.');
  const files = await new Promise<Record<string, string>>((resolve, reject) => {
    const worker = new Worker(new URL('./unzip.worker.ts', import.meta.url), { type: 'module' });
    const finish = (error?: Error, files?: Record<string, string>) => {
      clearTimeout(timer); signal.removeEventListener('abort', abort); worker.terminate();
      if (error) reject(error); else resolve(files!);
    };
    const abort = () => finish(new DOMException('Import cancelled.', 'AbortError'));
    const timer = setTimeout(() => finish(new Error('Import exceeded 20 seconds. Try a smaller EPUB.')), LIMITS.timeout);
    signal.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }) => finish(data.error ? new Error(data.error) : undefined, data.files);
    worker.onerror = () => finish(new Error('The EPUB could not be opened. Check that the file is valid.'));
    if (signal.aborted) abort(); else worker.postMessage(file);
  });
  signal.throwIfAborted();
  return parseEpub(files);
}
