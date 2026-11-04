import { BlobReader, ZipReader, configure } from '@zip.js/zip.js';
import { LIMITS } from './limits';
configure({ useWebWorkers: false });
self.onmessage = async ({ data: file }: MessageEvent<File>) => {
  const reader = new ZipReader(new BlobReader(file));
  try {
    let count = 0;
    let declared = 0;
    let produced = 0;
    const files: Record<string, string> = Object.create(null);
    const seen = new Set<string>();
    for await (const entry of reader.getEntriesGenerator()) {
      if (++count > LIMITS.entries) throw new Error('The EPUB exceeds the 1000-entry limit.');
      if (entry.directory) continue;
      if (seen.has(entry.filename)) throw new Error('The ZIP contains duplicate paths.');
      seen.add(entry.filename);
      declared += entry.uncompressedSize;
      if (declared > LIMITS.total) throw new Error('The EPUB exceeds the 32 MiB uncompressed limit.');
      if (entry.encrypted) throw new Error('Encrypted EPUB files and DRM are not supported.');
      // No extraer imágenes ni fuentes; tampoco se cargan en el lector.
      if (!/\.(xml|opf|ncx|xhtml|html|htm)$/i.test(entry.filename) && entry.filename !== 'mimetype') continue;
      if (entry.uncompressedSize > LIMITS.entry) throw new Error('A section exceeds the 2 MiB limit.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      await entry.getData(new WritableStream<Uint8Array>({ write(chunk) {
        size += chunk.byteLength; produced += chunk.byteLength;
        if (size > LIMITS.entry || produced > LIMITS.total) throw new Error('The extraction limit was exceeded.');
        chunks.push(chunk);
      } }), { checkSignature: true });
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      files[entry.filename] = new TextDecoder().decode(bytes);
    }
    self.postMessage({ files });
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : 'The EPUB could not be extracted.' }); }
  finally { await reader.close(); }
};
