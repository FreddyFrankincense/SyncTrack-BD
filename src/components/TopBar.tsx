import React from 'react';
import { Film, Sparkles, FolderDown, Edit3, Tv, Heart, Gift } from 'lucide-react';
import { DriveGiftConfig, ViewMode } from '../types/movie';

interface TopBarProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  config: DriveGiftConfig;
  movieCount: number;
  favoritesCount: number;
  onOpenGiftCard: () => void;
  onQuickExport: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  setViewMode,
  config,
  movieCount,
  favoritesCount,
  onOpenGiftCard,
  onQuickExport,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800/80 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Brand & Recipient Info */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-neutral-950 shadow-md shadow-amber-950/40">
              <Film className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-base tracking-wide text-neutral-100">
                  {config.driveTitle}
                </span>
                <span className="text-xs text-amber-400/90 font-medium bg-amber-950/60 border border-amber-800/50 px-2 py-0.5 rounded">
                  {movieCount} {movieCount === 1 ? 'Movie' : 'Movies'}
                </span>
              </div>
              <div className="text-xs text-neutral-400 flex items-center gap-1.5">
                <span>Gift for <strong className="text-neutral-200">{config.nieceName}</strong></span>
                <span aria-hidden="true" className="text-neutral-600">·</span>
                <span>From <span className="text-neutral-300">{config.curatorName}</span></span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenGiftCard}
            className="flex sm:hidden items-center gap-1 text-xs px-2.5 py-1.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Card</span>
          </button>
        </div>

        {/* View Mode Navigation Switcher */}
        <div className="flex items-center gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          <button
            onClick={() => setViewMode('theater')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'theater'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/60'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
            title="Preview the exact cinema menu your niece will see"
          >
            <Tv className="w-3.5 h-3.5 text-amber-400" />
            <span>Niece's Menu</span>
          </button>

          <button
            onClick={() => setViewMode('curator')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'curator'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/60'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
            title="Add movies, edit synopses, and customize gift notes"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
            <span>Drive Curator</span>
          </button>

          <button
            onClick={() => setViewMode('export')}
            className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-all ${
              viewMode === 'export'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/60'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
            title="Generate .hta, .bat, .command executables and download drive package"
          >
            <FolderDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>Drive Packager</span>
          </button>
        </div>

        {/* Right Actions: Gift Letter & One-click Download */}
        <div className="hidden sm:flex items-center gap-2.5">
          <button
            onClick={onOpenGiftCard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
          >
            <Gift className="w-3.5 h-3.5" />
            <span>Gift Letter</span>
          </button>

          <button
            onClick={onQuickExport}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-md bg-amber-500 text-neutral-950 hover:bg-amber-400 transition-colors shadow-sm"
          >
            <FolderDown className="w-3.5 h-3.5" />
            <span>Get Drive Executables</span>
          </button>
        </div>
      </div>
    </header>
  );
};
