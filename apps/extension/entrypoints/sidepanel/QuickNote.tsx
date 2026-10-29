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
    <footer>
      <label htmlFor="note">Quick note</label>
      <textarea id="note" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type or dictate a note" />
      <button disabled={disabled || !text.trim()} onClick={submit}>
        Save note
      </button>
    </footer>
  );
}
