import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Destination, ReadingSession } from '../../domain/reading-session';
import { contentId } from '../../shared/security/sanitize-content';
import styles from './reader.module.css';
import ReadingPreferences from './ReadingPreferences';
import FileWarnings from './FileWarnings';
import type { Preferences } from './preferences';
import type { ReadingProgress } from './saved-reading';

export default function Reader({ session, onClose, preferences, updatePreferences, initialProgress, onProgress }: { session: ReadingSession; onClose: () => void; preferences: Preferences; updatePreferences: (value: Preferences) => void; initialProgress?: ReadingProgress; onProgress?: (progress: ReadingProgress) => boolean }) {
  const sequence = session.sections.filter(section => section.linear);
  const chapters = sequence.filter(section => section.role !== 'frontmatter');
  const frontmatter = sequence.find(section => section.role === 'frontmatter');
  const restored = useRef(initialProgress && session.sections.some(item => item.path === initialProgress.path) ? initialProgress : undefined);
  const [destination, setDestination] = useState<Destination>(restored.current || { path: sequence[0].path, fragment: '' });
  const currentDestination = useRef(destination);
  const section = session.sections.find(item => item.path === destination.path)!;
  const position = sequence.findIndex(item => item.path === section.path);
  const chapterPosition = chapters.findIndex(item => item.path === section.path);
  const isFrontmatter = section.role === 'frontmatter';
  const heading = useRef<HTMLHeadingElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const article = useRef<HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const navigating = useRef(false);
  const captureProgress = () => {
    if (!onProgress || navigating.current) return;
    const blocks = Array.from(article.current?.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,hr') || []);
    const anchor = blocks.findIndex(node => node.getBoundingClientRect().bottom > 0);
    onProgress({ ...currentDestination.current, scrollY: window.scrollY,
      anchor: anchor >= 0 ? anchor : undefined,
      offset: anchor >= 0 ? blocks[anchor].getBoundingClientRect().top : undefined });
  };
  const capture = useRef(captureProgress);
  useLayoutEffect(() => {
    currentDestination.current = destination;
    capture.current = captureProgress;
    const target = destination.fragment ? document.getElementById(contentId(destination.path, destination.fragment)) : heading.current;
    const resume = restored.current;
    if (resume) {
      restored.current = undefined;
      heading.current?.focus({ preventScroll: true });
      const block = resume.anchor === undefined ? undefined : article.current?.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,pre,hr')[resume.anchor];
      if (resume.fragment && resume.anchor === undefined && target) {
        target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' });
      } else window.scrollTo(0, block && resume.offset !== undefined ? window.scrollY + block.getBoundingClientRect().top - resume.offset : resume.scrollY);
      capture.current();
      return;
    }
    if (target) {
      target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); target.scrollIntoView({ block: 'start' });
    } else { heading.current?.focus(); heading.current?.scrollIntoView(); }
    capture.current();
  }, [destination]);
  useEffect(() => {
    if (!onProgress) return;
    let timer: number | undefined;
    const save = () => { window.clearTimeout(timer); timer = undefined; capture.current(); };
    const scroll = () => { window.clearTimeout(timer); timer = window.setTimeout(save, 150); };
    const hidden = () => { if (document.visibilityState === 'hidden') save(); };
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [onProgress]);
  const goTo = (next: Destination) => {
    if (navigating.current) return;
    // A new document lets browser translators apply their automatic language setting.
    // Save before leaving; pagehide must not overwrite the new chapter with the old one.
    if (next.path !== destination.path && onProgress?.({ ...next, scrollY: 0 })) {
      navigating.current = true;
      window.location.reload();
      return;
    }
    // With storage unavailable, keep reading in memory rather than losing the file.
    setDestination(next);
  };
  const navigate = (offset: number) => {
    const next = sequence[position + offset];
    if (next) goTo({ path: next.path, fragment: '' });
  };
  const nav = (location: string) => <nav aria-label={`${location} navigation`} className={styles.navigation}>
    <button disabled={position <= 0} onClick={() => navigate(-1)}>← Previous</button>
    <span className={styles.counter}>{isFrontmatter ? 'Work details' : position < 0 ? 'Additional section' : `${chapterPosition + 1} / ${chapters.length}`}</span>
    <button disabled={position < 0 || position >= sequence.length - 1} onClick={() => navigate(1)}>Next →</button>
  </nav>;
  const exactSelection = session.toc.findIndex(entry => entry.path === destination.path && entry.fragment === destination.fragment);
  const selected = exactSelection < 0 && !destination.fragment ? session.toc.findIndex(entry => entry.path === destination.path) : exactSelection;
  return <div className={styles.reader} data-size={preferences.size} data-spacing={preferences.spacing} data-width={preferences.width}>
    <div className={styles.toolbar} translate="no">
      <label className={styles.index}>Chapter index
        <select value={selected < 0 ? '' : selected} onChange={event => { const entry = session.toc[Number(event.target.value)]; if (entry) goTo({ path: entry.path, fragment: entry.fragment }); }}>
          <option value="" disabled>Select a chapter or section</option>
          {session.toc.map((entry, index) => <option key={index} value={index}>{'　'.repeat(Math.min(entry.depth, 4))}{entry.label}</option>)}
        </select>
      </label>
      {frontmatter && !isFrontmatter && <button onClick={() => goTo({ path: frontmatter.path, fragment: '' })}>Work details</button>}
      <button onClick={() => { bottom.current?.focus(); bottom.current?.scrollIntoView(); }}>Go to bottom ↓</button>
      <button aria-expanded={settingsOpen} aria-controls="ajustes-lectura" onClick={() => setSettingsOpen(!settingsOpen)}>Reading settings</button>
      <button onClick={onClose}>Close work</button>
    </div>
    {settingsOpen && <ReadingPreferences value={preferences} onChange={updatePreferences} />}
    <FileWarnings warnings={session.warnings} />
    <div className={styles.metadata}><h1>{session.title}</h1><p>by <span>{session.author}</span></p></div>
    {nav('Top')}
    <header className={styles.chapterHeader}><p>{isFrontmatter ? 'INFORMATION & SUMMARY' : position < 0 ? 'ADDITIONAL CONTENT' : `${session.format === 'pdf' ? 'CHAPTER' : 'SECTION'} ${chapterPosition + 1} OF ${chapters.length}`}</p><h2 ref={heading} tabIndex={-1}>{section.title}</h2></header>
    <article ref={article} lang={session.language} translate="yes" className={styles.prose} aria-label="Work text" onClick={event => {
      const anchor = (event.target as Element).closest('a[data-path]');
      if (anchor) {
        event.preventDefault();
        const path = anchor.getAttribute('data-path')!;
        if (session.sections.some(item => item.path === path)) goTo({ path, fragment: anchor.getAttribute('data-fragment') || '' });
      }
    }} dangerouslySetInnerHTML={{ __html: section.html }} />
    <div ref={bottom} tabIndex={-1} className={styles.bottom}>
      <p className={styles.end}>{position === sequence.length - 1 ? 'End of work' : 'End of section'}</p>
      {nav('Bottom')}
      <div className={styles.bottomActions}><button onClick={() => { heading.current?.focus(); heading.current?.scrollIntoView(); }}>Back to top ↑</button></div>
    </div>
    <p className={styles.privacy}>{onProgress ? 'Your file and reading position are saved in this browser. Close work removes the saved copy.' : 'This work is kept in memory only. Reloading or closing the page means opening the file again.'}</p>
  </div>;
}
