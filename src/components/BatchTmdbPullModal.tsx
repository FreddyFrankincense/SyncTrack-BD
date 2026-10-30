import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder,
  X,
  ExternalLink,
  Key,
  Download,
  Image as ImageIcon,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { MovieItem } from '../types/movie';
import {
  DownloadedCover,
  batchPullAllCovers,
  pullMovieCoverFromTmdb,
  isValidNonCorruptedCover,
} from '../utils/tmdbService';

interface BatchTmdbPullModalProps {
  isOpen: boolean;
  onClose: () => void;
  movies: MovieItem[];
  onMoviesUpdated: (movies: MovieItem[]) => void;
  downloadedCovers: Record<string, DownloadedCover>;
  onCoversUpdated: (covers: Record<string, DownloadedCover>) => void;
  tmdbApiKey: string;
  onUpdateTmdbApiKey: (key: string) => void;
}

export const BatchTmdbPullModal: React.FC<BatchTmdbPullModalProps> = ({
  isOpen,
  onClose,
  movies,
  onMoviesUpdated,
  downloadedCovers,
  onCoversUpdated,
  tmdbApiKey,
  onUpdateTmdbApiKey,
}) => {
  const [isPulling, setIsPulling] = useState(false);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    currentTitle?: string;
    skippedCount: number;
    pulledCount: number;
  }>({
    current: 0,
    total: movies.length,
    skippedCount: 0,
    pulledCount: 0,
  });

  const [movieStatuses, setMovieStatuses] = useState<
    Record<
      string,
      {
        status: 'idle' | 'pulling' | 'success' | 'error' | 'skipped';
        message?: string;
        cover?: DownloadedCover;
        isLocked?: boolean;
      }
    >
  >({});
  const [isKeyConfigOpen, setIsKeyConfigOpen] = useState(false);

  if (!isOpen) return null;

  // Count how many movies already have a valid non-blank non-corrupted cover
  const verifiedCount = movies.filter((m) =>
    isValidNonCorruptedCover(downloadedCovers[m.id])
  ).length;

  const allVerified = verifiedCount === movies.length && movies.length > 0;

  const handleStartBatchPull = async () => {
    setIsPulling(true);
    let skipped = 0;
    let pulled = 0;

    setProgress({
      current: 0,
      total: movies.length,
      skippedCount: 0,
      pulledCount: 0,
    });

    // Initialize statuses
    const initialStatuses: typeof movieStatuses = {};
    movies.forEach((m) => {
      const existing = downloadedCovers[m.id];
      if (isValidNonCorruptedCover(existing)) {
        initialStatuses[m.id] = {
          status: 'skipped',
          message: `Locked in Covers/ (${Math.round((existing.byteLength || 0) / 1024)} KB) — no further search needed`,
          cover: existing,
          isLocked: true,
        };
        skipped++;
      } else {
        initialStatuses[m.id] = { status: 'idle' };
      }
    });
    setMovieStatuses(initialStatuses);

    // Run batch pull: will strictly skip any film with a valid non-corrupted cover!
    const { updatedMovies, coversMap, successCount, skippedCount } = await batchPullAllCovers(
      movies,
      downloadedCovers,
      tmdbApiKey,
      (idx, total, movie, cover, err, isSkipped) => {
        if (isSkipped) skipped++;
        else if (cover) pulled++;

        setProgress({
          current: idx,
          total,
          currentTitle: movie.title,
          skippedCount: skipped,
          pulledCount: pulled,
        });

        setMovieStatuses((prev) => ({
          ...prev,
          [movie.id]: {
            status: err ? 'error' : isSkipped ? 'skipped' : cover ? 'success' : 'pulling',
            message: err
              ? err
              : isSkipped
              ? `Locked & Preserved (${Math.round((cover?.byteLength || 0) / 1024)} KB) — skipped`
              : cover
              ? `Saved to ${cover.localRelativePath} (${Math.round(cover.byteLength / 1024)} KB)`
              : 'Searching TMDB...',
            cover: cover,
            isLocked: Boolean(cover && isValidNonCorruptedCover(cover)),
          },
        }));
      }
    );

    // Update state with newly saved covers
    onCoversUpdated(coversMap);
    onMoviesUpdated(updatedMovies);
    setIsPulling(false);
  };

  const handlePullSingle = async (movie: MovieItem) => {
    // Check if already valid and locked
    const existing = downloadedCovers[movie.id];
    if (isValidNonCorruptedCover(existing)) {
      setMovieStatuses((prev) => ({
        ...prev,
        [movie.id]: {
          status: 'skipped',
          message: `Cover already verified & locked (${Math.round((existing.byteLength || 0) / 1024)} KB). No further search needed.`,
          cover: existing,
          isLocked: true,
        },
      }));
      return;
    }

    setMovieStatuses((prev) => ({
      ...prev,
      [movie.id]: { status: 'pulling', message: 'Pulling from TMDB...' },
    }));

    try {
      const cover = await pullMovieCoverFromTmdb(movie, tmdbApiKey, null);
      const newCovers = { ...downloadedCovers, [movie.id]: cover };
      onCoversUpdated(newCovers);

      // Update movie poster path to local Covers/
      const updatedMovies = movies.map((m) =>
        m.id === movie.id ? { ...m, posterUrl: cover.localRelativePath } : m
      );
      onMoviesUpdated(updatedMovies);

      setMovieStatuses((prev) => ({
        ...prev,
        [movie.id]: {
          status: 'success',
          message: `Verified & Saved to ${cover.localRelativePath} (${Math.round(cover.byteLength / 1024)} KB)`,
          cover,
          isLocked: true,
        },
      }));
    } catch (err: any) {
      setMovieStatuses((prev) => ({
        ...prev,
        [movie.id]: { status: 'error', message: err.message || 'Image corrupted or not found' },
      }));
    }
  };

  const percentComplete =
    movies.length > 0 ? Math.round((progress.current / movies.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif font-bold text-neutral-100 flex items-center gap-2">
                <span>Pull Film Covers & Save to "Covers" Folder</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Non-blank, uncorrupted images are permanently locked in <code className="text-amber-400">Covers/</code> with no further search attempts.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Integrity Lock Guarantee Banner */}
          <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-4 flex items-start gap-3">
            <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs text-neutral-300 leading-relaxed">
              <div className="font-semibold text-emerald-300">
                Image Integrity Lock Active
              </div>
              <p className="text-neutral-400">
                Whenever a valid, non-blank, uncorrupted image is verified and saved for a film, it is permanently locked in your drive's <code className="text-amber-300">Covers/</code> cache. The system will <strong>make no further attempts at searching, downloading, or updating it</strong>, protecting your saved artwork and eliminating unnecessary API calls.
              </p>
            </div>
          </div>

          {/* Directory & Progress Status */}
          <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Folder className="w-4 h-4 text-amber-400" />
                <span className="text-neutral-300">
                  Target Hard Drive Directory: <strong className="text-amber-300 font-mono">/Covers/</strong>
                </span>
              </div>
              <div className="text-neutral-300 font-medium">
                Verified & Locked: <strong className="text-emerald-400">{verifiedCount}</strong> of {movies.length} movies
              </div>
            </div>

            {/* Progress Bar during execution */}
            {isPulling && (
              <div className="space-y-1.5">
                <div className="w-full bg-neutral-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 via-cyan-500 to-amber-500 h-full transition-all duration-300"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-neutral-400">
                  <span>Processing: {progress.currentTitle}</span>
                  <span>
                    {progress.current} / {progress.total} ({percentComplete}%) · {progress.skippedCount} locked (skipped), {progress.pulledCount} pulled
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Trigger Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-cyan-950/20 border border-cyan-900/40 rounded-xl">
            <div className="space-y-1 text-xs">
              <div className="font-semibold text-cyan-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>
                  {allVerified
                    ? 'All film covers are verified, saved, and locked'
                    : `${movies.length - verifiedCount} ${movies.length - verifiedCount === 1 ? 'film needs' : 'films need'} a cover pulled`}
                </span>
              </div>
              <p className="text-neutral-400 leading-relaxed">
                {allVerified
                  ? 'Every movie has a valid uncorrupted cover in Covers/. No further searches will be performed.'
                  : 'Only films that do not have a verified cover will be searched. Existing valid covers will be skipped.'}
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {allVerified ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold bg-emerald-950/60 border border-emerald-800/80 px-4 py-2 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>All Locked (Zero Searches Needed)</span>
                </div>
              ) : (
                <button
                  onClick={handleStartBatchPull}
                  disabled={isPulling}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-neutral-950 font-bold text-xs shadow-md transition-all active:scale-95"
                >
                  {isPulling ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isPulling
                      ? 'Processing...'
                      : `Pull Remaining (${movies.length - verifiedCount} Films)`}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Optional TMDB API Key accordion */}
          <div className="border border-neutral-800 rounded-xl overflow-hidden text-xs">
            <button
              onClick={() => setIsKeyConfigOpen(!isKeyConfigOpen)}
              className="w-full px-4 py-2.5 bg-neutral-950/60 hover:bg-neutral-950 flex items-center justify-between text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>TMDB API Key (Optional — Free built-in archive fallback active)</span>
              </div>
              <span className="text-[11px] text-cyan-400 font-medium">
                {isKeyConfigOpen ? 'Hide' : 'Configure Key'}
              </span>
            </button>

            {isKeyConfigOpen && (
              <div className="p-4 bg-neutral-950 border-t border-neutral-850 space-y-2">
                <p className="text-neutral-400 leading-relaxed text-[11px]">
                  CineDrive includes an automatic fallback that pulls official high-res posters even without an API key. If you have your own personal free TMDB API key, you can enter it here:
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tmdbApiKey}
                    onChange={(e) => onUpdateTmdbApiKey(e.target.value)}
                    placeholder="Enter TMDB v3 API Key (e.g. 3a7b...)"
                    className="flex-1 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-lg text-xs font-mono text-neutral-100 focus:outline-none focus:border-cyan-500"
                  />
                  <a
                    href="https://www.themoviedb.org/settings/api"
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded-lg text-xs flex items-center gap-1"
                  >
                    <span>Get Key</span>
                    <ExternalLink className="w-3 h-3 text-neutral-400" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Film Covers List with Lock Status */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
              <span>Film Poster Status & Lock State</span>
              <span className="text-[11px] text-neutral-500 lowercase font-normal">
                {verifiedCount} locked, {movies.length - verifiedCount} remaining
              </span>
            </h4>

            <div className="space-y-2">
              {movies.map((movie) => {
                const cover = downloadedCovers[movie.id] || movieStatuses[movie.id]?.cover;
                const statusInfo = movieStatuses[movie.id];
                const isCurrentPulling = statusInfo?.status === 'pulling';
                const isVerifiedAndLocked = isValidNonCorruptedCover(cover);

                return (
                  <div
                    key={movie.id}
                    className="bg-neutral-950 p-3 rounded-xl border border-neutral-850 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Image Thumbnail Preview */}
                      <div className="w-10 h-14 bg-neutral-900 rounded overflow-hidden flex-shrink-0 border border-neutral-800 relative">
                        <img
                          src={
                            cover && cover.base64
                              ? `data:${cover.mimeType};base64,${cover.base64}`
                              : movie.posterUrl
                          }
                          alt={movie.title}
                          className="w-full h-full object-cover"
                        />
                        {isVerifiedAndLocked && (
                          <div className="absolute top-1 right-1 bg-neutral-950/90 rounded p-0.5 text-emerald-400">
                            <Lock className="w-2.5 h-2.5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 space-y-0.5">
                        <div className="font-semibold text-neutral-200 truncate flex items-center gap-1.5">
                          <span>{movie.title}</span>
                          <span className="text-neutral-500 text-[11px]">({movie.year})</span>
                        </div>
                        <div className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                          <span>{movie.genres[0]}</span>
                          {cover && cover.byteLength && (
                            <>
                              <span aria-hidden="true" className="text-neutral-600">·</span>
                              <span className="text-neutral-500">
                                {Math.round(cover.byteLength / 1024)} KB ({cover.mimeType})
                              </span>
                            </>
                          )}
                        </div>
                        <div className="font-mono text-[11px] truncate">
                          {isVerifiedAndLocked ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Locked: {cover?.localRelativePath}</span>
                            </span>
                          ) : (
                            <span className="text-amber-400/80">Pending search / no cover</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isVerifiedAndLocked ? (
                        <div className="flex items-center gap-1 text-emerald-400 font-medium text-[11px] bg-emerald-950/40 border border-emerald-900/60 px-2.5 py-1 rounded-md">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Locked</span>
                        </div>
                      ) : isCurrentPulling ? (
                        <div className="flex items-center gap-1 text-cyan-400 text-[11px]">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Pulling...</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handlePullSingle(movie)}
                          disabled={isPulling}
                          className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-[11px] border border-neutral-750 flex items-center gap-1 transition-colors"
                        >
                          <Download className="w-3 h-3 text-cyan-400" />
                          <span>Pull</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            {verifiedCount} of {movies.length} posters verified and locked in Covers/
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-semibold text-xs rounded-lg transition-colors"
          >
            Close / Done
          </button>
        </div>
      </div>
    </div>
  );
};
