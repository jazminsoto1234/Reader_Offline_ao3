import type { ReadingSession, Section, TocEntry } from '../../domain/reading-session';
import { sanitizeContent } from '../../shared/security/sanitize-content';
import { isSceneSeparator } from '../../shared/security/scene-separator';
import { PDF_LIMITS } from './pdf-limits';

export interface PdfItem { str: string; height: number; width: number; fontName: string; transform: number[]; hasEOL?: boolean }
export interface PdfRun { text: string; italic?: boolean; bold?: boolean; href?: string }
export interface PdfBlock { kind: 'p' | 'h2' | 'h3'; runs: PdfRun[]; page: number; size: number; x: number; separator?: boolean; fragment?: string }
export interface PdfLink { href: string; rect?: number[] }
export interface PdfPage { number: number; blocks: PdfBlock[]; links: PdfLink[]; images: boolean; chars: number }
export interface PdfOutline { title: string; page: number; depth: number }
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
export function safePdfUrl(value: string | undefined): string | undefined {
  try { const url = new URL(value || ''); return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; }
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] || 0;
const blockText = (block: PdfBlock) => block.runs.map(run => run.text).join('').trim();
const isEndNotesReference = (text: string) => /^(?:see (?:the )?end of (?:the |this )?chapter for (?:more )?notes|(?:ver|consulta|véanse) (?:las )?notas al final del capítulo)[.!\s]*$/i.test(text);
export function reconstructPdfPage(items: PdfItem[], fonts: Record<string, { italic?: boolean; bold?: boolean }>, links: PdfLink[], number: number): PdfBlock[] {
  const lines: { y: number; x: number; size: number; items: PdfItem[] }[] = [];
  for (const item of items.filter(item => item.str.trim()).sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4])) {
    const y = item.transform[5], x = item.transform[4], size = Math.abs(item.height || item.transform[3]);
    let line = lines.at(-1);
    if (!line || Math.abs(line.y - y) >= Math.max(1.5, size * .22)) { line = { y, x, size, items: [] }; lines.push(line); }
    line.items.push(item); line.size = Math.max(line.size, size); line.x = Math.min(line.x, x);
  }
  const spacing = median(lines.slice(1).map((line, i) => lines[i].y - line.y).filter(gap => gap > 7 && gap < 30)) || 15;
  const blocks: PdfBlock[] = [];
  let previousLine: typeof lines[number] | undefined;
  for (const line of lines) {
    const runs: PdfRun[] = [];
    let end: number | undefined;
    for (const item of line.items.sort((a, b) => a.transform[4] - b.transform[4])) {
      const x = item.transform[4];
      if (end !== undefined && x - end > line.size * .14 && !runs.at(-1)?.text.endsWith(' ') && !item.str.startsWith(' ')) runs.push({ text: ' ' });
      const link = links.find(link => { const rect = link.rect; return rect && x + item.width > Math.min(rect[0], rect[2]) + 1 && x < Math.max(rect[0], rect[2]) - 1 && item.transform[5] >= Math.min(rect[1], rect[3]) - 2 && item.transform[5] <= Math.max(rect[1], rect[3]) + 2; });
      runs.push({ text: item.str, ...fonts[item.fontName], href: link?.href });
      end = x + item.width;
    }
    const label = runs.map(run => run.text).join('').trim();
    const chapter = /^(?:chapter|capítulo|capitulo)\s+\d+(?:\s*[:.\-–—].*)?$/i.test(label);
    const noteHeading = /^(?:(?:chapter(?: end)? )?notes|summary|resumen|notas(?: (?:iniciales|finales|del capítulo))?)\s*:?$/i.test(label);
    const kind = chapter ? 'h2' : noteHeading ? 'h3' : 'p';
    const separator = isSceneSeparator(label);
    const previous = blocks.at(-1);
    // Un título de AO3 puede ocupar varias líneas físicas del mismo tamaño.
    // Se conserva como un solo encabezado; el cuerpo y las notas son más pequeños.
    if (previous?.kind === 'h2' && previousLine && kind === 'p' && !separator && line.size >= 14 && Math.abs(previous.size - line.size) < .8 && previousLine.y - line.y <= spacing * 1.6) {
      previous.runs.push({ text: ' ' }, ...runs);
      previousLine = line;
      continue;
    }
    const dialogue = /^[“"«—–]/.test(label) && /[.!?…»”"]$/.test(previous ? blockText(previous) : '');
    const paragraph = !previous || !previousLine || kind !== 'p' || previous.kind !== 'p' || separator || previous.separator || isEndNotesReference(label) || isEndNotesReference(blockText(previous)) || previousLine.y - line.y > spacing * 1.38 || Math.abs(previousLine.size - line.size) > 1.2 || Math.abs(line.x - previousLine.x) > line.size * 1.5 || dialogue;
    if (paragraph) blocks.push({ kind, runs, page: number, size: line.size, x: line.x, separator });
    else previous.runs.push({ text: ' ' }, ...runs);
    previousLine = line;
  }
  return blocks;
}

function removeRepeatedMargins(pages: PdfPage[]) {
  if (pages.length < 3) return;
  // Solo bordes de página, coincidencia repetida en la mayoría y con tamaño menor al cuerpo.
  const counts = new Map<string, number>();
  const normalize = (block: PdfBlock) => /^\d+$/.test(blockText(block)) ? '#page-number' : blockText(block);
  for (const page of pages) for (const key of new Set([page.blocks[0], page.blocks.at(-1)].filter((b): b is PdfBlock => !!b && b.kind === 'p' && b.size < 11).map(normalize))) counts.set(key, (counts.get(key) || 0) + 1);
  const repeated = new Set([...counts].filter(([, count]) => count >= Math.max(3, Math.ceil(pages.length * .7))).map(([key]) => key));
  for (const page of pages) page.blocks = page.blocks.filter((block, i, blocks) => !((i === 0 || i === blocks.length - 1) && block.kind === 'p' && block.size < 11 && repeated.has(normalize(block))));
}

export function buildPdfSession(pages: PdfPage[], outline: PdfOutline[], metadata: { title?: string; author?: string; language?: string }, warnings: string[] = []): ReadingSession {
  if (!pages.some(page => page.chars > 0)) throw new Error('This PDF has no extractable text. It may be scanned or contain only images. OCR is not applied.');
  removeRepeatedMargins(pages);
  const validOutline = outline.filter((entry, i) => entry.page >= 1 && entry.page <= pages.length && (i === 0 || entry.page >= outline[i - 1].page));
  const sections: Section[] = [], toc: TocEntry[] = [];
  const pagePaths = new Map<number, string>();
  const bodies: { section: Section; blocks: (PdfBlock | { html: string })[] }[] = [];
  const newSection = (title: string) => {
    const section = { id: `pdf-${sections.length + 1}`, path: `pdf/section-${sections.length + 1}.xhtml`, title, linear: true, html: '' };
    sections.push(section); const body = { section, blocks: [] as (PdfBlock | { html: string })[] }; bodies.push(body); return body;
  };
  const hasHeadings = pages.some(page => page.blocks.some(block => block.kind === 'h2'));
  const hasChapters = hasHeadings || validOutline.some(entry => entry.depth === 0 && /^(?:chapter|capítulo|capitulo)\s+\d+/i.test(entry.title));
  let body: typeof bodies[number] | undefined;
  let chapterCount = 0;
  for (const page of pages) {
    const marker = validOutline.find(entry => entry.page === page.number && entry.depth === 0 && /^(?:chapter|capítulo|capitulo)\s+\d+/i.test(entry.title));
    if (!hasHeadings && marker) body = newSection(marker.title);
    if (!body) body = newSection(hasChapters ? 'Work details' : 'Continuous reading');
    const firstChapter = page.blocks.findIndex(block => block.kind === 'h2');
    // El marcador de página sigue el inicio del contenido, incluso al partir un capítulo.
    if (firstChapter !== 0) { body.blocks.push({ html: `<span id="page-${page.number}"></span>` }); pagePaths.set(page.number, body.section.path); }
    for (const block of page.blocks) {
      if (block.kind === 'h2') {
        chapterCount++;
        if (chapterCount > PDF_LIMITS.chapters) throw new Error('The PDF exceeds the limit of 10 000 detected chapters.');
        if (body.blocks.length === 0) body.section.title = blockText(block);
        else body = newSection(blockText(block));
        block.fragment = `chapter-${chapterCount}`;
        if (firstChapter === 0 && !pagePaths.has(page.number)) { body.blocks.push({ html: `<span id="page-${page.number}"></span>` }); pagePaths.set(page.number, body.section.path); }
      }
      body.blocks.push(block);
    }
    if (page.images || !page.chars) body.blocks.push({ html: `<p lang="en">[Page ${page.number}: ${page.images ? 'images omitted' : 'no extractable text; possibly a blank or scanned page'}]</p>` });
    // Solo enlaces asociados al texto: no inventar listas de anotaciones sin etiqueta.
  }
  // La portada, etiquetas y resumen siguen accesibles, pero no son un capítulo.
  if (sections.length > 1 && sections[0].title === 'Work details') sections[0].role = 'frontmatter';
  const available = new Set(sections.map(section => section.path));
  const runHtml = (run: PdfRun) => {
    let html = escapeHtml(run.text);
    if (run.italic) html = `<em>${html}</em>`;
    if (run.bold) html = `<strong>${html}</strong>`;
    let href = safePdfUrl(run.href);
    if (run.href?.match(/^#page-\d+$/)) {
      const page = Number(run.href.slice(6)); const path = pagePaths.get(page);
      if (path) href = `${path.split('/').at(-1)}#page-${page}`;
    }
    return href ? `<a href="${escapeHtml(href)}">${html}</a>` : html;
  };
  for (const entry of bodies) {
    let html = ''; let inNotes = false;
    let initialNotes = false;
    let lastParagraphX: number | undefined;
    let lastParagraphSize: number | undefined;
    for (const block of entry.blocks) {
      if ('html' in block) { html += block.html; continue; }
      const label = blockText(block);
      const notesHeading = block.kind === 'h3' && /notes|notas/i.test(label);
      const summaryHeading = block.kind === 'h3' && /summary|resumen/i.test(label);
      if (notesHeading || summaryHeading) {
        if (inNotes) html += '</section>';
        html += `<section class="notes"><h3>${escapeHtml(label)}</h3>`; inNotes = true; lastParagraphX = undefined; lastParagraphSize = undefined;
        initialNotes = notesHeading && !/end|finales/i.test(label);
        continue;
      }
      // En PDF la sangría de AO3 es una pista conservadora para cerrar notas iniciales.
      if (inNotes && initialNotes && block.kind === 'p') {
        const leavesIndent = lastParagraphX !== undefined && block.x + Math.max(6, block.size * .5) < lastParagraphX;
        const returnsToBodySize = lastParagraphSize !== undefined && block.size > lastParagraphSize * 1.12;
        if (!isEndNotesReference(label) && (leavesIndent || returnsToBodySize)) { html += '</section>'; inNotes = false; }
      }
      if (inNotes && block.separator && initialNotes) { html += '</section>'; inNotes = false; }
      if (block.kind === 'h2' && inNotes) { html += '</section>'; inNotes = false; }
      if (block.kind === 'p') { lastParagraphX = block.x; lastParagraphSize = block.size; }
      html += `<${block.kind}${block.fragment ? ` id="${block.fragment}"` : ''}>${block.runs.map(runHtml).join('')}</${block.kind}>`;
      if (inNotes && initialNotes && isEndNotesReference(label)) { html += '</section>'; inNotes = false; }
    }
    if (inNotes) html += '</section>';
    entry.section.html = sanitizeContent(html, entry.section.path, available, entry.section.title);
    toc.push({ label: entry.section.title, path: entry.section.path, fragment: '', depth: 0 });
  }
  // Añadir marcadores válidos como destinos secundarios sin alterar la secuencia editorial.
  for (const entry of validOutline) {
    const path = pagePaths.get(entry.page);
    if (path && !toc.some(item => item.label === entry.title)) toc.push({ label: entry.title, path, fragment: `page-${entry.page}`, depth: entry.depth + 1 });
  }
  const language = metadata.language || 'und';
  return { title: metadata.title || 'PDF document', author: metadata.author || 'Unknown author', language: /^[a-zA-Z0-9-]{2,35}$/.test(language) ? language : 'und', sections, toc, format: 'pdf', warnings: ['PDF converted to text: paragraph, chapter, and note boundaries are approximate. Images and complex layouts are not reproduced.', ...warnings] };
}
