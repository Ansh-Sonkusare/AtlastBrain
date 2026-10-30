import { useState } from 'react';

export function QuickNote({ disabled, onSave }: { disabled: boolean; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const submit = async () => {
    const value = text.trim();
    if (!value) return;
    setText('');
    await onSave(value);
  };
  return (
    <footer className="card note">
      <label htmlFor="note" className="eyebrow">
        Quick note
      </label>
      <textarea
        id="note"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit();
        }}
        placeholder="Type or dictate a thought"
      />
      <div className="note-bar">
        <span className="muted">⌘ Enter to save</span>
        <button disabled={disabled || !text.trim()} onClick={submit}>
          Save note
        </button>
      </div>
    </footer>
  );
}
