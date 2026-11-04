import { expect, it } from 'vitest';
import { buildPdfSession, reconstructPdfPage, safePdfUrl, type PdfItem, type PdfPage } from '../src/features/importer/pdf-reconstruction';
import { validatePdfPageCount } from '../src/features/importer/pdf-limits';
import { sanitizeContent } from '../src/shared/security/sanitize-content';
const item = (str: string, y: number, x = 72, fontName = 'normal'): PdfItem => ({ str, height: 12, width: str.length * 6, fontName, transform: [12, 0, 0, 12, x, y] });
const page = (number: number, items: PdfItem[]): PdfPage => ({ number, blocks: reconstructPdfPage(items, { italic: { italic: true } }, [], number), links: [], images: false, chars: items.reduce((sum, item) => sum + item.str.length, 0) });
const sized = (str: string, y: number, x: number, size: number) => ({ ...item(str, y, x), height: size, transform: [size, 0, 0, size, x, y] });
it('conserva los datos y resumen sin contarlos como capítulo', () => {
  const session = buildPdfSession([page(1, [item('Rating: General audiences', 700), item('Summary', 660), item('A synthetic summary.', 630)]), page(2, [item('Chapter 1: Home', 750), item('Story.', 700)]), page(3, [item('Chapter 2: Sea', 750), item('More story.', 700)])], [], {});
  expect(session.sections[0]).toMatchObject({ title: 'Work details', role: 'frontmatter' });
  expect(session.sections.filter(section => section.role !== 'frontmatter')).toHaveLength(2);
  expect(session.sections[0].html).toContain('A synthetic summary.');
});
it('une las líneas de un título y no consume el cuerpo ni el siguiente encabezado', () => {
  const session = buildPdfSession([page(1, [sized('Chapter 3: A very long title', 750, 90, 18), sized('continued on the next line', 728, 160, 18), item('Chapter Notes', 690), item('Short author note.', 660, 100), item('Story starts here.', 620)])], [], {});
  expect(session.sections[0].title).toBe('Chapter 3: A very long title continued on the next line');
  const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
  expect(div.querySelector('h2')).toBeNull(); // Se muestra una sola vez, en la cabecera del lector.
  expect(div.textContent).toContain('Story starts here.');
});
it('separa la nota, la referencia pequeña con more notes y el fic', () => {
  const session = buildPdfSession([page(1, [item('Chapter 1: Home', 750), item('Chapter Notes', 720, 60), item('An author note.', 685, 85), sized('See the end of the chapter for more notes', 655, 60, 9), item('The fiction starts here.', 620, 60)])], [], {});
  const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
  expect(div.querySelector('.author-notes')?.textContent).toContain('An author note.');
  expect(div.querySelector('.author-notes')?.textContent).toContain('for more notes');
  expect(div.querySelector('.author-notes')?.textContent).not.toContain('The fiction');
});
it('cierra notas sin enlace cuando vuelve el margen o aumenta la letra', () => {
  for (const [noteX, noteSize, bodyX, bodySize] of [[85, 12, 60, 12], [60, 10, 60, 12]]) {
    const session = buildPdfSession([page(1, [item('Chapter 1', 750), item('Chapter Notes', 720, 60), sized('Short note.', 690, noteX, noteSize), sized('Fiction begins.', 675, bodyX, bodySize)])], [], {});
    const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
    expect(div.querySelector('.author-notes')?.textContent).toContain('Short note.');
    expect(div.querySelector('.author-notes')?.textContent).not.toContain('Fiction begins.');
  }
});
it('reconstruye párrafos y mantiene énfasis sin insertar HTML del PDF', () => {
  const session = buildPdfSession([page(1, [item('La primera linea', 700), item('continua aqui.', 685), item('<script>hostil</script>', 650, 72, 'italic')])], [], {});
  expect(session.sections).toHaveLength(1);
  expect(session.sections[0].html).toContain('La primera linea continua aqui.');
  expect(session.sections[0].html).toContain('<em>&lt;script&gt;hostil&lt;/script&gt;</em>');
});
it('no crea un prefacio vacío; separa capítulos y notas por sangría', () => {
  const session = buildPdfSession([page(1, [item('Chapter 1: Home', 750), item('Chapter Notes', 720, 100), item('An author note.', 690, 110), item('The story begins here.', 640), item('Chapter 2: Sea', 580), item('The second story.', 550)])], [], {});
  expect(session.sections.map(section => section.title)).toEqual(['Chapter 1: Home', 'Chapter 2: Sea']);
  const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
  expect(div.querySelector('.author-notes')?.textContent).toContain('An author note.');
  expect(div.querySelector('.author-notes')?.textContent).not.toContain('The story');
  expect(div.querySelector('details')).toBeNull();
});
it('marcadores sirven de fallback y no se convierten en orden arbitrario', () => {
  const session = buildPdfSession([page(1, [item('Primera parte.', 700)]), page(2, [item('Segunda parte.', 700)])], [{ title: 'Chapter 1', page: 1, depth: 0 }, { title: 'Chapter 2', page: 2, depth: 0 }, { title: 'Roto', page: 0, depth: 0 }], {});
  expect(session.sections).toHaveLength(2);
  expect(session.toc.some(entry => entry.label === 'Roto')).toBe(false);
});
it('enlaces entre páginas se reescriben a su sección segura', () => {
  const a = page(1, [item('Chapter 1', 750), item('Ir a la nota', 700)]);
  a.blocks[1].runs[0].href = '#page-2';
  const session = buildPdfSession([a, page(2, [item('Chapter 2', 750), item('La nota.', 700)])], [], {});
  expect(session.sections[0].html).toContain('data-path="pdf/section-2.xhtml"');
  expect(session.sections[0].html).toContain('data-fragment="page-2"');
});
it('PDF sin texto informa limitación de OCR', () => {
  expect(() => buildPdfSession([{ ...page(1, []), images: true }], [], {})).toThrow('OCR');
  for (const url of ['javascript:alert(1)', 'file:///secret', 'data:text/html,test']) expect(safePdfUrl(url)).toBeUndefined();
});
it('acepta más de 400 páginas hasta 10 000 y rechaza 10 001', () => {
  for (const count of [401, 1000, 10_000]) expect(() => validatePdfPageCount(count)).not.toThrow();
  expect(() => validatePdfPageCount(10_001)).toThrow('10 000');
});
it('el enlace a notas finales no convierte el fic en notas, aunque el fic tenga más sangría', () => {
  const session = buildPdfSession([page(1, [item('Chapter 1', 750), item('Chapter Notes', 720, 54), item('See the end of the chapter for notes', 690, 54), item('The common room was full of students.', 650, 66), item('The story continues in another paragraph.', 615, 66)])], [], {});
  const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
  expect(div.querySelector('.author-notes')?.textContent).toContain('See the end');
  expect(div.querySelector('.author-notes')?.textContent).not.toContain('The common room');
  expect(div.textContent).toContain('The story continues');
});
it('aísla el adorno entre dos líneas de cuerpo y lo marca como separador centrado', () => {
  const blocks = page(1, [item('Before the scene break.', 700), item('☙❀❧', 685), item('After the scene break.', 670)]);
  expect(blocks.blocks).toHaveLength(3);
  const session = buildPdfSession([blocks], [], {});
  const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
  expect(div.querySelector('.scene-separator')?.textContent).toBe('☙❀❧');
  expect(div.querySelector('.scene-separator')?.tagName).toBe('P');
});
it('centra cualquier línea aislada de signos o adornos en PDF y EPUB', () => {
  for (const separator of ['*', '**', '* * *', '⁂', '⁑', '⁎', '⁕', '※', '☙❀❧', '.', '#', '§', '༄༅༄', '〰️', '🌙 ✨ 🌙', '👩‍🚀', '!? / : ;', '─'.repeat(80)]) {
    const session = buildPdfSession([page(1, [item('Before.', 700), item(separator, 685), item('After.', 670)])], [], {});
    const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
    expect(div.querySelector('.scene-separator')?.textContent).toBe(separator);
    div.innerHTML = sanitizeContent(`<p>${separator}</p><p>A * word.</p><p>Normal sentence.</p><p>123</p><p> </p>`, 'story.xhtml', new Set(['story.xhtml']));
    expect(div.querySelectorAll('.scene-separator')).toHaveLength(1);
    expect(div.querySelector('.scene-separator')?.textContent).toBe(separator);
  }
});
it('omite anotaciones sin texto sin borrar los enlaces que pertenecen a la obra', () => {
  const first = page(1, [item('Work information.', 750)]);
  first.links = [{ href: 'https://example.org/unmapped' }, { href: 'https://example.org/another' }];
  first.blocks[0].runs = [{ text: 'Work information.', href: 'https://example.org/work' }];
  const session = buildPdfSession([first, page(2, [item('Chapter 1', 750), item('Story.', 700)])], [], {});
  expect(session.sections[0].html).not.toContain('Enlace de la página');
  expect(session.sections[0].html).not.toContain('https://example.org/unmapped');
  expect(session.sections[0].html).toContain('https://example.org/work');
});
