import React, { useEffect, useState } from 'react';

interface KeyboardShortcutsProps {
  visible?: boolean;
}

const SHORTCUTS = [
  { keys: ['Space'], action: 'Play / Pause' },
  { keys: ['←'], action: 'Previous frame' },
  { keys: ['→'], action: 'Next frame' },
  { keys: ['Home'], action: 'First frame' },
  { keys: ['End'], action: 'Last frame' },
  { keys: ['1–5'], action: 'Set speed preset' },
  { keys: ['?'], action: 'Toggle this overlay' },
  { keys: ['Esc'], action: 'Close overlay' },
];

const INTERACTIVE_KEYBOARD_SELECTOR = [
  'input',
  'textarea',
  'select',
  'button',
  '[contenteditable="true"]',
  '[role="button"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="textbox"]',
  '[role="combobox"]',
].join(',');

const isInteractiveKeyboardTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  return Boolean(target.closest(INTERACTIVE_KEYBOARD_SELECTOR));
};

const KeyboardShortcuts: React.FC<KeyboardShortcutsProps> = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
        return;
      }

      if (isInteractiveKeyboardTarget(e.target)) return;

      if (e.key === '?') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="shortcuts-overlay" onClick={() => setIsOpen(false)}>
      <div className="shortcuts-panel" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-panel__header">
          <span className="shortcuts-panel__title">Keyboard Shortcuts</span>
          <button
            className="shortcuts-panel__close"
            onClick={() => setIsOpen(false)}
            aria-label="Close shortcuts"
          >
            ×
          </button>
        </div>

        <div className="shortcuts-panel__list">
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="shortcuts-panel__row">
              <div className="shortcuts-panel__keys">
                {keys.map((key) => (
                  <kbd key={key} className="shortcuts-panel__kbd">{key}</kbd>
                ))}
              </div>
              <span className="shortcuts-panel__action">{action}</span>
            </div>
          ))}
        </div>

        <p className="shortcuts-panel__hint">Press ? to toggle</p>
      </div>
    </div>
  );
};

export default KeyboardShortcuts;
