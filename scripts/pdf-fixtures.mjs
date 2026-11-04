import { mkdir, writeFile } from 'node:fs/promises';
const escape = value => value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
const text = (value, y, x = 72, font = 'F1', size = 12) => `BT /${font} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET\n`;
function pdf(contents, { outline = false, title = 'The house by the sea' } = {}) {
  const objects = [];
  const add = value => { objects.push(value); return objects.length; };
  add(''); add('');
  const regular = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const italic = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>');
  const pages = [];
  for (const content of contents) {
    const stream = add(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
    pages.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${regular} 0 R /F2 ${italic} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  const info = add(`<< /Title (${escape(title)}) /Author (Test author) >>`);
  let outlines = '';
  if (outline && pages.length >= 3) {
    const root = add(''); const first = add(''); const second = add('');
    objects[root - 1] = `<< /Type /Outlines /First ${first} 0 R /Last ${second} 0 R /Count 2 >>`;
    objects[first - 1] = `<< /Title (Chapter 1: The arrival) /Parent ${root} 0 R /Next ${second} 0 R /Dest [${pages[1]} 0 R /Fit] >>`;
    objects[second - 1] = `<< /Title (Chapter 2: The letter) /Parent ${root} 0 R /Prev ${first} 0 R /Dest [${pages[2]} 0 R /Fit] >>`;
    outlines = ` /Outlines ${root} 0 R`;
  }
  objects[0] = `<< /Type /Catalog /Pages 2 0 R /Lang (en)${outlines} >>`;
  objects[1] = `<< /Type /Pages /Kids [${pages.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  let body = '%PDF-1.7\n'; let byteOffset = Buffer.byteLength(body); const offsets = [0];
  objects.forEach((object, i) => { const part = `${i + 1} 0 obj\n${object}\nendobj\n`; offsets.push(byteOffset); body += part; byteOffset += Buffer.byteLength(part); });
  const xref = byteOffset;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return body;
}
await mkdir('tests/fixtures', { recursive: true });
await writeFile('tests/fixtures/demo.pdf', pdf([
  text('The house by the sea', 730, 150, 'F1', 22) + text('Summary:', 680, 100) + text('A story about returning home.', 650, 110) + text('Notes:', 600, 100) + text('Thank you for reading this synthetic story.', 570, 110),
  text('Chapter 1: The arrival', 740, 72, 'F1', 18) + text('Chapter Notes:', 700, 100) + text('A brief note before the story.', 670, 110) + text('The house waited by the sea.', 620) + text('She had come home at last.', 590, 72, 'F2') + text('<script>window.PDF_PWNED=true</script>', 550) + Array.from({ length: 15 }, (_, i) => text(`The afternoon brought a different memory, number ${i + 1}.`, 520 - i * 28)).join(''),
  text('Chapter 2: The letter', 740, 72, 'F1', 18) + text('There was a letter on the table.', 700) + text('Chapter End Notes:', 630, 100) + text('This is a final author note, outside the story.', 600, 110),
], { outline: true }));
await writeFile('tests/fixtures/sin-texto.pdf', pdf(['q 0.7 g 70 400 400 200 re f Q\n']));
await writeFile('tests/fixtures/corrupto.pdf', '%PDF-1.7\nNot a valid PDF');
await writeFile('tests/fixtures/continuo.pdf', pdf([text('A single page without chapter headings.', 730) + text('This paragraph is safe and readable.', 700)], { title: 'Continuous reading' }));
await writeFile('tests/fixtures/401-paginas.pdf', pdf(Array.from({ length: 401 }, (_, i) => text(`Page ${i + 1}: the story continues.`, 730)), { title: 'Over four hundred pages' }));
await writeFile('tests/fixtures/10001-paginas.pdf', pdf(Array.from({ length: 10001 }, () => ''), { title: 'Over the page limit' }));
await writeFile('tests/fixtures/enlace-notas.pdf', pdf([text('Chapter 1: A new day', 740, 72, 'F1', 18) + text('Chapter Notes', 710, 54) + text('See the end of the chapter for notes', 680, 54) + text('The common room was full of students.', 640, 66) + text('The story continues in its own space.', 610, 66) + text('*', 580, 66) + text('After the scene break.', 550, 66)], { title: 'Notes boundary regression' }));
await writeFile('tests/fixtures/titulo-notas.pdf', pdf([
  text('Rating: General audiences', 730) + text('Summary', 690) + text('A synthetic summary of this work.', 660),
  text('Chapter 1: A title that continues', 740, 72, 'F1', 18) + text('on the following line', 718, 140, 'F1', 18) + text('Chapter Notes', 675, 60) + text('A brief author note before the story.', 645, 85) + text('See the end of the chapter for more notes', 615, 60, 'F1', 9) + text('The fiction begins outside the notes.', 580, 60),
  text('Chapter 2: Home', 740, 72, 'F1', 18) + text('Another chapter.', 700),
], { title: 'Front matter and wrapped title' }));
