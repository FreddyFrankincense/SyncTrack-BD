import React from 'react';
import { Gift, Heart, Sparkles, Film, X } from 'lucide-react';
import { DriveGiftConfig } from '../types/movie';

interface GiftUnboxingModalProps {
  config: DriveGiftConfig;
  isOpen: boolean;
  onClose: () => void;
  onStartBrowsing: () => void;
}

export const GiftUnboxingModal: React.FC<GiftUnboxingModalProps> = ({
  config,
  isOpen,
  onClose,
  onStartBrowsing,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/90 backdrop-blur-md">
      <div className="relative bg-gradient-to-b from-neutral-900 to-neutral-950 border border-amber-500/40 rounded-2xl max-w-xl w-full p-6 sm:p-8 shadow-2xl shadow-amber-950/40 overflow-hidden">
        {/* Decorative corner glow */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full filter blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-500/10 rounded-full filter blur-2xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Gift Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-neutral-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20">
            <Gift className="w-7 h-7" />
          </div>
          <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold">
            {config.giftOccasion}
          </div>
          <h2 className="text-2xl font-serif font-black text-neutral-100">
            For {config.nieceName}
          </h2>
          <div className="text-xs text-neutral-400 flex items-center justify-center gap-1.5">
            <span>From {config.curatorName}</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span>Personal Movie Archive</span>
          </div>
        </div>

        {/* Vintage Cinema Ticket / Letter Container */}
        <div className="relative bg-neutral-900/90 border border-amber-900/50 rounded-xl p-5 mb-6 text-neutral-200 text-sm leading-relaxed shadow-inner">
          <div className="text-xs font-mono text-amber-400/80 mb-2 flex items-center justify-between border-b border-amber-900/30 pb-1.5">
            <span>OFFICIAL CINEMA GIFT PASS</span>
            <span>NO. 001-GIFT</span>
          </div>
          <div className="whitespace-pre-line text-neutral-200 font-sans text-xs sm:text-sm leading-relaxed space-y-2">
            {config.welcomeMessage}
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => {
              onClose();
              onStartBrowsing();
            }}
            className="w-full sm:w-auto px-8 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-sm shadow-lg shadow-amber-500/25 transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            <Film className="w-4 h-4" />
            <span>Open Cinema Menu 🍿</span>
          </button>
        </div>
      </div>
    </div>
  );
};
