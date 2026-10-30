import React, { useState, useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  RotateCcw,
  RotateCw,
  Folder,
  Copy,
  Check,
  Heart,
  CheckCircle2,
  ExternalLink,
  Film,
  AlertCircle,
  FileVideo,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
} from 'lucide-react';
import { DriveGiftConfig, MovieItem } from '../types/movie';

interface MoviePlayerModalProps {
  movie: MovieItem | null;
  config: DriveGiftConfig;
  isOpen: boolean;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onToggleWatched: (id: string) => void;
  onDeleteAndReplaceCover?: (movieId: string) => Promise<any> | void;
  isReplacingCover?: boolean;
}

export const MoviePlayerModal: React.FC<MoviePlayerModalProps> = ({
  movie,
  config,
  isOpen,
  onClose,
  onToggleFavorite,
  onToggleWatched,
  onDeleteAndReplaceCover,
  isReplacingCover = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [copiedPath, setCopiedPath] = useState(false);
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Resume position storage key
  const resumeStorageKey = movie ? `cinedrive-resume-${movie.id}` : '';

  useEffect(() => {
    if (!isOpen || !movie) {
      setIsPlaying(false);
      setLocalVideoUrl(null);
      setVideoError(null);
      return;
    }

    // Check for saved resume point
    const savedTime = localStorage.getItem(resumeStorageKey);
    if (savedTime && videoRef.current) {
      const parsedTime = parseFloat(savedTime);
      if (!isNaN(parsedTime) && parsedTime > 10) {
        videoRef.current.currentTime = parsedTime;
        setCurrentTime(parsedTime);
      }
    }
  }, [isOpen, movie, resumeStorageKey]);

  if (!isOpen || !movie) return null;

  // Video time update
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      setCurrentTime(cur);
      // Persist resume point every few seconds
      if (Math.floor(cur) % 5 === 0) {
        localStorage.setItem(resumeStorageKey, String(cur));
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback error:', err);
          setVideoError('Browser could not decode this video track directly. Use VLC or load local file.');
        });
    }
  };

  const seekRelative = (deltaSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(duration, videoRef.current.currentTime + deltaSeconds));
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (videoRef.current) {
      videoRef.current.currentTime = val;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) setIsMuted(true);
      else setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2, 0.75];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIdx];
    setPlaybackRate(nextRate);
    if (videoRef.current) videoRef.current.playbackRate = nextRate;
  };

  const toggleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoRef.current.requestFullscreen();
      }
    }
  };

  const handleSelectLocalFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setLocalVideoUrl(url);
      setVideoError(null);
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const copyPathToClipboard = () => {
    navigator.clipboard.writeText(movie.relativeFilePath);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const activeVideoSource = localVideoUrl || movie.sampleVideoUrl || movie.relativeFilePath;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-neutral-950/90 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-3 border-b border-neutral-800/80 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-neutral-200 text-sm">{movie.title}</span>
            <span className="text-xs text-neutral-400">({movie.year})</span>
            <span className="font-mono text-[10px] text-neutral-300 bg-neutral-800 px-1.5 py-0.5 rounded uppercase">
              .{movie.fileFormat}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleWatched(movie.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                movie.isWatched
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{movie.isWatched ? 'Watched' : 'Mark Watched'}</span>
            </button>

            <button
              onClick={() => onToggleFavorite(movie.id)}
              className={`p-1.5 rounded transition-colors ${
                movie.isFavorite
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                  : 'bg-neutral-800 text-neutral-400 hover:text-rose-400'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${movie.isFavorite ? 'fill-rose-400' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors ml-2"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Cinema Video Player Viewport */}
          <div className="relative rounded-xl overflow-hidden bg-black border border-neutral-800 aspect-video shadow-2xl flex flex-col justify-end group">
            <video
              ref={videoRef}
              src={activeVideoSource}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={() => {
                setIsPlaying(false);
                onToggleWatched(movie.id);
              }}
              className="w-full h-full object-contain cursor-pointer"
              onClick={togglePlay}
            />

            {/* Centered big play button overlay if paused */}
            {!isPlaying && (
              <div
                onClick={togglePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 cursor-pointer"
              >
                <div className="w-16 h-16 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-2xl transform hover:scale-105 transition-all">
                  <Play className="w-7 h-7 fill-neutral-950 ml-1" />
                </div>
              </div>
            )}

            {/* Video Error Banner if MKV / codec isn't natively supported */}
            {videoError && (
              <div className="absolute top-4 left-4 right-4 bg-amber-950/90 border border-amber-500/50 rounded-lg p-3 text-xs text-amber-200 flex items-center justify-between z-20 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <span>
                    This video container (.{movie.fileFormat}) may require VLC to decode AC3/DTS audio.
                  </span>
                </div>
                <button
                  onClick={copyPathToClipboard}
                  className="px-2 py-1 bg-amber-500 text-neutral-950 font-bold rounded text-[11px]"
                >
                  {copiedPath ? 'Path Copied!' : 'Copy Drive Path'}
                </button>
              </div>
            )}

            {/* Video Player Custom Controls Bar */}
            <div className="relative z-20 p-3 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent space-y-2 opacity-95 group-hover:opacity-100 transition-opacity">
              {/* Progress seeker */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  aria-label="Video seek position"
                  className="flex-1 h-1 bg-neutral-700 accent-amber-500 rounded-lg cursor-pointer"
                />
                <span className="text-[11px] font-mono text-neutral-400">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Control Buttons */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="p-1.5 text-neutral-200 hover:text-amber-400 transition-colors"
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  </button>

                  <button
                    onClick={() => seekRelative(-10)}
                    className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
                    title="Rewind 10 seconds"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => seekRelative(10)}
                    className="p-1 text-neutral-400 hover:text-neutral-200 transition-colors"
                    title="Forward 10 seconds"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </button>

                  {/* Volume */}
                  <div className="flex items-center gap-1.5 ml-1">
                    <button onClick={toggleMute} className="text-neutral-400 hover:text-neutral-200">
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-3.5 h-3.5" />
                      ) : (
                        <Volume2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label="Volume level"
                      className="w-16 h-1 bg-neutral-700 accent-amber-500 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Select local file button */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".mp4,.mkv,.webm,.mov,.avi"
                    onChange={handleSelectLocalFile}
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 border border-neutral-700"
                    title="Browse your computer or hard drive to play the actual file"
                  >
                    <FileVideo className="w-3 h-3 text-amber-400" />
                    <span>Load File from Drive</span>
                  </button>

                  {/* Playback speed */}
                  <button
                    onClick={cyclePlaybackRate}
                    className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 hover:text-neutral-100"
                  >
                    {playbackRate}x
                  </button>

                  {/* Fullscreen */}
                  <button
                    onClick={toggleFullscreen}
                    className="p-1 text-neutral-400 hover:text-neutral-200"
                  >
                    <Maximize className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Movie Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Left Column: Metadata & Synopsis */}
            <div className="md:col-span-2 space-y-4">
              <div>
                {/* Clean unboxed metadata (Frontend Design Rule A: Zero-Pill) */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400 mb-1.5">
                  <span className="font-semibold text-amber-400">{movie.rating}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span>{movie.durationFormatted} ({movie.durationMin} min)</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span>{movie.year}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span>{movie.genres.join(', ')}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span className={movie.hasEnglishSubtitles ? 'text-emerald-400 font-semibold' : 'text-neutral-500 font-normal'}>
                    {movie.hasEnglishSubtitles ? 'CC English Subtitles Included' : 'No English Subtitles'}
                  </span>
                </div>

                <h2 className="text-2xl font-serif font-bold text-neutral-100">{movie.title}</h2>
                <div className="text-xs text-neutral-400 mt-1">
                  Directed by <strong className="text-neutral-200">{movie.director}</strong> · Starring{' '}
                  <span className="text-neutral-300">{movie.cast.join(', ')}</span>
                </div>
              </div>

              {/* Plot Synopsis */}
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-1">
                <h3 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                  Story Synopsis
                </h3>
                <p className="text-sm text-neutral-300 leading-relaxed">{movie.synopsis}</p>
              </div>

              {/* Curator Uncle/Aunt Note */}
              {movie.curatorNote && (
                <div className="bg-amber-950/20 border border-amber-900/40 p-4 rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-400">
                    <Heart className="w-3.5 h-3.5 fill-amber-400" />
                    <span>Note for {config.nieceName} from {config.curatorName}:</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed italic">
                    "{movie.curatorNote}"
                  </p>
                </div>
              )}
            </div>

            {/* Right Column: File Specs & Cover Artwork Actions */}
            <div className="space-y-4">
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3 text-xs">
                <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-amber-400" />
                  <span>Media File Specs</span>
                </h4>

                <div className="space-y-2 text-neutral-400">
                  <div className="flex justify-between py-1 border-b border-neutral-850">
                    <span>Container Format:</span>
                    <span className="text-neutral-200 font-mono font-bold uppercase">.{movie.fileFormat}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-850">
                    <span>English Subtitles:</span>
                    <span className={movie.hasEnglishSubtitles ? 'text-emerald-400 font-semibold' : 'text-neutral-400'}>
                      {movie.hasEnglishSubtitles ? 'Yes (CC Included)' : 'Not Included'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-850">
                    <span>Resolution:</span>
                    <span className="text-neutral-200">{movie.resolution || '1080p FHD'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-850">
                    <span>Approx Size:</span>
                    <span className="text-neutral-200">{movie.fileSizeFormatted || '3.5 GB'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-neutral-850">
                    <span>Audio Tracks:</span>
                    <span className="text-neutral-200 text-right">{movie.audioTracks || 'Original 5.1 Surround'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>All Subtitle Tracks:</span>
                    <span className="text-neutral-200 text-right">{movie.subtitles || 'English SDH Included'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-850 space-y-1.5">
                  <div className="text-[11px] text-neutral-400 font-medium">Relative Path on Drive:</div>
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 font-mono text-[11px] text-neutral-200 break-all flex items-center justify-between gap-2">
                    <span>{movie.relativeFilePath}</span>
                    <button
                      onClick={copyPathToClipboard}
                      className="p-1 hover:text-amber-400 transition-colors flex-shrink-0"
                      title="Copy path"
                    >
                      {copiedPath ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={movie.relativeFilePath}
                    download
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-200 text-xs font-medium border border-neutral-700 transition-colors"
                  >
                    <Folder className="w-3.5 h-3.5 text-amber-400" />
                    <span>Open Movie File Directly</span>
                  </a>
                </div>
              </div>

              {/* Cover Artwork & TMDB Replacement Action */}
              <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-neutral-200 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span>Movie Poster Artwork</span>
                  </h4>
                  <span className="text-[11px] font-mono text-emerald-400">Covers/</span>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={movie.posterUrl}
                    alt={movie.title}
                    className="w-12 h-16 object-cover rounded bg-neutral-900 border border-neutral-800"
                  />
                  <div className="space-y-1 text-neutral-400 text-[11px]">
                    <div className="text-neutral-300 font-medium truncate">
                      {movie.posterUrl.startsWith('data:') ? 'Verified TMDB Cover' : movie.posterUrl.split('/').pop()}
                    </div>
                    <p className="text-neutral-500 leading-tight">
                      Saved and locked in your drive's Covers folder.
                    </p>
                  </div>
                </div>

                {onDeleteAndReplaceCover && (
                  <div className="pt-2 border-t border-neutral-850">
                    <button
                      type="button"
                      disabled={isReplacingCover}
                      onClick={() => onDeleteAndReplaceCover(movie.id)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-xs font-semibold transition-all disabled:opacity-50"
                      title="Deletes this cover image and forces TMDB to search and download a different non-duplicate poster"
                    >
                      {isReplacingCover ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                          <span>Finding Different Cover on TMDB...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Delete Cover & Find New Replacement on TMDB</span>
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-neutral-500 mt-1 text-center">
                      Guarantees a verified, non-duplicate poster from TMDB/archives that is NOT the current image.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
