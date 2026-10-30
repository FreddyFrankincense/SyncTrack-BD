import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    category: 'Transport & Playback',
    items: [
      { keys: ['Space', 'K'], description: 'Play / Pause commentary transport' },
      { keys: ['←', '→'], description: 'Seek backward / forward by 5 seconds' },
      { keys: ['J', 'L'], description: 'Shuttle backward / forward by 10 seconds' },
    ],
  },
  {
    category: 'Surgical Splice & Pause Editing',
    items: [
      { keys: ['Shift', '←'], description: 'Nudge selected pause cut start -100ms earlier' },
      { keys: ['Shift', '→'], description: 'Nudge selected pause cut start +100ms later' },
    ],
  },
  {
    category: 'Navigation & Global Search',
    items: [
      { keys: ['⌘ / Ctrl', 'K'], description: 'Focus global film search bar (Title, Genre, Director)' },
      { keys: ['?'], description: 'Toggle Keyboard Shortcuts reference modal' },
      { keys: ['Esc'], description: 'Close active modal or clear search dropdown' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-semibold text-white">Keyboard Shortcuts</h2>
              <p className="text-xs text-neutral-400">
                Frame-accurate transport and splice controls
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
            aria-label="Close keyboard shortcuts"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-amber-400/90">
                {group.category}
              </h3>
              <div className="bg-neutral-950/70 border border-neutral-800/80 rounded-lg divide-y divide-neutral-800/60">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between px-4 py-2.5 text-xs"
                  >
                    <span className="text-neutral-300">{item.description}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-4">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 text-[11px] font-mono font-medium bg-neutral-900 text-neutral-200 border border-neutral-700 rounded shadow-inner"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 bg-neutral-950/80 border-t border-neutral-800 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-amber-500" />
            Press <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded font-mono text-neutral-300">?</kbd> anytime to toggle
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
