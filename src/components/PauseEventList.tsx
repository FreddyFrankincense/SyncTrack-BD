import React from 'react';
import {
  Scissors,
  Play,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Edit3,
  Sliders,
} from 'lucide-react';
import { FrameRate, PauseEvent } from '../types';
import { formatSMPTE } from '../utils/timecode';

interface PauseEventListProps {
  pauses: PauseEvent[];
  frameRate: FrameRate;
  selectedPauseId: string | null;
  onSelectPause: (id: string) => void;
  onTogglePause: (id: string) => void;
  onUpdatePause: (id: string, updates: Partial<PauseEvent>) => void;
  onDeletePause: (id: string) => void;
  onPreviewSplice: (pause: PauseEvent) => void;
  onJumpToPause: (sec: number) => void;
  onAddManualPause: () => void;
  onOpenReviewQueue?: () => void;
}

export const PauseEventList: React.FC<PauseEventListProps> = ({
  pauses,
  frameRate,
  selectedPauseId,
  onSelectPause,
  onTogglePause,
  onUpdatePause,
  onDeletePause,
  onPreviewSplice,
  onJumpToPause,
  onAddManualPause,
  onOpenReviewQueue,
}) => {
  const totalCut = pauses.filter((p) => p.enabled).reduce((sum, p) => sum + p.durationCutSec, 0);
  const flaggedCount = pauses.filter((p) => p.confidence === 'low' || p.confidence === 'medium').length;

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-100">
              Pause Cuts
            </h2>
            <span className="text-xs text-neutral-500 font-mono">({pauses.length})</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span className="font-mono text-amber-400 tabular-nums">-{totalCut.toFixed(1)}s cut total</span>
            <span aria-hidden="true" className="text-neutral-600">·</span>
            <span className="text-neutral-500">Real-time crossfade editing</span>
          </div>
        </div>

        <button
          onClick={onAddManualPause}
          className="px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors"
        >
          + Mark Cut
        </button>
      </div>

      {/* List */}
      <div className="mt-6 space-y-5">
        {pauses.length === 0 ? (
          <div className="text-center py-12 text-neutral-500 text-sm">
            No pause events detected yet. Click "Auto-Detect & Sync" or upload a transcript.
          </div>
        ) : (
          pauses.map((pause, idx) => {
            const isSelected = pause.id === selectedPauseId;
            return (
              <div
                key={pause.id}
                onClick={() => onSelectPause(pause.id)}
                className={`p-6 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-850 border-amber-500/80 shadow-sm'
                    : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                } ${!pause.enabled ? 'opacity-60' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Left: Event index and trigger info */}
                  <div className="space-y-3 flex-1 min-w-[280px]">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-neutral-400">
                        #{idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-neutral-200">
                        {pause.reason}
                      </span>
                      <span
                        className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-semibold border ${
                          pause.confidence === 'high'
                            ? 'text-emerald-400 bg-emerald-950/50 border border-emerald-800/40'
                            : pause.confidence === 'low'
                            ? 'text-rose-300 bg-rose-950/60 border border-rose-700/60'
                            : 'text-amber-400 bg-amber-950/50 border border-amber-800/40'
                        }`}
                      >
                        {pause.confidence} conf
                      </span>
                      {pause.ambiguityType && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-950/50 text-rose-300 border border-rose-800/40 font-medium">
                          {pause.ambiguityType.replace(/_/g, ' ')}
                        </span>
                      )}
                      {(pause.confidence === 'low' || pause.confidence === 'medium') && onOpenReviewQueue && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPause(pause.id);
                            onOpenReviewQueue();
                          }}
                          className="text-[10px] text-amber-300 hover:text-white underline font-medium ml-1"
                        >
                          Inspect Timing →
                        </button>
                      )}
                    </div>

                    {/* Trigger and Resume Quotes */}
                    <div className="text-xs text-neutral-300 space-y-2 bg-neutral-900/80 p-4 rounded-lg border border-neutral-800/60">
                      <div className="flex items-start gap-1.5">
                        <span className="text-neutral-500 shrink-0 font-medium">Trigger:</span>
                        <span className="italic text-amber-200/90 font-serif">"{pause.triggerPhrase}"</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-neutral-500 shrink-0 font-medium">Resume:</span>
                        <span className="italic text-emerald-200/90 font-serif">"{pause.resumePhrase}"</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Timecode numbers & Action buttons */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right font-mono text-xs tabular-nums">
                      <div className="text-neutral-400">
                        Cut: <span className="text-rose-400 font-bold">-{pause.durationCutSec.toFixed(1)}s</span>
                      </div>
                      <div className="text-[11px] text-neutral-500">
                        Raw: {formatSMPTE(pause.commentaryPauseStartSec, frameRate)} → {formatSMPTE(pause.commentaryResumeSec, frameRate)}
                      </div>
                      <div className="text-[11px] text-amber-400/80">
                        Film Sync At: {formatSMPTE(pause.filmTimestampSec, frameRate)}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onPreviewSplice(pause);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800/60 rounded transition-colors"
                        title="Audition splice: plays 2s before cut, jumps gapless across cut, plays 2s after"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Preview</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToPause(pause.commentaryPauseStartSec);
                        }}
                        className="px-2 py-1 text-xs text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
                        title="Jump playhead to pause start"
                      >
                        Jump
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onTogglePause(pause.id);
                        }}
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                          pause.enabled
                            ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                            : 'bg-neutral-850 text-neutral-500 hover:text-neutral-300'
                        }`}
                        title={pause.enabled ? 'Click to disable cut (keep audio)' : 'Click to re-enable cut'}
                      >
                        {pause.enabled ? 'Enabled' : 'Bypassed'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeletePause(pause.id);
                        }}
                        className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                        title="Delete this pause decision"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Visual Interactive Crossfade Slider (Real-time Timeline Update) */}
                <div className="mt-4 pt-4 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-4 text-xs bg-neutral-900/50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    <span className="text-neutral-400 text-[11px] font-medium">Splice Crossfade:</span>
                    <span className="font-mono text-xs font-bold text-sky-400 tabular-nums">
                      {pause.crossfadeMs} ms
                    </span>
                    <span className="text-[10px] text-neutral-500 font-sans">
                      {pause.crossfadeMs === 0
                        ? '(Hard butt-cut)'
                        : pause.crossfadeMs <= 15
                        ? '(Anti-click ramp)'
                        : pause.crossfadeMs <= 35
                        ? '(BD Standard)'
                        : '(Room tone blend)'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-1 min-w-[140px] max-w-xs">
                    <input
                      type="range"
                      min={0}
                      max={150}
                      step={1}
                      value={pause.crossfadeMs}
                      onChange={(e) => {
                        e.stopPropagation();
                        onUpdatePause(pause.id, { crossfadeMs: parseInt(e.target.value) || 0 });
                      }}
                      className="w-full accent-sky-400 cursor-pointer h-1.5 bg-neutral-800 rounded"
                      title="Drag to interactively adjust crossfade length in milliseconds. Real-time preview updates in timeline above."
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1">
                    {[0, 15, 30, 60, 100].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdatePause(pause.id, { crossfadeMs: preset });
                        }}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                          pause.crossfadeMs === preset
                            ? 'bg-sky-950 text-sky-300 border border-sky-800/60 font-bold'
                            : 'bg-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {preset}ms
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub-drawer if selected: Fine Nudge In/Out buttons */}
                {isSelected && (
                  <div className="mt-4 pt-3 border-t border-neutral-800/50 flex flex-wrap items-center justify-between gap-4 text-xs text-neutral-400 bg-neutral-900/30 px-4 py-3 rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-neutral-400">Nudge Cut In:</span>
                      <span className="text-[10px] text-sky-400 font-mono bg-sky-950/40 border border-sky-800/40 px-1.5 py-0.5 rounded">
                        Shift + ← / → (±100ms)
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newStart = Math.max(0, Math.round((pause.commentaryPauseStartSec - 0.2) * 1000) / 1000);
                          const newDur = Math.round((pause.commentaryResumeSec - newStart) * 1000) / 1000;
                          onUpdatePause(pause.id, {
                            commentaryPauseStartSec: newStart,
                            durationCutSec: newDur,
                          });
                        }}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 text-[11px] font-mono"
                      >
                        -0.2s
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newStart = Math.min(
                            pause.commentaryResumeSec - 0.2,
                            Math.round((pause.commentaryPauseStartSec + 0.2) * 1000) / 1000
                          );
                          const newDur = Math.round((pause.commentaryResumeSec - newStart) * 1000) / 1000;
                          onUpdatePause(pause.id, {
                            commentaryPauseStartSec: newStart,
                            durationCutSec: newDur,
                          });
                        }}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 text-[11px] font-mono"
                      >
                        +0.2s
                      </button>

                      <span className="ml-3 text-[11px] text-neutral-400">Nudge Cut Out:</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newEnd = Math.max(
                            pause.commentaryPauseStartSec + 0.2,
                            Math.round((pause.commentaryResumeSec - 0.2) * 1000) / 1000
                          );
                          const newDur = Math.round((newEnd - pause.commentaryPauseStartSec) * 1000) / 1000;
                          onUpdatePause(pause.id, {
                            commentaryResumeSec: newEnd,
                            durationCutSec: newDur,
                          });
                        }}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 text-[11px] font-mono"
                      >
                        -0.2s
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const newEnd = Math.round((pause.commentaryResumeSec + 0.2) * 1000) / 1000;
                          const newDur = Math.round((newEnd - pause.commentaryPauseStartSec) * 1000) / 1000;
                          onUpdatePause(pause.id, {
                            commentaryResumeSec: newEnd,
                            durationCutSec: newDur,
                          });
                        }}
                        className="px-1.5 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 text-[11px] font-mono"
                      >
                        +0.2s
                      </button>
                    </div>

                    <span className="text-[10px] text-neutral-500">
                      Crossfade preview visible in timeline cut zones above
                    </span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
