import { defaults, type Preferences } from './preferences';
import styles from './reader.module.css';
export default function ReadingPreferences({ value, onChange }: { value: Preferences; onChange: (value: Preferences) => void }) {
  return <section id="ajustes-lectura" aria-label="Reading settings" className={styles.preferences}>
    <h2>Make yourself comfortable</h2>
    <div className={styles.preferenceFields}>
      <label>Font size<select value={value.size} onChange={e => onChange({ ...value, size: e.target.value as Preferences['size'] })}>{['16', '18', '20', '22', '24'].map(size => <option key={size} value={size}>{size} px</option>)}</select></label>
      <label>Line spacing<select value={value.spacing} onChange={e => onChange({ ...value, spacing: e.target.value as Preferences['spacing'] })}><option value="compact">Compact</option><option value="normal">Normal</option><option value="wide">Wide</option></select></label>
      <label>Text width<select value={value.width} onChange={e => onChange({ ...value, width: e.target.value as Preferences['width'] })}><option value="narrow">Narrow</option><option value="normal">Normal</option><option value="wide">Wide</option></select></label>
      <label>Theme<select aria-label="Theme" value={value.theme} onChange={e => onChange({ ...value, theme: e.target.value as Preferences['theme'] })}><option value="light">Light</option><option value="sepia">Sepia</option><option value="dark">Dark</option></select></label>
    </div>
    <p>Your reading settings are saved on this device.</p>
    <button onClick={() => onChange({ ...defaults })}>Reset settings</button>
  </section>;
}
