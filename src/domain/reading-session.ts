export interface Section { id: string; path: string; title: string; linear: boolean; html: string; role?: 'frontmatter' }
export interface Destination { path: string; fragment: string }
export interface TocEntry extends Destination { label: string; depth: number }
export interface ReadingSession {
  title: string; author: string; language: string; sections: Section[]; toc: TocEntry[];
  format?: 'epub' | 'pdf'; warnings?: string[];
}

const isHiddenEditorialTitle = (title: string) => /^(?:preface|afterword|afterworld)\s*[:.]?$/i.test(title.trim());

export function omitEditorialSections(session: ReadingSession): ReadingSession {
  const sections = session.sections.filter(section => !isHiddenEditorialTitle(section.title));
  if (!sections.some(section => section.linear)) throw new Error('The file has no reading chapters other than Preface and Afterword.');
  const paths = new Set(sections.map(section => section.path));
  return { ...session, sections, toc: session.toc.filter(entry => paths.has(entry.path) && !isHiddenEditorialTitle(entry.label)) };
}
