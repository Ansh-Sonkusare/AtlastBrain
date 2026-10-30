import { useState } from 'react';

export function QuickNote({ disabled, onSave }: { disabled: boolean; onSave: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const submit = async () => {
    const value = text.trim();
    if (!value || disabled) return;
    setText('');
    await onSave(value);
  };
  return (
    <div className="field">
      <label htmlFor="note" className="sr">Quick note</label>
      <input
        id="note"
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
        }}
        placeholder="Jot a thought…"
      />
      <button className="icon send" aria-label="Save note" disabled={disabled || !text.trim()} onClick={submit}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 19V5M6 11l6-6 6 6" />
        </svg>
      </button>
    </div>
  );
}
