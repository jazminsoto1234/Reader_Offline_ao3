import { expect, it } from 'vitest';
import { buildPdfSession, reconstructPdfPage, safePdfUrl, type PdfItem, type PdfPage } from '../src/features/importer/pdf-reconstruction';
import { validatePdfPageCount } from '../src/features/importer/pdf-limits';
import { sanitizeContent } from '../src/shared/security/sanitize-content';
const item = (str: string, y: number, x = 72, fontName = 'normal'): PdfItem => ({ str, height: 12, width: str.length * 6, fontName, transform: [12, 0, 0, 12, x, y] });
const page = (number: number, items: PdfItem[], center?: number): PdfPage => ({ number, blocks: reconstructPdfPage(items, { italic: { italic: true } }, [], number, center), links: [], images: false, chars: items.reduce((sum, item) => sum + item.str.length, 0) });
const sized = (str: string, y: number, x: number, size: number) => ({ ...item(str, y, x), height: size, transform: [size, 0, 0, size, x, y] });
it('conserva los datos y resumen sin contarlos como capítulo', () => {
  const session = buildPdfSession([page(1, [item('Rating: General audiences', 700), item('Summary', 660), item('A synthetic summary.', 630)]), page(2, [item('Chapter 1: Home', 750), item('Story.', 700)]), page(3, [item('Chapter 2: Sea', 750), item('More story.', 700)])], [], {});
  expect(session.sections[0]).toMatchObject({ title: 'Work details', role: 'frontmatter' });
  expect(session.sections.filter(section => section.role !== 'frontmatter')).toHaveLength(2);
  expect(session.sections[0].html).toContain('A synthetic summary.');
});
it('detecta capítulos de AO3 por el formato de los títulos y conserva los subtítulos internos', () => {
  const centered = (text: string, y: number, size: number) => sized(text, y, 300 - text.length * 3, size);
  const session = buildPdfSession([
    page(1, [
      centered('The work title', 750, 20),
      item('Posted originally on the Archive of Our Own', 710),
      item('Rating: General Audiences', 685),
      centered('The work title', 650, 18),
      centered('One', 580, 18),
      item('Chapter Notes', 550),
      item('An opening note.', 520, 95),
      centered('I', 480, 12),
      item('Something about today felt off.', 450),
      item('He opened the window.', 420),
    ], 300),
    page(2, [
      centered('After the rain', 750, 18),
      item('Chapter Notes', 720),
      item('Another note.', 690, 95),
      centered('II', 650, 12),
      item('She looked outside.', 620),
      item('The sky was clear.', 590),
    ], 300),
  ], [], {});
  expect(session.sections.map(section => section.title)).toEqual(['Work details', 'One', 'After the rain']);
  expect(session.sections[0].role).toBe('frontmatter');
  expect(session.sections[2].html).toContain('>II</p>');
  expect(session.sections[2].html).toContain('She looked outside.');
  expect(session.sections[2].html).toContain('author-notes');
});
it('separa la ficha y las notas finales de un PDF de AO3 sin encabezado de capítulo', () => {
  const session = buildPdfSession([
    page(1, [
      item('A title before the export notice', 750),
      item('Posted originally on the Archive of Our Own', 737),
      item('Rating: General Audiences', 700),
      item('Summary', 660),
      item('The work summary.', 620, 95),
      item('Notes', 580),
      item('The opening note.', 540, 95),
      item('See the end of the work for more notes', 500),
      item('The story begins here.', 460),
      item('End Notes', 420),
      item('Thanks for reading!', 380, 95),
      item('Please drop by the Archive and comment to let the creator know if you enjoyed their work!', 340),
    ]),
  ], [], {});
  const [details, story] = session.sections;
  expect(details).toMatchObject({ title: 'Work details', role: 'frontmatter' });
  expect(details.html).toContain('The work summary.');
  expect(details.html).toContain('Rating: General Audiences');
  expect(details.html).toContain('The opening note.');
  expect(details.html).not.toContain('The story begins here.');
  expect(story.path).toBe('pdf/section-1.xhtml');
  const div = document.createElement('div');
  div.innerHTML = story.html;
  expect(div.textContent).toContain('The story begins here.');
  expect(div.textContent).not.toContain('Rating:');
  const notes = div.querySelector('.author-notes');
  expect(notes?.textContent).toContain('End Notes');
  expect(notes?.textContent).toContain('Thanks for reading!');
  expect(notes?.textContent).not.toContain('The story begins here.');
  expect(div.textContent).not.toContain('drop by the Archive');
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
it('mantiene diálogos y oraciones en su párrafo según el espaciado del PDF', () => {
  const blocks = page(1, [
    item('Ella ya lo sabía.', 700),
    item('“Te esperaba”, dijo.', 685),
    item('Entonces cerró la puerta.', 670),
    item('—Debemos irnos —respondió él.', 640),
    item('Se levantó sin mirar atrás.', 625),
  ]).blocks;
  expect(blocks.map(block => block.runs.map(run => run.text).join(''))).toEqual([
    'Ella ya lo sabía. “Te esperaba”, dijo. Entonces cerró la puerta.',
    '—Debemos irnos —respondió él. Se levantó sin mirar atrás.',
  ]);
});
it('separa turnos y narración cuando predominan los espacios entre párrafos', () => {
  const session = buildPdfSession([page(1, [
    item('“Look at me.”', 700),
    item('“We were friends, weren’t we?”', 678),
    item('“We were children.”', 656),
    item('He lowered his head and rested his chin', 634),
    item('on her shoulder. “You smell nice,” he said.', 621),
    item('“What?!”', 599),
  ])], [], {});
  const div = document.createElement('div');
  div.innerHTML = session.sections[0].html;
  expect(Array.from(div.querySelectorAll('p'), paragraph => paragraph.textContent)).toEqual([
    '“Look at me.”',
    '“We were friends, weren’t we?”',
    '“We were children.”',
    'He lowered his head and rested his chin on her shoulder. “You smell nice,” he said.',
    '“What?!”',
  ]);
});
it('conserva las comillas y los espacios reales en fragmentos de una misma línea', () => {
  const [block] = page(1, [item('“', 700, 72), item('Hola', 700, 81, 'italic'), item('”', 700, 108), item(' ', 700, 114), item('dijo.', 700, 120)]).blocks;
  expect(block.runs.map(run => run.text).join('')).toBe('“Hola” dijo.');
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
it.each(['', '<blockquote><p>An opening author note.</p></blockquote>'])('reconoce Chapter Notes en EPUB con enlace a las notas finales (%s)', quote => {
  const div = document.createElement('div');
  div.innerHTML = sanitizeContent(
    `<p>Chapter Notes</p>${quote}<p>See the end of the chapter for more <a href="#endnotes1">notes</a></p><p>The story begins.</p><div id="endnotes1"><p>Chapter End Notes</p><p>A final note.</p></div>`,
    'chapter.xhtml', new Set(['chapter.xhtml']),
  );
  const [opening, ending] = div.querySelectorAll('.author-notes');
  expect(opening?.querySelector('h3')?.textContent).toBe('Chapter Notes');
  expect(opening?.querySelector('a')?.getAttribute('data-fragment')).toBe('endnotes1');
  if (quote) expect(opening?.querySelector('blockquote')?.textContent).toBe('An opening author note.');
  expect(opening?.textContent).not.toContain('The story begins.');
  expect(ending?.querySelector('h3')?.textContent).toBe('Chapter End Notes');
});
it('el enlace a notas finales no convierte el fic en notas, aunque el fic tenga más sangría', () => {
  const session = buildPdfSession([page(1, [item('Chapter 1', 750), item('Chapter Notes', 720, 54), item('See the end of the chapter for notes', 690, 54), item('The common room was full of students.', 650, 66), item('The story continues in another paragraph.', 615, 66)])], [], {});
  const div = document.createElement('div'); div.innerHTML = session.sections[0].html;
  expect(div.querySelector('.author-notes')?.textContent).toContain('See the end');
  expect(div.querySelector('.author-notes')?.textContent).not.toContain('The common room');
  expect(div.textContent).toContain('The story continues');
});
it('une la raya y la comilla de cierre de un diálogo partido sin perder el separador real', () => {
  for (const closingQuote of ['"', '”', '»']) {
    const session = buildPdfSession([page(1, [
      item('"At least the two of you could', 700),
      item(`—${closingQuote}`, 685),
      item('"I am staying with you."', 655),
      item('———', 625),
      item('The next morning.', 595),
    ])], [], {});
    const div = document.createElement('div');
    div.innerHTML = session.sections[0].html;
    expect(div.querySelector('p')?.textContent).toBe(`"At least the two of you could—${closingQuote}`);
    expect(Array.from(div.querySelectorAll('.scene-separator'), node => node.textContent)).toEqual(['———']);
  }
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
