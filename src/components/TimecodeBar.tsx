import React from 'react';
import { Play, Pause, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX, Scissors, Film } from 'lucide-react';
import { FrameRate, SyncSummary } from '../types';
import { formatSMPTE } from '../utils/timecode';

interface TimecodeBarProps {
  currentFilmSec: number;
  currentCommentarySec: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRewind: () => void;
  onJumpPrevPause: () => void;
  onJumpNextPause: () => void;
  playbackMode: 'synced' | 'raw';
  onTogglePlaybackMode: (mode: 'synced' | 'raw') => void;
  frameRate: FrameRate;
  summary: SyncSummary;
  volume: number;
  onChangeVolume: (v: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  activePauseNotice?: string | null;
  // Multi-film indicators
  activeFilmTitle?: string;
  activeDiscLabel?: string;
  isIntermission?: boolean;
}

export const TimecodeBar: React.FC<TimecodeBarProps> = ({
  currentFilmSec,
  currentCommentarySec,
  isPlaying,
  onTogglePlay,
  onRewind,
  onJumpPrevPause,
  onJumpNextPause,
  playbackMode,
  onTogglePlaybackMode,
  frameRate,
  summary,
  volume,
  onChangeVolume,
  isMuted,
  onToggleMute,
  activePauseNotice,
  activeFilmTitle,
  activeDiscLabel,
  isIntermission,
}) => {
  return (
    <div className="bg-neutral-900/90 border-b border-neutral-800 px-6 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-5">
      {/* Left: Playback transport buttons & mode switch */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 bg-neutral-950 p-1.5 rounded-md border border-neutral-800">
          <button
            onClick={onRewind}
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
            title="Rewind to Start (00:00:00:00)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={onJumpPrevPause}
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
            title="Jump to Previous Pause Point"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            onClick={onTogglePlay}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 text-xs font-semibold transition-colors ${
              isPlaying
                ? 'bg-amber-400 text-neutral-950 hover:bg-amber-300'
                : 'bg-neutral-800 text-neutral-100 hover:bg-neutral-700'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>
          <button
            onClick={onJumpNextPause}
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
            title="Jump to Next Pause Point"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>

        {/* Synced vs Raw Mode Selector */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-md border border-neutral-800">
          <button
            onClick={() => onTogglePlaybackMode('synced')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
              playbackMode === 'synced'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Plays edited audio with film pause gaps excised"
          >
            <Scissors className="w-3 h-3" />
            <span>Synced</span>
          </button>
          <button
            onClick={() => onTogglePlaybackMode('raw')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
              playbackMode === 'raw'
                ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
            title="Plays raw unedited continuous audio"
          >
            Raw
          </button>
        </div>

        {/* Volume slider */}
        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-neutral-800">
          <button
            onClick={onToggleMute}
            className="text-neutral-400 hover:text-white"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => onChangeVolume(parseFloat(e.target.value))}
            className="w-20 accent-amber-400 cursor-pointer h-1.5 bg-neutral-800 rounded"
          />
        </div>
      </div>

      {/* Center/Right: SMPTE Timecode Readouts */}
      <div className="flex items-center gap-5">
        {/* Active pause notice warning if playhead is currently inside a cut */}
        {activePauseNotice && (
          <div className="hidden xl:flex items-center gap-2 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2.5 py-1 rounded">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="truncate max-w-xs">{activePauseNotice}</span>
          </div>
        )}

        {isIntermission && (
          <div className="hidden md:flex items-center gap-1.5 text-xs text-amber-400 bg-neutral-950 px-2.5 py-1 rounded border border-neutral-800 font-mono">
            <span>⏸ Tape Intermission</span>
          </div>
        )}

        {/* Timecodes */}
        <div className="flex items-center gap-4 text-xs">
          {/* Active Film Disc TC */}
          <div className="flex flex-col">
            <span className="text-[10px] tracking-wider uppercase text-neutral-400 flex items-center gap-1">
              <Film className="w-2.5 h-2.5 text-amber-500" />
              <span>{activeDiscLabel || 'Film Master'} ({frameRate} fps)</span>
            </span>
            <span className="font-mono text-base font-semibold text-amber-400 tabular-nums">
              {formatSMPTE(currentFilmSec, frameRate)}
            </span>
          </div>

          <div className="h-6 w-px bg-neutral-800" />

          {/* Master Continuous Tape TC */}
          <div className="flex flex-col">
            <span className="text-[10px] tracking-wider uppercase text-neutral-400">
              Master Tape {playbackMode === 'synced' ? 'Source' : 'Continuous'}
            </span>
            <span className="font-mono text-base font-semibold text-neutral-200 tabular-nums">
              {formatSMPTE(currentCommentarySec, frameRate)}
            </span>
          </div>
        </div>

        {/* Zero-pill sync lock status */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-neutral-400 border-l border-neutral-800 pl-4">
          <span className="text-emerald-400 font-medium flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            BD Sync Locked
          </span>
          <span aria-hidden="true" className="text-neutral-700">·</span>
          <span className="font-mono tabular-nums text-neutral-300">-{summary.totalCutSec.toFixed(1)}s excised</span>
        </div>
      </div>
    </div>
  );
};
