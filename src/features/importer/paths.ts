export function resolvePath(base: string, reference: string) {
  if (/^[a-z][\w+.-]*:|^\/|\\|\0/i.test(reference)) throw new Error('Reference outside the EPUB.');
  const [pathname, fragment = ''] = reference.split('#');
  const result = pathname ? base.split('/').slice(0, -1) : [];
  const decoded = decodeURIComponent(pathname);
  if (/^[a-z][\w+.-]*:|^\/|\\|\0/i.test(decoded)) throw new Error('Path not allowed.');
  if (!pathname) return { path: base, fragment: decodeURIComponent(fragment) };
  for (const part of decoded.split('/')) {
    if (part === '..') { if (!result.length) throw new Error('Path outside the EPUB.'); result.pop(); }
    else if (part && part !== '.') result.push(part);
  }
  return { path: result.join('/'), fragment: decodeURIComponent(fragment) };
}
