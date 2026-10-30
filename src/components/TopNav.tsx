import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Disc3,
  FolderOpen,
  Download,
  Settings2,
  Scissors,
  BookmarkCheck,
  FileText,
  ShieldAlert,
  Video,
  Keyboard,
  Search,
  X,
  Film,
  User,
  Tag,
  Check,
} from 'lucide-react';
import { ProjectData } from '../types';
import { SAMPLE_PROJECTS } from '../data/sampleProjects';
import { PWAInstallButton } from './PWAInstallButton';

interface SearchableFilmEntry {
  key: string;
  project: ProjectData;
  filmId?: string;
  title: string;
  director: string;
  genres: string[];
  releaseYear?: number;
  discLabel?: string;
  frameRate: number;
  pauseCount: number;
  isMultiFilmChild: boolean;
  isActive: boolean;
}

interface TopNavProps {
  currentView: 'pauses' | 'anchors' | 'transcript' | 'review';
  onSelectView: (view: 'pauses' | 'anchors' | 'transcript' | 'review') => void;
  onOpenAnalyze: () => void;
  onOpenExport: () => void;
  onOpenSettings: () => void;
  onOpenShortcuts?: () => void;
  onOpenProjectSelect: () => void;
  projectTitle: string;
  isAnalyzing: boolean;
  pauseCount: number;
  anchorCount: number;
  frameRate: number;
  unverifiedCutCount?: number;
  // Video Monitor
  isVideoMonitorOpen?: boolean;
  onToggleVideoMonitor?: () => void;
  // Multi-film info
  isMultiFilm?: boolean;
  filmCount?: number;
  activeFilmTitle?: string;
  // Global search & selection props
  activeProject?: ProjectData;
  activeFilmId?: string;
  onSelectProjectAndFilm?: (project: ProjectData, filmId?: string) => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentView,
  onSelectView,
  onOpenAnalyze,
  onOpenExport,
  onOpenSettings,
  onOpenShortcuts,
  onOpenProjectSelect,
  projectTitle,
  isAnalyzing,
  pauseCount,
  anchorCount,
  frameRate,
  unverifiedCutCount = 0,
  isVideoMonitorOpen = true,
  onToggleVideoMonitor,
  isMultiFilm,
  filmCount,
  activeFilmTitle,
  activeProject,
  activeFilmId,
  onSelectProjectAndFilm,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenreFilter, setSelectedGenreFilter] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Build unified index of all searchable movies/films across projects
  const allFilmEntries = useMemo<SearchableFilmEntry[]>(() => {
    const projectPool: ProjectData[] = [...SAMPLE_PROJECTS];
    if (activeProject && !projectPool.some((p) => p.id === activeProject.id)) {
      projectPool.unshift(activeProject);
    } else if (activeProject) {
      // Use the live activeProject state so any custom split films or updated titles/directors appear
      const idx = projectPool.findIndex((p) => p.id === activeProject.id);
      if (idx !== -1) projectPool[idx] = activeProject;
    }

    const entries: SearchableFilmEntry[] = [];

    for (const proj of projectPool) {
      if (proj.isMultiFilm && proj.films && proj.films.length > 0) {
        for (const film of proj.films) {
          const isCurrent =
            activeProject?.id === proj.id && (activeFilmId === film.id || (!activeFilmId && film.sequenceIndex === 1));
          entries.push({
            key: `${proj.id}::${film.id}`,
            project: proj,
            filmId: film.id,
            title: film.title,
            director: film.director || proj.director || 'Unknown Director',
            genres: film.genres && film.genres.length > 0 ? film.genres : proj.genres || ['Feature Film'],
            releaseYear: film.releaseYear || proj.releaseYear,
            discLabel: film.discLabel || `Disc ${film.sequenceIndex}`,
            frameRate: film.frameRate,
            pauseCount: film.pauseEvents.length,
            isMultiFilmChild: true,
            isActive: Boolean(isCurrent),
          });
        }
      } else {
        const isCurrent = activeProject?.id === proj.id;
        entries.push({
          key: proj.id,
          project: proj,
          title: proj.title,
          director: proj.director || 'Unknown Director',
          genres: proj.genres && proj.genres.length > 0 ? proj.genres : ['Feature Film'],
          releaseYear: proj.releaseYear,
          discLabel: 'Single Feature',
          frameRate: proj.frameRate,
          pauseCount: proj.pauseEvents.length,
          isMultiFilmChild: false,
          isActive: Boolean(isCurrent),
        });
      }
    }

    return entries;
  }, [activeProject, activeFilmId]);

  // Distinct genres across all indexed films for quick filtering
  const availableGenres = useMemo(() => {
    const set = new Set<string>();
    allFilmEntries.forEach((entry) => {
      entry.genres.forEach((g) => set.add(g));
    });
    return Array.from(set).sort();
  }, [allFilmEntries]);

  // Filter entries by search query (title, genre, or director) and optional genre pill
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allFilmEntries.filter((entry) => {
      if (selectedGenreFilter && !entry.genres.some((g) => g.toLowerCase() === selectedGenreFilter.toLowerCase())) {
        return false;
      }
      if (!q) return true;

      const titleMatch = entry.title.toLowerCase().includes(q);
      const directorMatch = entry.director.toLowerCase().includes(q);
      const genreMatch = entry.genres.some((g) => g.toLowerCase().includes(q));
      const projectTitleMatch = entry.project.title.toLowerCase().includes(q);
      const yearMatch = entry.releaseYear ? String(entry.releaseYear).includes(q) : false;

      return titleMatch || directorMatch || genreMatch || projectTitleMatch || yearMatch;
    });
  }, [allFilmEntries, searchQuery, selectedGenreFilter]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, selectedGenreFilter, isSearchOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global Cmd+K / Ctrl+K shortcut to focus the search bar
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleSelectEntry = (entry: SearchableFilmEntry) => {
    if (onSelectProjectAndFilm) {
      onSelectProjectAndFilm(entry.project, entry.filmId);
    }
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIsSearchOpen(true);
      setHighlightedIndex((prev) => (filteredEntries.length > 0 ? (prev + 1) % filteredEntries.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIsSearchOpen(true);
      setHighlightedIndex((prev) =>
        filteredEntries.length > 0 ? (prev - 1 + filteredEntries.length) % filteredEntries.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isSearchOpen && filteredEntries[highlightedIndex]) {
        handleSelectEntry(filteredEntries[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  return (
    <header className="bg-neutral-900 border-b border-neutral-800 text-neutral-200 select-none w-full relative z-30">
      {/* Row 1: Brand, Active Session, Global Film Search & Utilities */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 sm:px-8 py-3.5 border-b border-neutral-800/80 text-xs">
        {/* Left: Brand & Session Selector */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            <Disc3 className="w-5 h-5 text-amber-500" />
            <span>SyncTrack BD</span>
            <span className="hidden xl:inline text-[10px] font-mono font-normal text-neutral-400 bg-neutral-800/80 border border-neutral-700/60 px-1.5 py-0.5 rounded ml-1">
              Commentary Conform
            </span>
          </div>
          <span className="text-neutral-700 hidden sm:inline shrink-0" aria-hidden="true">/</span>
          <button
            onClick={onOpenProjectSelect}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800/70 hover:bg-neutral-800 rounded border border-neutral-700/70 transition-colors max-w-xs sm:max-w-sm truncate shrink min-w-0"
            title="Click to switch sample session or create new project"
          >
            <FolderOpen className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate font-medium">{projectTitle}</span>
            {isMultiFilm && filmCount ? (
              <span className="text-[10px] text-amber-400 bg-amber-950/60 border border-amber-800/60 px-1.5 py-0.2 rounded font-mono shrink-0 ml-1">
                {filmCount} Films
              </span>
            ) : (
              <span className="text-[10px] text-neutral-400 font-mono shrink-0 ml-1">({frameRate} fps)</span>
            )}
          </button>
        </div>

        {/* Center: Global Movie / Film Search Bar (Title, Genre, Director) */}
        <div ref={searchContainerRef} className="relative flex-1 max-w-md min-w-[240px]">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-950/90 border transition-all ${
              isSearchOpen
                ? 'border-amber-500/80 ring-2 ring-amber-500/20'
                : 'border-neutral-800 hover:border-neutral-700'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Filter films by title, genre, or director..."
              aria-label="Filter films by title, genre, or director"
              className="w-full bg-transparent text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none"
            />
            {selectedGenreFilter && (
              <button
                type="button"
                onClick={() => setSelectedGenreFilter(null)}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono shrink-0 hover:bg-amber-500/30"
                title="Clear genre filter"
              >
                <span>{selectedGenreFilter}</span>
                <X className="w-2.5 h-2.5" />
              </button>
            )}
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  searchInputRef.current?.focus();
                }}
                className="text-neutral-500 hover:text-neutral-200 p-0.5 rounded"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-block text-[10px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800 px-1.5 py-0.5 rounded shrink-0">
                ⌘K
              </kbd>
            )}
          </div>

          {/* Search Results Dropdown */}
          {isSearchOpen && (
            <div className="absolute left-0 right-0 mt-2 bg-neutral-900 border border-neutral-700/90 rounded-xl shadow-2xl overflow-hidden z-50">
              {/* Genre Quick-Filter Bar */}
              <div className="px-3.5 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 flex items-center gap-1 shrink-0 mr-1">
                  <Tag className="w-3 h-3 text-amber-500" />
                  Genre:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedGenreFilter(null)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 ${
                    selectedGenreFilter === null
                      ? 'bg-amber-500 text-neutral-950 font-semibold'
                      : 'bg-neutral-800/80 text-neutral-400 hover:text-white'
                  }`}
                >
                  All ({allFilmEntries.length})
                </button>
                {availableGenres.map((genre) => {
                  const isSelected = selectedGenreFilter === genre;
                  return (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => setSelectedGenreFilter(isSelected ? null : genre)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors shrink-0 ${
                        isSelected
                          ? 'bg-amber-500 text-neutral-950 font-semibold'
                          : 'bg-neutral-800/80 text-neutral-300 hover:bg-neutral-800 hover:text-white'
                      }`}
                    >
                      {genre}
                    </button>
                  );
                })}
              </div>

              {/* Matching Film Results List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/70">
                {filteredEntries.length === 0 ? (
                  <div className="px-4 py-8 text-center text-neutral-400 space-y-1">
                    <p className="text-xs font-medium text-neutral-300">
                      No films match "{searchQuery || selectedGenreFilter}"
                    </p>
                    <p className="text-[11px] text-neutral-500">
                      Try searching by movie title, director (e.g., Kazuo Mori, Ridley Vance, Mamoru Oshii), or genre (e.g., Sci-Fi, Cyberpunk, Chanbara).
                    </p>
                  </div>
                ) : (
                  filteredEntries.map((entry, idx) => {
                    const isHighlighted = idx === highlightedIndex;
                    return (
                      <button
                        key={entry.key}
                        type="button"
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        onClick={() => handleSelectEntry(entry)}
                        className={`w-full text-left px-4 py-3 transition-colors flex items-start justify-between gap-3 ${
                          isHighlighted ? 'bg-neutral-800/90' : 'hover:bg-neutral-800/50'
                        }`}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Film className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs font-semibold text-white truncate">
                              {entry.title}
                            </span>
                            {entry.discLabel && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-neutral-800 border border-neutral-700 text-amber-300">
                                {entry.discLabel}
                              </span>
                            )}
                            {entry.isActive && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/80 border border-emerald-700/70 text-emerald-300">
                                <Check className="w-2.5 h-2.5" />
                                Active
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-neutral-400 flex-wrap">
                            <span className="inline-flex items-center gap-1 text-neutral-300">
                              <User className="w-3 h-3 text-sky-400" />
                              <span>Dir. {entry.director}</span>
                            </span>
                            <span className="text-neutral-600">·</span>
                            <span className="font-mono text-[10px] text-neutral-400">
                              {entry.frameRate} fps · {entry.pauseCount} {entry.pauseCount === 1 ? 'cut' : 'cuts'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {entry.genres.map((g) => (
                              <span
                                key={g}
                                className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-950/90 border border-neutral-800 text-neutral-300"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>

                        <span className="text-[10px] font-mono text-neutral-500 shrink-0 pt-0.5">
                          {entry.isMultiFilmChild ? 'Switch Film' : 'Load Session'}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer Hint */}
              <div className="px-3.5 py-2 bg-neutral-950/90 border-t border-neutral-800 flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                <span>↑↓ Navigate · Enter to Load</span>
                <span>{filteredEntries.length} of {allFilmEntries.length} films shown</span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Session Info & Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          {isMultiFilm && activeFilmTitle && (
            <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-neutral-400 bg-neutral-800/50 border border-neutral-800 px-2 py-0.5 rounded truncate max-w-xs">
              <span className="text-neutral-500">Active Film:</span>
              <span className="text-amber-300 font-medium truncate">{activeFilmTitle}</span>
            </span>
          )}

          {/* Installable Offline Desktop PWA Button & Guide */}
          <PWAInstallButton />

          {onToggleVideoMonitor && (
            <button
              onClick={onToggleVideoMonitor}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors ${
                isVideoMonitorOpen
                  ? 'bg-amber-950/60 text-amber-300 border-amber-800/80 font-medium'
                  : 'text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800/60'
              }`}
              title="Toggle Zoom Webcam Video Monitor (1280x720 @ 25fps)"
            >
              <Video className="w-3.5 h-3.5 text-amber-400" />
              <span>Monitor</span>
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-neutral-800 text-neutral-300 hidden sm:inline">
                720p@25
              </span>
            </button>
          )}

          {onOpenShortcuts && (
            <button
              onClick={onOpenShortcuts}
              className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded border border-neutral-800 hover:border-neutral-700 transition-colors"
              title="Keyboard Shortcuts (?)"
              aria-label="Keyboard Shortcuts"
            >
              <Keyboard className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded border border-neutral-800 hover:border-neutral-700 transition-colors"
            title="Framerate & Session Settings"
            aria-label="Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Row 2: Workspace View Navigation & Action Options */}
      <div className="flex items-center justify-between gap-4 px-6 sm:px-8 py-3 bg-neutral-900/95 text-xs overflow-x-auto scrollbar-none">
        {/* Left: View Tabs */}
        <nav className="flex items-center gap-6 sm:gap-8 text-xs font-medium text-neutral-400 shrink-0">
          <button
            onClick={() => onSelectView('pauses')}
            className={`flex items-center gap-1.5 py-1 whitespace-nowrap transition-colors border-b-2 ${
              currentView === 'pauses'
                ? 'text-white border-amber-500 font-semibold'
                : 'border-transparent hover:text-neutral-200'
            }`}
          >
            <Scissors className="w-3.5 h-3.5 text-amber-500" />
            <span>Pause Cuts</span>
            <span className="text-[10px] font-mono text-neutral-400 font-normal">({pauseCount})</span>
          </button>

          <button
            onClick={() => onSelectView('review')}
            className={`flex items-center gap-1.5 py-1 whitespace-nowrap transition-colors border-b-2 ${
              currentView === 'review'
                ? 'text-white border-amber-500 font-semibold'
                : 'border-transparent hover:text-neutral-200'
            }`}
            title="Inspect and adjust low-confidence cuts, chaotic starts and stops"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
            <span>Context Review</span>
            {unverifiedCutCount > 0 ? (
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 font-semibold animate-pulse">
                {unverifiedCutCount}
              </span>
            ) : (
              <span className="text-[10px] font-mono text-neutral-400 font-normal">({pauseCount})</span>
            )}
          </button>

          <button
            onClick={() => onSelectView('anchors')}
            className={`flex items-center gap-1.5 py-1 whitespace-nowrap transition-colors border-b-2 ${
              currentView === 'anchors'
                ? 'text-white border-amber-500 font-semibold'
                : 'border-transparent hover:text-neutral-200'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-sky-400" />
            <span>Sync Anchors</span>
            <span className="text-[10px] font-mono text-neutral-400 font-normal">({anchorCount})</span>
          </button>

          <button
            onClick={() => onSelectView('transcript')}
            className={`flex items-center gap-1.5 py-1 whitespace-nowrap transition-colors border-b-2 ${
              currentView === 'transcript'
                ? 'text-white border-amber-500 font-semibold'
                : 'border-transparent hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-neutral-400" />
            <span>Transcripts & Cues</span>
          </button>
        </nav>

        {/* Right: Primary Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenAnalyze}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 rounded border border-neutral-700 transition-colors"
            title="Run local on-device sync analysis"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isAnalyzing ? 'Analyzing...' : 'Auto-Sync'}</span>
          </button>

          <button
            onClick={onOpenExport}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  );
};
