import React, { useState } from 'react';
import {
  Plus,
  Sparkles,
  FileVideo,
  Upload,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Check,
  Film,
  Folder,
  Gift,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Image as ImageIcon,
  HelpCircle,
  Search,
  Lock,
} from 'lucide-react';
import { DriveGiftConfig, MovieItem, VideoFormat } from '../types/movie';
import { generateFallbackPosterSvg, getPosterSearchUrls } from '../utils/posterHelper';
import { DownloadedCover, pullMovieCoverFromTmdb, isValidNonCorruptedCover } from '../utils/tmdbService';
import { BatchTmdbPullModal } from './BatchTmdbPullModal';

interface DriveBuilderViewProps {
  movies: MovieItem[];
  config: DriveGiftConfig;
  onUpdateMovies: (movies: MovieItem[]) => void;
  onUpdateConfig: (config: DriveGiftConfig) => void;
  onNavigateToExport: () => void;
  onSelectMovieForPreview: (movie: MovieItem) => void;
  downloadedCovers: Record<string, DownloadedCover>;
  onUpdateCovers: (covers: Record<string, DownloadedCover>) => void;
  tmdbApiKey: string;
  onUpdateTmdbApiKey: (key: string) => void;
  onDeleteAndReplaceCover?: (movieId: string) => Promise<any> | void;
  isReplacingCoverId?: string | null;
  excludedCoverUrls?: Record<string, string[]>;
}

export const DriveBuilderView: React.FC<DriveBuilderViewProps> = ({
  movies,
  config,
  onUpdateMovies,
  onUpdateConfig,
  onNavigateToExport,
  onSelectMovieForPreview,
  downloadedCovers,
  onUpdateCovers,
  tmdbApiKey,
  onUpdateTmdbApiKey,
  onDeleteAndReplaceCover,
  isReplacingCoverId,
  excludedCoverUrls = {},
}) => {
  const [activeTab, setActiveTab] = useState<'catalog' | 'add' | 'settings'>('catalog');
  const [isBatchPullOpen, setIsBatchPullOpen] = useState(false);
  const [isPullingSingleTmdb, setIsPullingSingleTmdb] = useState(false);

  // Add Movie Form State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingAi, setIsSearchingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Form Fields
  const [newTitle, setNewTitle] = useState('');
  const [newYear, setNewYear] = useState<number>(new Date().getFullYear());
  const [newDurationMin, setNewDurationMin] = useState<number>(115);
  const [newDurationFormatted, setNewDurationFormatted] = useState('1h 55m');
  const [newGenres, setNewGenres] = useState<string>('Animation, Adventure, Fantasy');
  const [newRating, setNewRating] = useState('PG');
  const [newSynopsis, setNewSynopsis] = useState('');
  const [newCuratorNote, setNewCuratorNote] = useState('');
  const [newDirector, setNewDirector] = useState('');
  const [newCast, setNewCast] = useState('Lead Actor 1, Actor 2');
  const [newRelativePath, setNewRelativePath] = useState('Movies/MyMovie.mkv');
  const [newFormat, setNewFormat] = useState<VideoFormat>('mkv');
  const [newResolution, setNewResolution] = useState('1080p Blu-ray');
  const [newHasEnglishSubtitles, setNewHasEnglishSubtitles] = useState(true);
  const [newPosterUrl, setNewPosterUrl] = useState(
    'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=800&auto=format&fit=crop'
  );
  const [newBackdropUrl, setNewBackdropUrl] = useState(
    'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?q=80&w=1600&auto=format&fit=crop'
  );

  // Edit Existing Movie Modal
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null);
  const [isPosterGuideOpen, setIsPosterGuideOpen] = useState(false);

  const handlePosterFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setNewPosterUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // AI Lookup function
  const handleAiLookup = async (inputQuery: string) => {
    if (!inputQuery.trim()) return;
    setIsSearchingAi(true);
    setAiError(null);

    try {
      const response = await fetch('/api/movie-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titleOrFilename: inputQuery,
          nieceAgeGroup: 'young-adult',
          personalTone: 'loving-uncle-aunt',
        }),
      });

      if (!response.ok) {
        throw new Error('AI server lookup timed out or failed');
      }

      const data = await response.json();
      setNewTitle(data.title || inputQuery);
      if (data.year) setNewYear(data.year);
      if (data.durationMin) setNewDurationMin(data.durationMin);
      if (data.durationFormatted) setNewDurationFormatted(data.durationFormatted);
      if (data.genres) setNewGenres(data.genres.join(', '));
      if (data.rating) setNewRating(data.rating);
      if (data.synopsis) setNewSynopsis(data.synopsis);
      if (data.curatorNote) setNewCuratorNote(data.curatorNote);
      if (data.director) setNewDirector(data.director);
      if (data.keyCast) setNewCast(data.keyCast.join(', '));
      if (typeof data.hasEnglishSubtitles === 'boolean') setNewHasEnglishSubtitles(data.hasEnglishSubtitles);

      // Derive clean filename
      const cleanFileTitle = (data.title || inputQuery).replace(/[^\w\s-]/gi, '').replace(/\s+/g, '.');
      setNewRelativePath(`Movies/${cleanFileTitle}.${data.year || '2024'}.${newFormat}`);
    } catch (err: any) {
      console.warn('AI lookup error:', err);
      setAiError(err.message || 'Could not auto-fetch movie details. You can still fill it in manually below!');
    } finally {
      setIsSearchingAi(false);
    }
  };

  // Drag-and-drop movie video file from external hard drive
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const filename = file.name;
      const ext = filename.split('.').pop()?.toLowerCase();
      const detectedFormat: VideoFormat =
        ext === 'mkv' ? 'mkv' : ext === 'mp4' ? 'mp4' : ext === 'avi' ? 'avi' : ext === 'mov' ? 'mov' : 'mp4';

      setNewFormat(detectedFormat);
      setNewRelativePath(`Movies/${filename}`);

      // Parse clean title candidates (e.g. "Spirited.Away.2001.1080p.mkv" -> "Spirited Away")
      const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
      const guessedTitle = nameWithoutExt
        .replace(/(\.|\_|\-)/g, ' ')
        .replace(/\b(1080p|720p|4k|2160p|bluray|remux|x264|x265|hevc|web-dl|dts|aac)\b/gi, '')
        .trim();

      setSearchQuery(guessedTitle);
      handleAiLookup(guessedTitle);
    }
  };

  // Save new movie to catalog
  const handleAddMovie = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const movie: MovieItem = {
      id: `movie-${Date.now()}`,
      title: newTitle.trim(),
      year: Number(newYear) || 2024,
      durationMin: Number(newDurationMin) || 110,
      durationFormatted: newDurationFormatted || `${newDurationMin}m`,
      genres: newGenres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean),
      rating: newRating || 'PG',
      synopsis: newSynopsis || 'A compelling movie chosen especially for you.',
      curatorNote: newCuratorNote,
      director: newDirector || 'Various',
      cast: newCast
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      relativeFilePath: newRelativePath || `Movies/${newTitle.replace(/\s+/g, '_')}.${newFormat}`,
      fileFormat: newFormat,
      resolution: newResolution,
      hasEnglishSubtitles: newHasEnglishSubtitles,
      posterUrl: newPosterUrl,
      backdropUrl: newBackdropUrl,
      isFavorite: false,
      isWatched: false,
    };

    onUpdateMovies([...movies, movie]);
    // Reset form
    setNewTitle('');
    setNewSynopsis('');
    setNewCuratorNote('');
    setSearchQuery('');
    setNewHasEnglishSubtitles(true);
    setActiveTab('catalog');
  };

  // Reordering helpers
  const moveMovie = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= movies.length) return;
    const reordered = [...movies];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    onUpdateMovies(reordered);
  };

  const deleteMovie = (id: string) => {
    if (confirm('Are you sure you want to remove this movie from the gift collection?')) {
      onUpdateMovies(movies.filter((m) => m.id !== id));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8">
      {/* Curator Header & Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-neutral-800 pb-5">
        <div>
          <h1 className="text-2xl font-serif font-bold text-neutral-100 flex items-center gap-2">
            <span>Drive Curator & Movie Library</span>
          </h1>
          <p className="text-xs text-neutral-400 mt-1">
            Manage files on your external hard drive, edit synopses, and write personal gift notes for {config.nieceName}.
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1.5 p-1 bg-neutral-900 border border-neutral-800 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'catalog'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Movies ({movies.length})
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'add'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Add Movie</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-3.5 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm border border-neutral-700/60'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Gift className="w-3.5 h-3.5 text-rose-400" />
            <span>Gift Dedication</span>
          </button>
        </div>
      </div>

      {/* TAB 1: CATALOG OVERVIEW */}
      {activeTab === 'catalog' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="text-xs text-neutral-400">
              Arranged in the order {config.nieceName} will see them on the hard drive menu.
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsBatchPullOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 font-semibold text-xs shadow-sm transition-all"
                title="Pull official high-res posters from TMDB and save them directly to the Covers/ folder"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {movies.filter((m) => isValidNonCorruptedCover(downloadedCovers[m.id])).length ===
                  movies.length
                    ? `✓ All ${movies.length} Covers Locked in Covers/`
                    : `Pull Covers from TMDB (${
                        movies.filter((m) => isValidNonCorruptedCover(downloadedCovers[m.id])).length
                      }/${movies.length} Locked)`}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('add')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-neutral-950 font-bold text-xs hover:bg-amber-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Movie</span>
              </button>
              <button
                onClick={onNavigateToExport}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 text-xs font-medium transition-colors"
              >
                <span>Export Drive Kit →</span>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {movies.map((movie, index) => (
              <div
                key={movie.id}
                className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-neutral-700 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  {/* Order & Reorder arrows */}
                  <div className="flex flex-col items-center gap-1 text-neutral-500">
                    <button
                      onClick={() => moveMovie(index, 'up')}
                      disabled={index === 0}
                      className="p-1 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move up"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-[11px] font-mono text-neutral-400 font-bold">
                      {index + 1}
                    </span>
                    <button
                      onClick={() => moveMovie(index, 'down')}
                      disabled={index === movies.length - 1}
                      className="p-1 hover:text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move down"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Thumbnail */}
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-14 h-20 object-cover rounded-md bg-neutral-950 border border-neutral-800 flex-shrink-0"
                  />

                  {/* Title & Metadata */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-neutral-100">{movie.title}</h3>
                      <span className="text-xs text-neutral-400">({movie.year})</span>
                      <span className="font-mono text-[10px] uppercase bg-neutral-800 px-1.5 py-0.5 rounded text-neutral-300 border border-neutral-700/60 font-bold">
                        .{movie.fileFormat}
                      </span>
                      {isValidNonCorruptedCover(downloadedCovers[movie.id]) ? (
                        <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-900/60 px-1.5 py-0.5 rounded font-medium flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" />
                          <span>Cover Locked</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-500 bg-neutral-850 px-1.5 py-0.5 rounded">
                          No Local Cover
                        </span>
                      )}
                      {movie.isFavorite && (
                        <span className="text-[11px] text-rose-400 font-medium">❤️ Favorite</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                      <span>{movie.durationFormatted}</span>
                      <span aria-hidden="true" className="text-neutral-600">·</span>
                      <span>{movie.rating}</span>
                      <span aria-hidden="true" className="text-neutral-600">·</span>
                      <span>{movie.genres.join(', ')}</span>
                    </div>

                    <div className="text-xs text-neutral-500 truncate font-mono">
                      Drive Path: <span className="text-neutral-400">{movie.relativeFilePath}</span>
                    </div>

                    {movie.curatorNote && (
                      <p className="text-xs text-amber-300/80 italic line-clamp-1">
                        "{movie.curatorNote}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-neutral-800">
                  <button
                    onClick={() => onSelectMovieForPreview(movie)}
                    className="px-3 py-1.5 rounded-md bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-medium"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => deleteMovie(movie.id)}
                    className="p-1.5 rounded-md hover:bg-rose-950/40 text-neutral-400 hover:text-rose-400 transition-colors"
                    title="Remove movie"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: ADD MOVIE FORM WITH AI & FILE DRAG */}
      {activeTab === 'add' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Quick File Drop & AI Search */}
          <div className="lg:col-span-1 space-y-6">
            {/* Drag & Drop Hard Drive File Box */}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleFileDrop}
              className="border-2 border-dashed border-neutral-700 hover:border-amber-500/60 rounded-xl p-6 text-center bg-neutral-900/50 hover:bg-neutral-900 transition-all cursor-pointer group"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-800 group-hover:bg-amber-500/20 text-neutral-400 group-hover:text-amber-400 flex items-center justify-center mx-auto mb-3 transition-colors">
                <FileVideo className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-neutral-200">
                Drop Movie File From Hard Drive
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                Drag any <code className="text-amber-400">.mkv</code> or <code className="text-amber-400">.mp4</code> file directly here to auto-detect filename, format, and size!
              </p>
            </div>

            {/* Smart Movie Lookup Search */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-neutral-200">AI Film Auto-Fill</h3>
              </div>
              <p className="text-xs text-neutral-400">
                Type any movie name or raw filename to instantly fetch synopsis, duration, genre, year, and craft a loving personal note.
              </p>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAiLookup(searchQuery)}
                  placeholder="e.g. Spirited Away or Spider-Verse"
                  className="flex-1 px-3 py-2 bg-neutral-950 border border-neutral-750 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-amber-500/60"
                />
                <button
                  type="button"
                  onClick={() => handleAiLookup(searchQuery)}
                  disabled={isSearchingAi || !searchQuery.trim()}
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-neutral-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  {isSearchingAi ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Fill</span>
                </button>
              </div>

              {aiError && (
                <div className="flex items-start gap-2 p-3 bg-rose-950/30 border border-rose-900/50 rounded-lg text-xs text-rose-300">
                  <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Detailed Movie Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleAddMovie} className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-5">
              <h3 className="text-sm font-semibold text-neutral-100 pb-2 border-b border-neutral-800">
                Movie Details & File Attributes
              </h3>

              {/* Title & Year */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-neutral-300">Movie Title</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Spirited Away"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-300">Release Year</label>
                  <input
                    type="number"
                    value={newYear}
                    onChange={(e) => setNewYear(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Duration & Age Rating */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-300">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={newDurationMin}
                    onChange={(e) => {
                      const min = Number(e.target.value);
                      setNewDurationMin(min);
                      const hrs = Math.floor(min / 60);
                      const rem = min % 60;
                      setNewDurationFormatted(hrs > 0 ? `${hrs}h ${rem}m` : `${rem}m`);
                    }}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-300">Formatted Duration</label>
                  <input
                    type="text"
                    value={newDurationFormatted}
                    onChange={(e) => setNewDurationFormatted(e.target.value)}
                    placeholder="e.g. 2h 5m"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-300">Age Rating</label>
                  <select
                    value={newRating}
                    onChange={(e) => setNewRating(e.target.value)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="G">G (General Audiences)</option>
                    <option value="PG">PG (Parental Guidance)</option>
                    <option value="PG-13">PG-13 (Parents Strongly Cautioned)</option>
                    <option value="R">R (Restricted)</option>
                    <option value="All Ages">All Ages</option>
                  </select>
                </div>
              </div>

              {/* Genres */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-300">Genres (Comma separated)</label>
                <input
                  type="text"
                  value={newGenres}
                  onChange={(e) => setNewGenres(e.target.value)}
                  placeholder="e.g. Animation, Adventure, Fantasy"
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Synopsis */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-neutral-300">Short Synopsis</label>
                <textarea
                  rows={3}
                  required
                  value={newSynopsis}
                  onChange={(e) => setNewSynopsis(e.target.value)}
                  placeholder="Engaging 2-3 sentence description of the plot..."
                  className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* Personal Curator Note */}
              <div className="space-y-1 bg-amber-950/20 border border-amber-900/40 p-3.5 rounded-lg">
                <label className="text-xs font-medium text-amber-300 flex items-center gap-1.5">
                  <Gift className="w-3.5 h-3.5 text-amber-400" />
                  <span>Personal Note to {config.nieceName} ("Why I picked this for you")</span>
                </label>
                <textarea
                  rows={2}
                  value={newCuratorNote}
                  onChange={(e) => setNewCuratorNote(e.target.value)}
                  placeholder={`Write a personal message explaining why you wanted ${config.nieceName} to see this...`}
                  className="w-full px-3 py-2 bg-neutral-950/80 border border-amber-900/50 rounded-lg text-xs text-amber-100 placeholder-neutral-500 focus:outline-none focus:border-amber-500 leading-relaxed"
                />
              </div>

              {/* File Specs & Relative Path on External Drive */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-300">
                    File Format
                  </label>
                  <select
                    value={newFormat}
                    onChange={(e) => setNewFormat(e.target.value as VideoFormat)}
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value="mkv">.mkv (Matroska HD / Multi-audio / Subtitles)</option>
                    <option value="mp4">.mp4 (MPEG-4 Standard / Universal compatibility)</option>
                    <option value="avi">.avi (Audio Video Interleave)</option>
                    <option value="mov">.mov (QuickTime)</option>
                    <option value="webm">.webm (Web Media)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-300">
                    Relative Path on Hard Drive
                  </label>
                  <input
                    type="text"
                    value={newRelativePath}
                    onChange={(e) => setNewRelativePath(e.target.value)}
                    placeholder="e.g. Movies/Spirited_Away_2001.mkv"
                    className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Poster Image Management */}
              <div className="space-y-2 bg-neutral-950 p-4 rounded-xl border border-neutral-850">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-neutral-200 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Movie Cover / Poster Artwork</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPosterGuideOpen(true)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 underline underline-offset-2"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>Where are posters sourced?</span>
                  </button>
                </div>

                <div className="flex gap-4 items-start">
                  {/* Poster Preview */}
                  <div className="w-20 h-28 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex-shrink-0 relative group">
                    <img
                      src={newPosterUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = generateFallbackPosterSvg(
                          newTitle || 'Movie Title',
                          newYear,
                          newGenres.split(',')[0] || 'Film',
                          newRating
                        );
                      }}
                    />
                  </div>

                  {/* Options */}
                  <div className="flex-1 space-y-2.5">
                    <input
                      type="text"
                      value={newPosterUrl}
                      onChange={(e) => setNewPosterUrl(e.target.value)}
                      placeholder="Image URL or relative path (e.g. Movies/Covers/MyMovie.jpg)"
                      className="w-full px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-100 font-mono focus:outline-none focus:border-amber-500"
                    />

                    {/* Sourcing Actions */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {/* Upload local image */}
                      <label className="cursor-pointer px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors">
                        <Upload className="w-3 h-3 text-amber-400" />
                        <span>Upload Image File</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePosterFileUpload}
                          className="hidden"
                        />
                      </label>

                      {/* Pull from TMDB & Save to Covers/ */}
                      <button
                        type="button"
                        disabled={!newTitle.trim() || isPullingSingleTmdb}
                        onClick={async () => {
                          if (!newTitle.trim()) return;
                          setIsPullingSingleTmdb(true);
                          try {
                            const cover = await pullMovieCoverFromTmdb({
                              id: `temp-${Date.now()}`,
                              title: newTitle,
                              year: newYear,
                              durationMin: newDurationMin,
                              durationFormatted: newDurationFormatted,
                              genres: newGenres.split(',').map((g) => g.trim()),
                              rating: newRating,
                              synopsis: newSynopsis,
                              curatorNote: newCuratorNote,
                              director: newDirector,
                              cast: [],
                              relativeFilePath: newRelativePath,
                              fileFormat: newFormat,
                              posterUrl: '',
                              backdropUrl: '',
                            }, tmdbApiKey);

                            setNewPosterUrl(cover.localRelativePath);
                            const tempId = `temp-${newTitle}`;
                            onUpdateCovers({ ...downloadedCovers, [tempId]: cover });
                          } catch (e: any) {
                            alert(e.message || 'Could not fetch from TMDB');
                          } finally {
                            setIsPullingSingleTmdb(false);
                          }
                        }}
                        className="px-2.5 py-1 rounded bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 flex items-center gap-1.5 transition-colors font-medium disabled:opacity-50"
                        title="Pull official poster from TMDB and save to Covers/ directory"
                      >
                        {isPullingSingleTmdb ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-cyan-400" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-cyan-400" />
                        )}
                        <span>Pull from TMDB (Save to Covers/)</span>
                      </button>

                      {/* Generate Offline SVG Poster */}
                      <button
                        type="button"
                        onClick={() => {
                          const svgData = generateFallbackPosterSvg(
                            newTitle || 'Movie Title',
                            newYear,
                            newGenres.split(',')[0] || 'Film',
                            newRating
                          );
                          setNewPosterUrl(svgData);
                        }}
                        className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 flex items-center gap-1.5 transition-colors"
                        title="Generates a 100% offline typographic poster stored directly in the menu"
                      >
                        <Sparkles className="w-3 h-3 text-cyan-400" />
                        <span>Generate Offline Poster</span>
                      </button>

                      {/* Quick external search links */}
                      {newTitle && (
                        <>
                          <a
                            href={getPosterSearchUrls(newTitle, newYear).tmdb}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border border-neutral-750 flex items-center gap-1 text-[11px]"
                          >
                            <span>TMDB</span>
                            <ExternalLink className="w-2.5 h-2.5 text-neutral-500" />
                          </a>
                          <a
                            href={getPosterSearchUrls(newTitle, newYear).imdb}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border border-neutral-750 flex items-center gap-1 text-[11px]"
                          >
                            <span>IMDb</span>
                            <ExternalLink className="w-2.5 h-2.5 text-neutral-500" />
                          </a>
                          <a
                            href={getPosterSearchUrls(newTitle, newYear).google}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 rounded bg-neutral-850 hover:bg-neutral-800 text-neutral-300 border border-neutral-750 flex items-center gap-1 text-[11px]"
                          >
                            <Search className="w-2.5 h-2.5 text-neutral-400" />
                            <span>Google</span>
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('catalog')}
                  className="px-4 py-2 rounded-lg text-neutral-400 hover:text-neutral-200 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-colors"
                >
                  Save Movie to Drive Menu
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: GIFT DEDICATION & HARD DRIVE CONFIG */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
            <Gift className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-semibold text-neutral-100">Gift Dedication & Drive Settings</h3>
              <p className="text-xs text-neutral-400">
                Personalize the experience specifically for your niece.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-300">Niece's Name</label>
              <input
                type="text"
                value={config.nieceName}
                onChange={(e) => onUpdateConfig({ ...config, nieceName: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-neutral-300">Your Name (Giver)</label>
              <input
                type="text"
                value={config.curatorName}
                onChange={(e) => onUpdateConfig({ ...config, curatorName: e.target.value })}
                className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-300">Drive Menu Title</label>
            <input
              type="text"
              value={config.driveTitle}
              onChange={(e) => onUpdateConfig({ ...config, driveTitle: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-300">Gift Occasion</label>
            <input
              type="text"
              value={config.giftOccasion}
              onChange={(e) => onUpdateConfig({ ...config, giftOccasion: e.target.value })}
              placeholder="e.g. Birthday, Christmas, College Care Package"
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-300">
              Personal Welcome Letter / Dedication
            </label>
            <textarea
              rows={6}
              value={config.welcomeMessage}
              onChange={(e) => onUpdateConfig({ ...config, welcomeMessage: e.target.value })}
              className="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-100 focus:outline-none focus:border-amber-500 leading-relaxed font-sans"
            />
            <p className="text-[11px] text-neutral-500">
              This message appears in the "💌 Read Gift Letter" pop-up on the hard drive menu and in the included README.txt.
            </p>
          </div>

          <div className="pt-3 border-t border-neutral-800 flex justify-end">
            <button
              onClick={() => setActiveTab('catalog')}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-lg transition-colors"
            >
              Done / Return to Movies
            </button>
          </div>
        </div>
      )}

      {/* Poster Artwork Sourcing Guide Modal */}
      {isPosterGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-serif font-bold text-neutral-100">Where Are Film Covers Sourced?</h3>
                  <p className="text-xs text-neutral-400">Everything you need to know for your external hard drive gift.</p>
                </div>
              </div>
              <button
                onClick={() => setIsPosterGuideOpen(false)}
                className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 space-y-1.5">
                <div className="font-semibold text-amber-400 flex items-center gap-1.5">
                  <span>1. Current Sample Films (Unsplash CDN)</span>
                </div>
                <p className="text-neutral-400">
                  The initial 8 sample movies bundled in CineDrive use royalty-free, high-resolution cinema photography from <strong>Unsplash</strong> to provide instant aesthetic mockups without requiring copyright downloads.
                </p>
              </div>

              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 space-y-1.5">
                <div className="font-semibold text-emerald-400 flex items-center gap-1.5">
                  <span>2. Best Method for Your Drive: Local Images in `Movies/Covers/`</span>
                </div>
                <p className="text-neutral-400">
                  Since your niece will use this on an <strong>offline external hard drive</strong>, the best approach is to save images directly on the drive!
                </p>
                <div className="bg-neutral-900 p-2.5 rounded font-mono text-[11px] text-neutral-300 space-y-1">
                  <div>📁 External Hard Drive /</div>
                  <div className="pl-4">📁 Movies /</div>
                  <div className="pl-8 text-amber-300">📁 Covers /</div>
                  <div className="pl-12 text-neutral-400">Spirited_Away.jpg</div>
                  <div className="pl-12 text-neutral-400">Spider-Verse.jpg</div>
                </div>
                <p className="text-neutral-400">
                  Then simply set the Cover URL in CineDrive to <code className="text-amber-400">Movies/Covers/Spirited_Away.jpg</code>. It will load 100% offline with zero internet!
                </p>
              </div>

              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 space-y-2">
                <div className="font-semibold text-cyan-400">
                  3. Where to Download Official Theatrical Posters
                </div>
                <div className="space-y-1.5 text-neutral-400">
                  <div>• <strong className="text-neutral-200">The Movie Database (TMDB)</strong> (themoviedb.org): Free community database with high-resolution official posters and clean textless artwork.</div>
                  <div>• <strong className="text-neutral-200">The Poster Database (TPDb)</strong> (theposterdb.com): Fan-curated ultra-high-definition poster collections and matching sets.</div>
                  <div>• <strong className="text-neutral-200">IMDb / Wikipedia</strong>: Official theatrical release one-sheets.</div>
                </div>
              </div>

              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-850 space-y-1.5">
                <div className="font-semibold text-violet-400">
                  4. Automatic Offline Typographic Fallback
                </div>
                <p className="text-neutral-400">
                  If an image URL fails (e.g., if she opens the drive on an airplane or cabin without Wi-Fi), CineDrive will <strong>never display a broken image icon</strong>. It automatically generates a cinema typographic poster card displaying the movie's title, release year, genre, and age rating!
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-neutral-800 flex justify-end">
              <button
                onClick={() => setIsPosterGuideOpen(false)}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-semibold text-xs rounded-lg transition-colors"
              >
                Got it, Thanks!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch TMDB Pull & Save to Covers/ Modal */}
      <BatchTmdbPullModal
        isOpen={isBatchPullOpen}
        onClose={() => setIsBatchPullOpen(false)}
        movies={movies}
        onMoviesUpdated={onUpdateMovies}
        downloadedCovers={downloadedCovers}
        onCoversUpdated={onUpdateCovers}
        tmdbApiKey={tmdbApiKey}
        onUpdateTmdbApiKey={onUpdateTmdbApiKey}
      />
    </div>
  );
};
