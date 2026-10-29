import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { Settings } from '@/lib/api-types';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/lib/settings';
import '../sidepanel/style.css';

function Options() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);
  const set = (patch: Partial<Settings>) => {
    setSaved(false);
    setSettings({ ...settings, ...patch });
  };
  return (
    <main style={{ maxWidth: 480 }}>
      <h1>Second Brain options</h1>
      <label>
        API base URL
        <input value={settings.apiBase} onChange={(e) => set({ apiBase: e.target.value })} />
      </label>
      <label>
        User id
        <input value={settings.userId} onChange={(e) => set({ userId: e.target.value })} />
      </label>
      <button
        className="primary"
        onClick={async () => {
          await saveSettings(settings);
          setSaved(true);
        }}
      >
        Save
      </button>
      {saved && <p className="status">Saved.</p>}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Options />
  </React.StrictMode>,
);
