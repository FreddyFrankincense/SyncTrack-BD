import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCcw,
  Sliders,
  Volume2,
  Clock,
  Sparkles,
  HelpCircle,
  Scissors,
  Check,
  ChevronRight,
  Filter,
  ShieldAlert,
  ArrowRight,
  Ear,
  Eye,
  Info,
} from 'lucide-react';
import { FrameRate, PauseEvent } from '../types';
import { formatSMPTE } from '../utils/timecode';

interface ContextualReviewSectionProps {
  pauses: PauseEvent[];
  frameRate: FrameRate;
  selectedPauseId: string | null;
  onSelectPause: (id: string) => void;
  onUpdatePause: (id: string, updates: Partial<PauseEvent>) => void;
  onTogglePause: (id: string) => void;
  onPreviewSplice: (pause: PauseEvent) => void;
  onJumpToTime: (sec: number) => void;
  filmTitle?: string;
  onAuditionRange?: (startSec: number, endSec: number) => void;
}

export const ContextualReviewSection: React.FC<ContextualReviewSectionProps> = ({
  pauses,
  frameRate,
  selectedPauseId,
  onSelectPause,
  onUpdatePause,
  onTogglePause,
  onPreviewSplice,
  onJumpToTime,
  filmTitle,
  onAuditionRange,
}) => {
  const [filterMode, setFilterMode] = useState<'all_flagged' | 'low_only' | 'unverified' | 'all'>(
    'all_flagged'
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Group and compute statistics
  const lowConfidenceCount = pauses.filter((p) => p.confidence === 'low').length;
  const mediumConfidenceCount = pauses.filter((p) => p.confidence === 'medium').length;
  const verifiedCount = pauses.filter((p) => p.isUserVerified || p.confidence === 'high').length;
  const unverifiedFlaggedCount = pauses.filter(
    (p) => (p.confidence === 'low' || p.confidence === 'medium') && !p.isUserVerified
  ).length;

  // Filter list
  const filteredPauses = useMemo(() => {
    switch (filterMode) {
      case 'low_only':
        return pauses.filter((p) => p.confidence === 'low');
      case 'unverified':
        return pauses.filter((p) => (p.confidence === 'low' || p.confidence === 'medium') && !p.isUserVerified);
      case 'all':
        return pauses;
      case 'all_flagged':
      default:
        // By default show low, medium, or unverified
        return pauses.filter((p) => p.confidence === 'low' || p.confidence === 'medium' || !p.isUserVerified);
    }
  }, [pauses, filterMode]);

  // Active inspected cut
  const inspectedId = activeTabId || selectedPauseId || filteredPauses[0]?.id || pauses[0]?.id;
  const activePause = pauses.find((p) => p.id === inspectedId) || filteredPauses[0] || pauses[0];

  // Helper for 1-frame duration in seconds
  const frameDurationSec = 1 / frameRate;

  // Nudge start helper
  const handleNudgeStart = (pause: PauseEvent, deltaSec: number) => {
    const newStart = Math.max(0, Math.min(pause.commentaryResumeSec - 0.1, pause.commentaryPauseStartSec + deltaSec));
    const rounded = Math.round(newStart * 1000) / 1000;
    const newDuration = Math.round((pause.commentaryResumeSec - rounded) * 1000) / 1000;
    onUpdatePause(pause.id, {
      commentaryPauseStartSec: rounded,
      durationCutSec: newDuration,
    });
  };

  // Nudge resume helper
  const handleNudgeResume = (pause: PauseEvent, deltaSec: number) => {
    const newResume = Math.max(pause.commentaryPauseStartSec + 0.1, pause.commentaryResumeSec + deltaSec);
    const rounded = Math.round(newResume * 1000) / 1000;
    const newDuration = Math.round((rounded - pause.commentaryPauseStartSec) * 1000) / 1000;
    onUpdatePause(pause.id, {
      commentaryResumeSec: rounded,
      durationCutSec: newDuration,
    });
  };

  // Mark verified toggle
  const handleToggleVerified = (pause: PauseEvent) => {
    const nextState = !pause.isUserVerified;
    onUpdatePause(pause.id, {
      isUserVerified: nextState,
      confidence: nextState ? 'high' : pause.confidence === 'high' ? 'medium' : pause.confidence,
    });
  };

  // Add 50ms safety padding before and after cut (pre-roll + post-roll buffer to prevent clipped syllables)
  const handleApplySafetyPadding = (pause: PauseEvent) => {
    const canShrink = pause.commentaryResumeSec - pause.commentaryPauseStartSec > 0.25;
    const paddedStart = canShrink ? pause.commentaryPauseStartSec + 0.05 : pause.commentaryPauseStartSec; // cut 50ms later -> keep 50ms more trailing speech
    const paddedResume = canShrink ? pause.commentaryResumeSec - 0.05 : pause.commentaryResumeSec; // resume 50ms earlier -> keep 50ms more leading speech
    const newDuration = Math.max(0.1, Math.round((paddedResume - paddedStart) * 1000) / 1000);
    onUpdatePause(pause.id, {
      commentaryPauseStartSec: Math.round(paddedStart * 1000) / 1000,
      commentaryResumeSec: Math.round(paddedResume * 1000) / 1000,
      durationCutSec: newDuration,
      crossfadeMs: Math.max(35, pause.crossfadeMs),
      isUserVerified: true,
      confidence: 'high',
    });
  };

  // Helper for human readable ambiguity tag
  const getAmbiguityBadge = (pause: PauseEvent) => {
    const type = pause.ambiguityType;
    if (type === 'chaotic_start_stop') {
      return { label: 'Chaotic Start & Stop', color: 'bg-rose-950/80 text-rose-300 border-rose-700/60' };
    }
    if (type === 'false_start') {
      return { label: 'False Start / Stammer', color: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
    }
    if (type === 'mid_sentence_cut') {
      return { label: 'Mid-Sentence Interruption', color: 'bg-orange-950/80 text-orange-300 border-orange-700/60' };
    }
    if (type === 'overlapping_dialogue') {
      return { label: 'Overlapping Crosstalk', color: 'bg-purple-950/80 text-purple-300 border-purple-700/60' };
    }
    if (type === 'ambiguous_countdown') {
      return { label: 'Ambiguous Countdown Cue', color: 'bg-yellow-950/80 text-yellow-300 border-yellow-700/60' };
    }
    if (pause.confidence === 'low') {
      return { label: 'Low Contextual Certainty', color: 'bg-rose-950/80 text-rose-300 border-rose-700/60' };
    }
    return { label: 'Medium Confidence', color: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
  };

  return (
    <div className="space-y-8">
      {/* Top Banner Alert & Explanation */}
      <div className="bg-gradient-to-r from-neutral-900 via-neutral-900 to-rose-950/30 border border-neutral-800 rounded-xl p-6 sm:p-7 shadow-lg">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <h1 className="text-base font-bold text-neutral-100 tracking-tight">
                Context Review & Timing Inspector
              </h1>
              {unverifiedFlaggedCount > 0 ? (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                  {unverifiedFlaggedCount} require review
                </span>
              ) : (
                <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <Check className="w-3 h-3" /> All verified
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 max-w-2xl">
              Fine-tune ambiguous cuts with sub-frame nudging and gapless splice auditioning to prevent clipped dialogue.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 self-stretch lg:self-auto shrink-0 font-mono text-xs">
            <div className="px-2.5 py-1.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-center min-w-[76px]">
              <div className="text-[10px] text-neutral-500 uppercase font-sans">Low Conf</div>
              <div className="text-sm font-bold text-rose-400">{lowConfidenceCount}</div>
            </div>
            <div className="px-2.5 py-1.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-center min-w-[76px]">
              <div className="text-[10px] text-neutral-500 uppercase font-sans">Medium</div>
              <div className="text-sm font-bold text-amber-400">{mediumConfidenceCount}</div>
            </div>
            <div className="px-2.5 py-1.5 bg-neutral-950/80 border border-neutral-800 rounded-lg text-center min-w-[76px]">
              <div className="text-[10px] text-neutral-500 uppercase font-sans">Verified</div>
              <div className="text-sm font-bold text-emerald-400">{verifiedCount}</div>
            </div>
          </div>
        </div>

        {/* Filter Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mt-5 pt-4 border-t border-neutral-800/80">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-500 font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Filter:
            </span>
            <button
              onClick={() => setFilterMode('all_flagged')}
              className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                filterMode === 'all_flagged'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              Flagged ({lowConfidenceCount + mediumConfidenceCount})
            </button>
            <button
              onClick={() => setFilterMode('unverified')}
              className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                filterMode === 'unverified'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              Unverified ({unverifiedFlaggedCount})
            </button>
            <button
              onClick={() => setFilterMode('low_only')}
              className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                filterMode === 'low_only'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              Low Conf ({lowConfidenceCount})
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-1 rounded transition-colors text-[11px] ${
                filterMode === 'all'
                  ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
              }`}
            >
              All ({pauses.length})
            </button>
          </div>

          <div className="text-[11px] text-neutral-500 font-mono">
            Nudge: <span className="text-amber-300 font-semibold">Shift + ← / →</span> (±100ms)
          </div>
        </div>
      </div>

      {/* Main Two-Column Layout: Left Cut Queue, Right Precision Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Queue of Flagged Cuts (4 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1 text-xs text-neutral-400 font-medium">
            <span>Ambiguous Cut Instances ({filteredPauses.length})</span>
            <span className="text-[11px] text-neutral-500">Select to inspect & adjust</span>
          </div>

          {filteredPauses.length === 0 ? (
            <div className="p-8 text-center bg-neutral-900/40 border border-neutral-800 rounded-xl text-neutral-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-sm font-semibold text-neutral-200">No ambiguous cuts found in this filter.</p>
              <p className="text-xs text-neutral-500 mt-1">
                All cuts currently meet high-confidence threshold or have been verified.
              </p>
            </div>
          ) : (
            filteredPauses.map((pause, idx) => {
              const isSelected = pause.id === (activePause?.id || '');
              const badge = getAmbiguityBadge(pause);
              const isLow = pause.confidence === 'low';

              return (
                <div
                  key={pause.id}
                  onClick={() => {
                    setActiveTabId(pause.id);
                    onSelectPause(pause.id);
                  }}
                  className={`p-5 rounded-xl border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-neutral-900 border-amber-500/90 shadow-md ring-1 ring-amber-500/40'
                      : 'bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90'
                  } ${!pause.enabled ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-neutral-400">
                        #{idx + 1}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-semibold ${badge.color}`}
                      >
                        {badge.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {pause.isUserVerified ? (
                        <span className="flex items-center gap-1 text-[10px] font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded">
                          <Check className="w-3 h-3" /> Verified
                        </span>
                      ) : (
                        <span
                          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded border ${
                            isLow
                              ? 'text-rose-400 bg-rose-950/50 border-rose-800/40'
                              : 'text-amber-400 bg-amber-950/50 border-amber-800/40'
                          }`}
                        >
                          {pause.confidenceScore ? `${pause.confidenceScore}% conf` : `${pause.confidence} conf`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 text-xs font-medium text-neutral-200 line-clamp-1">
                    {pause.reason}
                  </div>

                  {/* Trigger preview quote */}
                  <div className="mt-1.5 text-[11px] text-neutral-400 italic font-serif line-clamp-1 bg-neutral-950/60 px-2 py-1 rounded border border-neutral-850">
                    "{pause.triggerPhrase}"
                  </div>

                  {/* Cut Duration & Range */}
                  <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-neutral-500 pt-1.5 border-t border-neutral-800/60">
                    <span className="text-rose-400 font-semibold">-{pause.durationCutSec.toFixed(1)}s cut</span>
                    <span>Raw: {formatSMPTE(pause.commentaryPauseStartSec, frameRate)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right: Active Cut Detailed Precision Inspector (7 cols) */}
        <div className="lg:col-span-7">
          {activePause ? (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 sm:p-8 space-y-7 shadow-xl">
              {/* Header with Title and Verified Button */}
              <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      PAUSE CUT INSPECTOR
                    </span>
                    <span className="text-neutral-600">·</span>
                    <span className="text-xs font-semibold text-neutral-200">
                      {activePause.reason}
                    </span>
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Target Film Time: <span className="font-mono text-neutral-200">{formatSMPTE(activePause.filmTimestampSec, frameRate)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onTogglePause(activePause.id)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                      activePause.enabled
                        ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-750'
                        : 'bg-rose-950/50 text-rose-300 border-rose-800/60'
                    }`}
                  >
                    {activePause.enabled ? 'Active Cut' : 'Bypassed'}
                  </button>

                  <button
                    onClick={() => handleToggleVerified(activePause)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                      activePause.isUserVerified
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-sm'
                        : 'bg-neutral-800 hover:bg-emerald-950/60 text-neutral-200 hover:text-emerald-300 border-neutral-700 hover:border-emerald-700/60'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{activePause.isUserVerified ? 'Verified' : 'Mark Verified'}</span>
                  </button>
                </div>
              </div>

              {/* Contextual Warning & Engineering Diagnosis Box */}
              <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300 uppercase tracking-wide">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Ambiguity Diagnosis</span>
                </div>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  {activePause.contextualWarning ||
                    `The audio interpreter detected an irregular verbal pause boundary. Commentary speaker paused abruptly mid-sentence or gave an ambiguous resume cue.`}
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => handleApplySafetyPadding(activePause)}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-200 bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/60 rounded-md transition-colors"
                    title="Adds 50ms speech protection padding to start and resume, increases crossfade to 35ms, and marks verified"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Apply +50ms Buffer</span>
                  </button>
                </div>
              </div>

              {/* Surrounding Phrase Context (Trigger vs Resume) */}
              <div className="space-y-4 bg-neutral-950/60 p-5 rounded-xl border border-neutral-800/80">
                <div className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                  <span>Commentary Speech Boundaries</span>
                  <span className="font-mono text-rose-400 text-xs">
                    Excising: -{activePause.durationCutSec.toFixed(3)}s
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Trigger side */}
                  <div className="p-4 rounded-lg bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-medium text-amber-400">Trigger (Cut-In Speech)</span>
                      <span className="font-mono">{formatSMPTE(activePause.commentaryPauseStartSec, frameRate)}</span>
                    </div>
                    <p className="italic text-amber-100 font-serif text-xs leading-relaxed">
                      "{activePause.triggerPhrase}"
                    </p>
                  </div>

                  {/* Resume side */}
                  <div className="p-4 rounded-lg bg-neutral-900/80 border border-neutral-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400">
                      <span className="font-medium text-emerald-400">Resume (Cut-Out Speech)</span>
                      <span className="font-mono">{formatSMPTE(activePause.commentaryResumeSec, frameRate)}</span>
                    </div>
                    <p className="italic text-emerald-100 font-serif text-xs leading-relaxed">
                      "{activePause.resumePhrase}"
                    </p>
                  </div>
                </div>
              </div>

              {/* Precision Sub-Frame Timing Nudge Workbench */}
              <div className="space-y-5 bg-neutral-950/80 p-5 sm:p-6 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-sky-400" />
                    <span className="text-xs font-bold text-neutral-200 uppercase tracking-wide">
                      Precision Boundary Timing Nudge
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-500">
                    1 Frame @ {frameRate}fps = {(frameDurationSec * 1000).toFixed(1)}ms
                  </span>
                </div>

                {/* Cut-In Start Nudge Row */}
                <div className="p-4 bg-neutral-900/90 rounded-lg border border-neutral-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <span>Cut-In Start (Raw Commentary):</span>
                      <span className="font-mono text-neutral-100 font-bold">
                        {formatSMPTE(activePause.commentaryPauseStartSec, frameRate)}
                      </span>
                      <span className="font-mono text-neutral-500 text-[11px]">
                        ({activePause.commentaryPauseStartSec.toFixed(3)}s)
                      </span>
                    </div>

                    <button
                      onClick={() => onJumpToTime(activePause.commentaryPauseStartSec)}
                      className="px-2 py-0.5 text-[11px] text-neutral-400 hover:text-white bg-neutral-800 rounded transition-colors"
                    >
                      Seek Playhead Here
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-neutral-500 font-mono mr-1">Nudge Start:</span>
                    <button
                      onClick={() => handleNudgeStart(activePause, -frameDurationSec)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge cut start earlier by 1 frame"
                    >
                      -1 Fr
                    </button>
                    <button
                      onClick={() => handleNudgeStart(activePause, -0.1)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge cut start earlier by 100ms"
                    >
                      -100ms
                    </button>
                    <button
                      onClick={() => handleNudgeStart(activePause, -0.02)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge cut start earlier by 20ms"
                    >
                      -20ms
                    </button>
                    <button
                      onClick={() => handleNudgeStart(activePause, 0.02)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge cut start later by 20ms"
                    >
                      +20ms
                    </button>
                    <button
                      onClick={() => handleNudgeStart(activePause, 0.1)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge cut start later by 100ms"
                    >
                      +100ms
                    </button>
                    <button
                      onClick={() => handleNudgeStart(activePause, frameDurationSec)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge cut start later by 1 frame"
                    >
                      +1 Fr
                    </button>
                  </div>
                </div>

                {/* Cut-Out Resume Nudge Row */}
                <div className="p-4 bg-neutral-900/90 rounded-lg border border-neutral-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      <span>Cut-Out Resume (Raw Commentary):</span>
                      <span className="font-mono text-neutral-100 font-bold">
                        {formatSMPTE(activePause.commentaryResumeSec, frameRate)}
                      </span>
                      <span className="font-mono text-neutral-500 text-[11px]">
                        ({activePause.commentaryResumeSec.toFixed(3)}s)
                      </span>
                    </div>

                    <button
                      onClick={() => onJumpToTime(activePause.commentaryResumeSec)}
                      className="px-2 py-0.5 text-[11px] text-neutral-400 hover:text-white bg-neutral-800 rounded transition-colors"
                    >
                      Seek Playhead Here
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] text-neutral-500 font-mono mr-1">Nudge Resume:</span>
                    <button
                      onClick={() => handleNudgeResume(activePause, -frameDurationSec)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge resume earlier by 1 frame"
                    >
                      -1 Fr
                    </button>
                    <button
                      onClick={() => handleNudgeResume(activePause, -0.1)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge resume earlier by 100ms"
                    >
                      -100ms
                    </button>
                    <button
                      onClick={() => handleNudgeResume(activePause, -0.02)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge resume earlier by 20ms"
                    >
                      -20ms
                    </button>
                    <button
                      onClick={() => handleNudgeResume(activePause, 0.02)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge resume later by 20ms"
                    >
                      +20ms
                    </button>
                    <button
                      onClick={() => handleNudgeResume(activePause, 0.1)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge resume later by 100ms"
                    >
                      +100ms
                    </button>
                    <button
                      onClick={() => handleNudgeResume(activePause, frameDurationSec)}
                      className="px-2 py-1 text-xs font-mono bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700/80 transition-colors"
                      title="Nudge resume later by 1 frame"
                    >
                      +1 Fr
                    </button>
                  </div>
                </div>

                {/* Splice Crossfade Envelope Control */}
                <div className="p-4 bg-neutral-900/90 rounded-lg border border-neutral-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-medium text-neutral-300">
                    <span className="flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-amber-400" />
                      Splice Crossfade Transition Width:
                    </span>
                    <span className="font-mono text-amber-400 font-bold">{activePause.crossfadeMs} ms</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={5}
                      max={120}
                      step={5}
                      value={activePause.crossfadeMs}
                      onChange={(e) => onUpdatePause(activePause.id, { crossfadeMs: Number(e.target.value) })}
                      className="flex-1 accent-amber-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex items-center gap-1">
                      {[10, 20, 50, 80].map((ms) => (
                        <button
                          key={ms}
                          onClick={() => onUpdatePause(activePause.id, { crossfadeMs: ms })}
                          className={`px-1.5 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                            activePause.crossfadeMs === ms
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                          }`}
                        >
                          {ms}ms
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Audition & Playback Verification Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPreviewSplice(activePause)}
                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-black bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-all transform active:scale-95"
                    title="Auditions splice: plays 2.0s before cut, instantly jumps over cut, plays 2.0s after resume with crossfade"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Audition Seamless Splice</span>
                  </button>

                  <button
                    onClick={() => {
                      onJumpToTime(Math.max(0, activePause.commentaryPauseStartSec - 0.5));
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-750 border border-neutral-700 rounded-lg transition-colors"
                    title="Jump playhead right before the cut-in"
                  >
                    <Ear className="w-3.5 h-3.5 text-sky-400" />
                    <span>Pre-Roll Check</span>
                  </button>
                </div>

                <div className="text-right text-[11px] text-neutral-500 font-mono">
                  Blu-ray conformity: {activePause.isUserVerified ? 'Ready for M2TS mux' : 'Review pending'}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500">
              Select a cut from the left queue to inspect and adjust timing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
