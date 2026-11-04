import { useEffect, useState } from 'react';
import styles from './reader.module.css';

export default function FileWarnings({ warnings }: { warnings?: string[] }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 3000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible || !warnings?.length) return null;
  return <aside className={styles.fileToast} role="status" aria-label="About this file" translate="no">
    <button className={styles.closeToast} aria-label="Dismiss notice" onClick={() => setVisible(false)}>×</button>
    {warnings.map((warning, index) => <p key={index}>{warning}</p>)}
  </aside>;
}
