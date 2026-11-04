import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ZipReader, Uint8ArrayReader, TextWriter, configure } from '@zip.js/zip.js';
import { parseEpub } from '../src/features/importer/epub-parser';
import { resolvePath } from '../src/features/importer/paths';
import { sanitizeContent, contentId } from '../src/shared/security/sanitize-content';
configure({ useWebWorkers: false });
async function read(name: string) {
  const reader = new ZipReader(new Uint8ArrayReader(readFileSync(`tests/fixtures/${name}.epub`)));
  const files: Record<string, string> = {};
  for (const entry of await reader.getEntries()) if (!entry.directory) files[entry.filename] = await entry.getData(new TextWriter());
  await reader.close(); return parseEpub(files);
}
describe('EPUB y navegación', () => {
  it('EPUB3: spine, fragmentos, notas auxiliares y rutas codificadas', async () => {
    const session = await read('demo-epub3');
    expect(session.title).toBe('La casa de las mareas');
    expect(session.sections.filter(s => s.linear).map(s => s.path)).toEqual(['OPS/cap uno.xhtml', 'OPS/two.xhtml']);
    expect(session.toc).toHaveLength(3);
    expect(session.toc[1]).toMatchObject({ fragment: 'second', depth: 1 });
    expect(session.sections[0].html).toContain('data-path="OPS/notes.xhtml"');
    expect(session.sections[0].html).toContain('class="author-notes"');
    expect(session.sections[0].html).not.toContain('<details');
    expect(session.sections[0].html).toContain('<em>Había vuelto</em>');
  });
  it('EPUB2 con NCX', async () => expect((await read('demo-epub2')).toc).toHaveLength(2));
  it('separa notas en la estructura de exportación AO3 sin plegar el resumen ni el fic', async () => {
    const session = await read('ao3-estructura');
    const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
    expect(div.querySelectorAll('.author-notes')).toHaveLength(2);
    expect(div.querySelector('.author-notes')?.textContent).toContain('Nota inicial');
    expect(div.querySelectorAll('.author-notes')[1].textContent).toContain('Nota final');
    expect(Array.from(div.querySelectorAll('.author-notes')).some(node => node.textContent?.includes('El texto del fic'))).toBe(false);
    expect(Array.from(div.querySelectorAll('.author-notes')).some(node => node.textContent?.includes('Resumen que debe'))).toBe(false);
  });
  it('fallback sin índice y sin metadatos', async () => {
    expect((await read('sin-indice')).toc).toHaveLength(2);
    expect((await read('sin-metadatos')).title).toBe('Untitled work');
  });
  it.each(['referencia-ausente', 'maquetacion-fija', 'opf-invalido', 'no-es-epub'])('rechaza %s', async name => { await expect(read(name)).rejects.toThrow(); });
  it('rechaza rutas fuera del contenedor', () => {
    for (const path of ['../../escape.xhtml', 'https://evil.test/a', '//evil.test/a', '%2foutside', '%5cfile']) expect(() => resolvePath('OPS/a.xhtml', path)).toThrow();
    expect(resolvePath('OPS/a.xhtml', '../b.xhtml#n')).toEqual({ path: 'b.xhtml', fragment: 'n' });
  });
});
describe('frontera de seguridad', () => {
  it('elimina recursos, CSS, scripts, eventos y protocolos activos', () => {
    const safe = sanitizeContent('<p id="contenido" style="color:red" onclick="alert(1)">Hola</p><img src="https://evil.test/a" alt="Mar"/><script>alert(1)</script><svg onload="alert(1)"></svg><a href="javascript:alert(1)">x</a><iframe src="https://evil.test"></iframe><a href="https://example.org">Externo</a>', 'OPS/a.xhtml', new Set(['OPS/a.xhtml']));
    expect(safe).not.toMatch(/<script|<iframe|<svg|onclick|style=|src=|javascript:/);
    expect(safe).toContain('[Image omitted: Mar]');
    expect(safe).toContain('noopener noreferrer');
    expect(safe).toContain(contentId('OPS/a.xhtml', 'contenido'));
  });
  it('conserva párrafos de historia y separa únicamente notas marcadas', () => {
    const safe = sanitizeContent('<p>Notas era el nombre de la aldea.</p><div class="notes"><p>Gracias</p></div>', 'a.xhtml', new Set(['a.xhtml']));
    expect((safe.match(/class="author-notes"/g) || []).length).toBe(1);
    expect(safe).toContain('<p>Notas era el nombre de la aldea.</p>');
  });
});
