import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { buildPdfSession, reconstructPdfPage, safePdfUrl, type PdfItem, type PdfLink, type PdfOutline, type PdfPage } from './pdf-reconstruction';
import { PDF_LIMITS, validatePdfPageCount } from './pdf-limits';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
export async function destinationPage(pdf: PDFDocumentProxy, destination: unknown) {
  try {
    const dest = typeof destination === 'string' ? await pdf.getDestination(destination) : destination;
    if (!Array.isArray(dest)) return undefined;
    const index = typeof dest[0] === 'number' ? dest[0] : await pdf.getPageIndex(dest[0]);
    return index >= 0 && index < pdf.numPages ? index + 1 : undefined;
  } catch { return undefined; }
}
export async function importPdf(file: File, signal: AbortSignal, onProgress: (message: string) => void = () => {}) {
  if (!file.size) throw new Error('The file is empty.');
  if (file.size > PDF_LIMITS.file) throw new Error('The PDF exceeds the 100 MiB limit.');
  signal.throwIfAborted();
  const bytes = new Uint8Array(await file.arrayBuffer());
  signal.throwIfAborted();
  if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error('The file has no valid PDF header.');
  const worker = new Worker(workerUrl, { type: 'module' });
  const pdfWorker = pdfjs.PDFWorker.create({ port: worker });
  const task = pdfjs.getDocument({
    data: bytes, worker: pdfWorker, useWasm: false,
    useSystemFonts: true, disableFontFace: true, maxImageSize: 1_000_000,
    cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
  });
  let timedOut = false;
  const terminate = () => { void task.destroy().catch(() => {}); pdfWorker.destroy(); worker.terminate(); };
  let passwordProtected = false;
  // Las tareas RPC pendientes no siempre rechazan al terminar el port: carrera explícita.
  let rejectStop: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_, reject) => { rejectStop = reject; });
  const abort = () => { terminate(); rejectStop(new DOMException('Import cancelled.', 'AbortError')); };
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; terminate(); rejectStop(new Error('PDF import exceeded 30 minutes. Try a smaller file.')); }, PDF_LIMITS.timeout);
  task.onPassword = () => { passwordProtected = true; terminate(); rejectStop(new Error('This PDF is password protected. Open a copy without a password.')); };
  const work = async () => {
    const pdf = await task.promise;
    validatePdfPageCount(pdf.numPages);
    const metadata = await pdf.getMetadata().catch(() => undefined);
    const info = metadata?.info as Record<string, unknown> | undefined;
    const pages: PdfPage[] = [];
    let chars = 0;
    let unknownFonts = 0;
    let documentLanguage: string | undefined;
    for (let number = 1; number <= pdf.numPages; number++) {
      signal.throwIfAborted();
      onProgress(`Extracting page ${number} of ${pdf.numPages}…`);
      const page = await pdf.getPage(number);
      const items: PdfItem[] = [];
      let pageChars = 0;
      const stream = page.streamTextContent().getReader();
      try {
        while (true) {
          const chunk = await stream.read(); if (chunk.done) break;
          if (!documentLanguage && typeof chunk.value.lang === 'string') documentLanguage = chunk.value.lang;
          for (const item of chunk.value.items) if ('str' in item) { items.push(item); pageChars += item.str.length; }
          if (items.length > PDF_LIMITS.items || pageChars > PDF_LIMITS.pageChars) throw new Error('A PDF page exceeds the text limit.');
          signal.throwIfAborted();
        }
      } finally { await stream.cancel().catch(() => {}); }
      chars += pageChars;
      if (chars > PDF_LIMITS.chars) throw new Error('The PDF exceeds the 50-million-character limit.');
      const operators = await page.getOperatorList();
      if (operators.fnArray.length > PDF_LIMITS.operators) throw new Error('A PDF page is too complex for this reader.');
      const fonts: Record<string, { italic: boolean; bold: boolean }> = {};
      for (const fontName of new Set(items.map(item => item.fontName))) {
        // PDF.js 6 expone booleanos en FontFaceObject, ya no el nombre de la versión 5.
        try {
          const font = await new Promise<{ italic?: boolean; bold?: boolean; black?: boolean }>(resolve => page.commonObjs.get(fontName, resolve));
          if (typeof font?.italic !== 'boolean' || typeof font?.bold !== 'boolean') unknownFonts++;
          fonts[fontName] = { italic: font?.italic === true, bold: font?.bold === true || font?.black === true };
        } catch { unknownFonts++; fonts[fontName] = { italic: false, bold: false }; }
      }
      const links: PdfLink[] = [];
      for (const annotation of await page.getAnnotations()) {
        let href = safePdfUrl(annotation.url || annotation.unsafeUrl);
        if (!href && annotation.dest) { const target = await destinationPage(pdf, annotation.dest); if (target) href = `#page-${target}`; }
        if (href) links.push({ href, rect: annotation.rect });
      }
      const imageOps = new Set([pdfjs.OPS.paintImageXObject, pdfjs.OPS.paintInlineImageXObject, pdfjs.OPS.paintImageMaskXObject]);
      pages.push({ number, chars: pageChars, blocks: reconstructPdfPage(items, fonts, links, number), links, images: operators.fnArray.some(op => imageOps.has(op)) });
      page.cleanup();
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const outline: PdfOutline[] = [];
    let visited = 0;
    type OutlineNodes = NonNullable<Awaited<ReturnType<typeof pdf.getOutline>>>;
    const visit = async (nodes: OutlineNodes, depth = 0): Promise<void> => {
      if (depth > 10) return;
      for (const node of nodes) {
        if (++visited > 1000) return;
        const page = await destinationPage(pdf, node.dest);
        if (page) outline.push({ title: node.title, page, depth });
        await visit(node.items, depth + 1);
      }
    };
    await visit(await pdf.getOutline() || []);
    onProgress('Preparing the text for reading…');
    const warnings: string[] = [];
    if (unknownFonts) warnings.push('Some font styles could not be recovered. The text is preserved.');
    if (pages.some(page => !page.chars)) warnings.push('Some pages have no extractable text. They are marked in the work; OCR is not applied.');
    const safeMetadata = (key: string) => typeof info?.[key] === 'string' ? info[key] as string : undefined;
    const languageValue = metadata?.metadata?.get('dc:language');
    const language = typeof languageValue === 'string' ? languageValue : Array.isArray(languageValue) && typeof languageValue[0] === 'string' ? languageValue[0] : undefined;
    return buildPdfSession(pages, outline, { title: safeMetadata('Title'), author: safeMetadata('Author'), language: language || documentLanguage }, warnings);
  };
  try {
    if (signal.aborted) abort();
    return await Promise.race([work(), stopped]);
  } catch (error) {
    if (signal.aborted) throw new DOMException('Import cancelled.', 'AbortError');
    if (passwordProtected) throw new Error('This PDF is password protected. Open a copy without a password.');
    if (timedOut) throw new Error('PDF import exceeded 30 minutes. Try a smaller file.');
    const name = error instanceof Error ? error.name : '';
    if (['InvalidPDFException', 'MissingPDFException', 'UnknownErrorException'].includes(name)) throw new Error('This PDF could not be read. It may be damaged or unsupported.');
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
    if (signal.aborted || timedOut || passwordProtected) terminate();
    else { try { await task.destroy(); } finally { pdfWorker.destroy(); worker.terminate(); } }
  }
}
