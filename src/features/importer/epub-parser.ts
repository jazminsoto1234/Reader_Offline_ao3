import type { ReadingSession, Section, TocEntry } from '../../domain/reading-session';
import { sanitizeContent } from '../../shared/security/sanitize-content';
import { resolvePath } from './paths';
import { LIMITS } from './limits';

function xml(value: string | undefined, label: string) {
  if (!value || /<!DOCTYPE|<!ENTITY/i.test(value)) throw new Error(`${label}: Missing or unsupported XML.`);
  const doc = new DOMParser().parseFromString(value, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error(`${label}: Invalid XML.`);
  return doc;
}
const elements = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name));
const text = (node: Document, name: string) => elements(node, name)[0]?.textContent?.trim();

export function parseEpub(files: Record<string, string>): ReadingSession {
  if (files.mimetype?.trim() !== 'application/epub+zip') throw new Error('The file is not a valid EPUB (mimetype).');
  if (files['META-INF/encryption.xml']) throw new Error('This EPUB declares encrypted content. DRM and encrypted resources are not supported.');
  const container = xml(files['META-INF/container.xml'], 'Container');
  const rootfile = elements(container, 'rootfile').find(node => node.getAttribute('media-type') === 'application/oebps-package+xml');
  const opfPath = resolvePath('', rootfile?.getAttribute('full-path') || '').path;
  const opf = xml(files[opfPath], 'OPF package');
  if (elements(opf, 'meta').some(node => node.getAttribute('property') === 'rendition:layout' && node.textContent?.trim() === 'pre-paginated')) throw new Error('Fixed-layout EPUB files are not supported. Use a reflowable EPUB.');
  const manifest = new Map(elements(opf, 'item').map(node => {
    const id = node.getAttribute('id'); const href = node.getAttribute('href');
    if (!id || !href) throw new Error('The manifest contains an invalid reference.');
    return [id, { path: resolvePath(opfPath, href).path, type: node.getAttribute('media-type'), properties: node.getAttribute('properties') || '' }];
  }));
  const sections: Section[] = [];
  const add = (id: string, path: string, linear: boolean) => {
    if (!files[path]) throw new Error('A section referenced by the EPUB is missing.');
    if (sections.some(section => section.path === path)) return;
    if (sections.length >= LIMITS.sections) throw new Error('The EPUB exceeds the 300-section limit.');
    sections.push({ id, path, linear, title: `Section ${sections.length + 1}`, html: '' });
  };
  const spine = elements(opf, 'spine')[0];
  if (!spine) throw new Error('The EPUB has no reading order (spine).');
  for (const ref of elements(spine, 'itemref')) {
    const id = ref.getAttribute('idref') || ''; const item = manifest.get(id);
    if (!item || !['application/xhtml+xml', 'text/html'].includes(item.type || '')) throw new Error('The spine contains a missing or non-text section.');
    add(id, item.path, ref.getAttribute('linear') !== 'no');
  }
  if (!sections.some(section => section.linear)) throw new Error('The EPUB contains no reading sections.');
  // Las secciones auxiliares están disponibles para enlaces, sin entrar en anterior/siguiente.
  for (const [id, item] of manifest) if (['application/xhtml+xml', 'text/html'].includes(item.type || '') && !item.properties.split(/\s+/).includes('nav')) add(id, item.path, false);
  const toc: TocEntry[] = [];
  const addToc = (label: string, href: string, base: string, depth: number) => {
    const destination = resolvePath(base, href);
    if (!sections.some(section => section.path === destination.path)) return;
    toc.push({ ...destination, label: label.trim() || 'Section', depth });
  };
  const nav = Array.from(manifest.values()).find(item => item.properties.split(/\s+/).includes('nav'));
  if (nav) {
    const doc = new DOMParser().parseFromString(files[nav.path] || '', 'text/html');
    const tocNav = Array.from(doc.querySelectorAll('nav')).find(node => (node.getAttribute('epub:type') || '').split(/\s+/).includes('toc') || node.getAttribute('role') === 'doc-toc');
    if (tocNav) for (const anchor of tocNav.querySelectorAll('a[href]')) {
      let depth = 0; let parent = anchor.parentElement;
      while (parent && parent !== tocNav) { if (parent.tagName === 'OL') depth++; parent = parent.parentElement; }
      addToc(anchor.textContent || '', anchor.getAttribute('href')!, nav.path, Math.max(0, depth - 1));
    }
  } else {
    const ncx = manifest.get(spine.getAttribute('toc') || '') || Array.from(manifest.values()).find(item => item.type === 'application/x-dtbncx+xml');
    if (ncx) {
      const doc = xml(files[ncx.path], 'NCX index');
      for (const point of elements(doc, 'navPoint')) {
        const content = elements(point, 'content')[0]; const label = elements(point, 'navLabel')[0];
        if (content?.getAttribute('src')) {
          let depth = 0; let parent = point.parentElement;
          while (parent) { if (parent.localName === 'navPoint') depth++; parent = parent.parentElement; }
          addToc(label?.textContent || '', content.getAttribute('src')!, ncx.path, depth);
        }
      }
    }
  }
  const available = new Set(sections.map(section => section.path));
  for (const section of sections) {
    const source = files[section.path];
    const doc = new DOMParser().parseFromString(source, 'text/html');
    section.title = toc.find(entry => entry.path === section.path)?.label || doc.querySelector('h1,h2,h3,title')?.textContent?.trim() || section.title;
    section.html = sanitizeContent(source, section.path, available, section.title);
  }
  if (!toc.length) for (const section of sections.filter(section => section.linear)) toc.push({ label: section.title, path: section.path, fragment: '', depth: 0 });
  const language = text(opf, 'language') || 'und';
  return { title: text(opf, 'title') || 'Untitled work', author: elements(opf, 'creator').map(node => node.textContent?.trim()).filter(Boolean).join(', ') || 'Unknown author', language: /^[a-zA-Z0-9-]{2,35}$/.test(language) ? language : 'und', sections, toc };
}
