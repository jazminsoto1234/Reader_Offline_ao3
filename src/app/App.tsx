import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReadingSession } from '../domain/reading-session';
import { omitEditorialSections } from '../domain/reading-session';
import Reader from '../features/reader/Reader';
import { usePreferences } from '../features/reader/preferences';
import { PDF_LIMITS } from '../features/importer/pdf-limits';
import { forgetSavedFile, loadProgress, loadSavedFile, storeFile, storeProgress } from '../features/reader/saved-reading';
import type { ReadingProgress, SavedFile } from '../features/reader/saved-reading';

export default function App() {
  const [session, setSession] = useState<ReadingSession>();
  const [sessionKey, setSessionKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [savedId, setSavedId] = useState<string>();
  const [resume, setResume] = useState<ReadingProgress>();
  const [progress, setProgress] = useState('Preparing your reading…');
  const { preferences, updatePreferences } = usePreferences();
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const startup = new AbortController(); controller.current = startup;
    history.scrollRestoration = 'manual';
    setBusy(true); setProgress('Looking for your last read…');
    void loadSavedFile().then(saved => {
      if (controller.current !== startup || startup.signal.aborted) return;
      if (saved) void open(new File([saved.file], saved.name, { type: saved.file.type, lastModified: saved.lastModified }), saved);
      else { controller.current = null; setBusy(false); }
    }).catch(() => {
      if (controller.current === startup) { controller.current = null; setBusy(false); setStorageNotice('Your browser could not restore your saved reading. You can still open a file normally.'); }
    });
    return () => { controller.current?.abort(); };
  }, []);
  const savePosition = useCallback((position: ReadingProgress) => {
    if (!savedId) return;
    try { storeProgress(savedId, position); }
    catch { setStorageNotice('Your browser could not save your reading position.'); }
  }, [savedId]);
  async function open(file?: File, restored?: SavedFile) {
    if (!file) return;
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setBusy(true); setError(''); setStorageNotice(''); setProgress(restored ? 'Restoring your file and reading position…' : 'Checking your file…');
    try {
      if (!file.size) throw new Error('The file is empty.');
      const signature = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
      const isPdf = new TextDecoder().decode(signature).includes('%PDF-');
      if (file.size > (isPdf ? PDF_LIMITS.file : 20 * 1024 * 1024)) throw new Error(isPdf ? 'The PDF exceeds the 100 MiB limit.' : 'The EPUB exceeds the 20 MiB limit.');
      current.signal.throwIfAborted();
      const report = (message: string) => { if (controller.current === current && !current.signal.aborted) setProgress(message); };
      const next = isPdf
        ? await import('../features/importer/pdf-parser').then(module => module.importPdf(file, current.signal, report))
        : await import('../features/importer/import-controller').then(module => module.importEpub(file, current.signal));
      const reading = omitEditorialSections(next);
      current.signal.throwIfAborted();
      let id = restored?.id;
      try {
        if (!restored) { report('Saving your file in this browser…'); id = await storeFile(file, current.signal); }
      } catch {
        current.signal.throwIfAborted();
        setStorageNotice('This file could not be saved in your browser. You can read it, but reloading may restore your previous read.');
      }
      if (controller.current === current && !current.signal.aborted) {
        setSavedId(id); setResume(restored && id ? loadProgress(id) : undefined);
        setSession(reading); setSessionKey(key => key + 1);
      }
    } catch (failure) {
      if (!current.signal.aborted && controller.current === current) setError(failure instanceof Error ? failure.message : 'The file could not be opened.');
    } finally {
      if (controller.current === current) { controller.current = null; setBusy(false); }
    }
  }
  return <div className="app-shell" data-theme={preferences.theme}>
    <a className="skip" href="#contenido">Skip to content</a>
    <header className="site-header">
      <div><span className="brand">Local Reader</span><span className="tagline">A space for your stories</span></div>
      <button onClick={() => input.current?.click()}>{session ? 'Open another file' : 'Open file'}</button>
    </header>
    <div className="subheader"><span>EPUB & PDF · Private reading</span><span>No accounts. No uploads.</span></div>
    <input ref={input} className="file-input" type="file" accept=".epub,.pdf,application/epub+zip,application/pdf" aria-label="Select EPUB or PDF" onChange={event => { void open(event.target.files?.[0]); event.target.value = ''; }} />
    <main id="contenido">
      <div className="messages" aria-live="polite">
        {storageNotice && <div className="notice" role="status">{storageNotice}</div>}
        {busy && <div className="notice" role="status"><span>{progress}</span><button onClick={() => { controller.current?.abort(); controller.current = null; setBusy(false); }}>Cancel import</button></div>}
        {error && <div className="error" role="alert"><strong>We could not open this file.</strong><p>{error}</p>{session && <p>You can continue your previous read or open another file.</p>}<button onClick={() => input.current?.click()}>Choose another file</button></div>}
      </div>
      {session ? <Reader key={sessionKey} session={session} initialProgress={resume} onProgress={savedId ? savePosition : undefined} preferences={preferences} updatePreferences={updatePreferences} onClose={() => { controller.current?.abort(); controller.current = null; setBusy(false); setSession(undefined); setSavedId(undefined); setError(''); void forgetSavedFile().catch(() => setStorageNotice('Your saved reading could not be removed from this browser.')); requestAnimationFrame(() => heading.current?.focus()); }} /> :
        <section className="welcome">
          <p className="eyebrow">YOUR FILE, YOUR READING</p>
          <h1 tabIndex={-1} ref={heading}>One story.<br />All the space to read it.</h1>
          <p className="intro">Open an EPUB or PDF from your device and get back to what matters: the next chapter.</p>
          <button className="primary" onClick={() => input.current?.click()} disabled={busy}>Open EPUB or PDF</button>
          <p className="file-hint">EPUB up to 20 MiB · PDF up to 100 MiB and 10,000 pages</p>
          <div className="welcome-details"><h2>Read your way</h2><p>Choose chapters from a dropdown, navigate at the top and bottom, and read author notes in their own narrower section. Adjust the font size, spacing, width, and theme to suit you.</p><hr /><h2>Your file stays with you</h2><p>Your last EPUB or PDF and reading position are saved in this browser, without being uploaded to a server. Reload to pick up where you left off. Close work removes the saved copy.</p></div>
        </section>}
    </main>
    <footer className="site-footer"><span>Local Reader · MVP</span><p>Private EPUB &amp; PDF reading. Your files stay in your browser.</p><p>An independent project, not affiliated with Archive of Our Own.</p></footer>
  </div>;
}
