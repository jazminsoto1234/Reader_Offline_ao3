import { ZipWriter, Uint8ArrayWriter, TextReader, configure } from '@zip.js/zip.js';
import { mkdir, writeFile } from 'node:fs/promises';
configure({ useWebWorkers: false });
export const wrap = text => `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Lectura de prueba</title></head><body>${text}</body></html>`;
export function fixtureFiles({ version = 3, noToc = false, missing = false, noMetadata = false, fixed = false, badOpf = false } = {}) {
  const files = {
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': '<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
    'OPS/book.opf': badOpf ? '<package>' : `<package xmlns="http://www.idpf.org/2007/opf" version="${version}.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/">${noMetadata ? '' : '<dc:title>La casa de las mareas</dc:title><dc:creator>Una autora de prueba</dc:creator><dc:language>es</dc:language>'}${fixed ? '<meta property="rendition:layout">pre-paginated</meta>' : ''}</metadata><manifest><item id="one" href="cap%20uno.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/><item id="notes" href="notes.xhtml" media-type="application/xhtml+xml"/>${noToc ? '' : version === 3 ? '<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>' : '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>'}</manifest><spine ${version === 2 && !noToc ? 'toc="ncx"' : ''}><itemref idref="one"/><itemref idref="two"/><itemref idref="notes" linear="no"/></spine></package>`,
    'OPS/cap uno.xhtml': wrap(`<h2 id="start">Capítulo 1: La llegada</h2><div class="notes"><h3>Notas iniciales</h3><p>Una nota antes de comenzar. Gracias por leer.</p></div><div class="userstuff"><p>La casa esperaba junto al mar. <em>Había vuelto</em>, después de tantos años.</p>${Array.from({ length: 18 }, (_, i) => `<p>La tarde ${i + 1} trajo olor a sal y ventanas abiertas. Cada habitación guardaba una historia que aún quería escuchar.</p>`).join('')}<h3 id="second">Una segunda escena</h3><p>Otro destino dentro del mismo archivo.</p><a href="notes.xhtml#n1">Leer nota al pie</a><img src="https://invalid.example/tracker.png" alt="El mar"/><script>window.PWNED=true</script><p onclick="window.PWNED=true" style="background:url(https://invalid.example/css)">Texto seguro</p><a href="javascript:alert(1)">Peligroso</a><iframe src="https://invalid.example/frame"></iframe></div><div class="endnotes"><p>Una nota al final, separada de la historia.</p></div>`),
    'OPS/two.xhtml': wrap('<h2 id="start">Capítulo 2: Las cartas</h2><p>Sobre la mesa había una carta, doblada en cuatro.</p><blockquote><p>Vuelve cuando cambie la marea.</p></blockquote><p><strong>Y decidió quedarse.</strong></p><a href="cap%20uno.xhtml#second">Volver a la segunda escena</a>'),
    'OPS/notes.xhtml': wrap('<aside class="footnotes"><p id="n1">Nota al pie de prueba. <a href="cap%20uno.xhtml#second">Volver al texto</a></p></aside>'),
  };
  if (!noToc && version === 3) files['OPS/nav.xhtml'] = wrap('<nav xmlns:epub="http://www.idpf.org/2007/ops" epub:type="toc"><ol><li><a href="cap%20uno.xhtml#start">Capítulo 1: La llegada</a><ol><li><a href="cap%20uno.xhtml#second">Una segunda escena</a></li></ol></li><li><a href="two.xhtml#start">Capítulo 2: Las cartas</a></li></ol></nav>');
  if (!noToc && version === 2) files['OPS/toc.ncx'] = '<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint id="a"><navLabel><text>Capítulo 1: La llegada</text></navLabel><content src="cap%20uno.xhtml#start"/></navPoint><navPoint id="b"><navLabel><text>Capítulo 2: Las cartas</text></navLabel><content src="two.xhtml#start"/></navPoint></navMap></ncx>';
  if (missing) delete files['OPS/two.xhtml'];
  return files;
}
export async function zipFiles(files) {
  const zip = new ZipWriter(new Uint8ArrayWriter());
  for (const [name, text] of Object.entries(files)) await zip.add(name, new TextReader(text), { level: name === 'mimetype' ? 0 : 6 });
  return zip.close();
}
await mkdir('tests/fixtures', { recursive: true });
for (const [name, options] of Object.entries({ 'demo-epub3': {}, 'demo-epub2': { version: 2 }, 'sin-indice': { noToc: true }, 'sin-metadatos': { noMetadata: true }, 'referencia-ausente': { missing: true }, 'maquetacion-fija': { fixed: true }, 'opf-invalido': { badOpf: true } })) await writeFile(`tests/fixtures/${name}.epub`, await zipFiles(fixtureFiles(options)));
await writeFile('tests/fixtures/no-es-epub.epub', await zipFiles({ 'hello.txt': 'No es un EPUB' }));
await writeFile('tests/fixtures/vacio.epub', '');
const editorial = fixtureFiles();
editorial['OPS/book.opf'] = editorial['OPS/book.opf']
  .replace('<manifest>', '<manifest><item id="preface" href="preface.xhtml" media-type="application/xhtml+xml"/><item id="afterword" href="afterword.xhtml" media-type="application/xhtml+xml"/>')
  .replace(/<spine([^>]*)>/, '<spine$1><itemref idref="preface"/>')
  .replace('</spine>', '<itemref idref="afterword"/></spine>');
editorial['OPS/nav.xhtml'] = editorial['OPS/nav.xhtml']
  .replace('<ol>', '<ol><li><a href="preface.xhtml">Preface</a></li>')
  .replace('</ol></nav>', '<li><a href="afterword.xhtml">Afterword</a></li></ol></nav>');
editorial['OPS/preface.xhtml'] = wrap('<h2>Preface</h2><p>Hidden introductory text.</p>');
editorial['OPS/afterword.xhtml'] = wrap('<h2>Afterword</h2><p>Hidden closing text.</p>');
await writeFile('tests/fixtures/editorial.epub', await zipFiles(editorial));
await writeFile('tests/fixtures/seccion-excesiva.epub', await zipFiles({ ...fixtureFiles(), 'OPS/two.xhtml': wrap('x'.repeat(2 * 1024 * 1024)) }));
await writeFile('tests/fixtures/ao3-estructura.epub', await zipFiles({ ...fixtureFiles(), 'OPS/cap uno.xhtml': wrap('<div class="meta group"><h2>Capítulo 1: La llegada</h2><p>Chapter Summary</p><blockquote class="userstuff"><p>Resumen que debe seguir visible.</p></blockquote><p>Chapter Notes</p><blockquote class="userstuff"><p>Nota inicial con estructura AO3.</p></blockquote><div class="endnote-link"><a href="#endnotes1">Notas finales</a></div></div><div class="userstuff"><p>El texto del fic va separado.</p></div><div class="meta" id="endnotes1"><p>Chapter End Notes</p><blockquote class="userstuff"><p>Nota final con estructura AO3.</p></blockquote></div>') }));
