import DOMPurify from 'dompurify';
import { resolvePath } from '../../features/importer/paths';
import { isSceneSeparator } from './scene-separator';

export const contentId = (path: string, id: string) => `epub-${encodeURIComponent(path)}-${encodeURIComponent(id)}`;
export function sanitizeContent(source: string, path: string, available: Set<string>, title?: string) {
  // Primera limpieza antes de inspeccionar estructura: nunca insertar XHTML crudo en el DOM vivo.
  const fragment = DOMPurify.sanitize(source, {
    RETURN_DOM_FRAGMENT: true,
    ALLOWED_TAGS: ['div', 'section', 'article', 'aside', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'strong', 'b', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'a', 'span', 'sup', 'sub', 'pre', 'code', 'img'],
    ALLOWED_ATTR: ['id', 'name', 'href', 'class', 'alt', 'lang', 'dir', 'role', 'epub:type'],
    ALLOW_DATA_ATTR: false,
  });
  for (const image of fragment.querySelectorAll('img')) {
    const notice = document.createElement('p');
    notice.textContent = `[Image omitted${image.getAttribute('alt') ? `: ${image.getAttribute('alt')}` : ''}]`;
    image.replaceWith(notice);
  }
  const firstHeading = fragment.querySelector('h1,h2,h3');
  if (title && firstHeading?.textContent?.trim() === title) {
    const marker = document.createElement('span');
    if (firstHeading.id) marker.id = firstHeading.id;
    firstHeading.replaceWith(marker);
  }
  const isNotesReference = (node: Element | null) => Boolean(node && (
    node.matches('.endnote-link') ||
    (/^see the end of the chapter for (?:more )?notes[.!]?$/i.test(node.textContent?.trim().replace(/\s+/g, ' ') || '') && node.querySelector('a[href]'))
  ));
  // Algunas exportaciones conservan la cita y el enlace, pero pierden .meta.
  for (const label of fragment.querySelectorAll('p, h2, h3, h4')) {
    if (!/^(?:chapter\s+notes|notes|notas(?:\s+del\s+capítulo)?)\s*:?$/i.test(label.textContent?.trim() || '')) continue;
    const next = label.nextElementSibling;
    if (!next) continue;
    const noteQuote = next.matches('blockquote') && (next.matches('.userstuff') || isNotesReference(next.nextElementSibling));
    if (!noteQuote && !isNotesReference(next)) continue;
    if (label.closest('.notes, .author-notes')) continue;
    const group = document.createElement('div'); group.className = 'notes';
    label.replaceWith(group); group.append(label, next);
    const reference = group.nextElementSibling;
    if (noteQuote && reference && isNotesReference(reference)) group.append(reference);
  }
  const noteCandidates = Array.from(fragment.querySelectorAll('[class], [id], [role], [epub\\:type], aside'))
    .filter(node => /(^|\s)(notes?|endnotes?|footnotes?)(\s|$)/i.test(`${node.getAttribute('class') || ''} ${node.getAttribute('epub:type') || ''}`) || /^endnotes\d*$/i.test(node.id) || node.getAttribute('role') === 'doc-endnotes');
  for (const note of noteCandidates) {
    if (!fragment.contains(note) || noteCandidates.some(parent => parent !== note && parent.contains(note))) continue;
    const panel = document.createElement('section');
    panel.className = 'author-notes';
    const summary = document.createElement('h3');
    summary.className = 'notes-heading';
    summary.textContent = 'Author notes';
    const originalHeading = note.firstElementChild;
    if (originalHeading?.matches('h1,h2,h3,h4,p') && /^(?:(?:chapter(?: end)? )?notes|summary|resumen|notas(?: iniciales| finales| del capítulo)?)\s*:?$/i.test(originalHeading.textContent?.trim() || '')) {
      summary.textContent = originalHeading.textContent!.trim().replace(/:$/, '');
      originalHeading.remove();
    }
    panel.append(summary);
    note.replaceWith(panel);
    panel.append(note);
  }
  for (const paragraph of fragment.querySelectorAll('p')) {
    if (isSceneSeparator(paragraph.textContent || '')) paragraph.className = 'scene-separator';
  }
  for (const node of fragment.querySelectorAll('*')) {
    const safeClasses = ['author-notes', 'notes-heading', 'scene-separator'].filter(name => node.classList.contains(name));
    if (safeClasses.length) node.setAttribute('class', safeClasses.join(' ')); else node.removeAttribute('class');
    node.removeAttribute('epub:type');
    const id = node.getAttribute('id') || node.getAttribute('name');
    if (id) node.id = contentId(path, id);
    node.removeAttribute('name');
  }
  for (const anchor of fragment.querySelectorAll('a')) {
    const href = anchor.getAttribute('href');
    anchor.removeAttribute('href');
    if (!href) continue;
    if (/^(https?:|mailto:)/i.test(href.trim())) {
      anchor.href = href.trim(); anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
      anchor.setAttribute('aria-label', `${anchor.textContent || 'Link'} (external link, opens in a new tab)`);
    } else {
      try {
        const destination = resolvePath(path, href);
        if (available.has(destination.path)) {
          anchor.href = '#contenido';
          anchor.setAttribute('data-path', destination.path);
          anchor.setAttribute('data-fragment', destination.fragment);
        }
      } catch { /* Referencias peligrosas o fuera del contenedor quedan como texto. */ }
    }
  }
  const container = document.createElement('div'); container.append(fragment);
  return DOMPurify.sanitize(container.innerHTML, {
    ALLOWED_TAGS: ['div', 'section', 'article', 'aside', 'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'strong', 'b', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'a', 'span', 'sup', 'sub', 'pre', 'code'],
    ALLOWED_ATTR: ['id', 'href', 'lang', 'dir', 'role', 'class', 'target', 'rel', 'aria-label', 'data-path', 'data-fragment'],
    ALLOW_DATA_ATTR: false,
  });
}
