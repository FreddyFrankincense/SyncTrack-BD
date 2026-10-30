import React, { useState, useEffect } from 'react';
import {
  BookmarkCheck,
  Plus,
  Play,
  RotateCcw,
  Sliders,
  CheckCircle2,
  Trash2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { AnchorPoint, FrameRate } from '../types';
import { formatSMPTE } from '../utils/timecode';

interface AnchorPointsListProps {
  anchors: AnchorPoint[];
  frameRate: FrameRate;
  onJumpToTime: (timeSec: number) => void;
  onAddAnchor: (newAnchor: Omit<AnchorPoint, 'id' | 'driftMs'>) => void;
  onUpdateAnchorDrift: (id: string, newDriftMs: number) => void;
  onDeleteAnchor: (id: string) => void;
  onAuditionAnchor: (anchor: AnchorPoint) => void;
  currentFilmSec: number;
  currentCommentarySec: number;
}

export const AnchorPointsList: React.FC<AnchorPointsListProps> = ({
  anchors,
  frameRate,
  onJumpToTime,
  onAddAnchor,
  onUpdateAnchorDrift,
  onDeleteAnchor,
  onAuditionAnchor,
  currentFilmSec,
  currentCommentarySec,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [label, setLabel] = useState('');
  const [anchorType, setAnchorType] = useState<AnchorPoint['type']>('dialogue_match');
  const [selectedAnchorId, setSelectedAnchorId] = useState<string | null>(anchors[0]?.id || null);

  useEffect(() => {
    if (!anchors.some((a) => a.id === selectedAnchorId)) {
      setSelectedAnchorId(anchors[0]?.id || null);
    }
  }, [anchors, selectedAnchorId]);

  const selectedAnchor = anchors.find((a) => a.id === selectedAnchorId);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    onAddAnchor({
      commentarySec: currentCommentarySec,
      filmSec: currentFilmSec,
      label: label.trim(),
      type: anchorType,
    });
    setLabel('');
    setShowAddForm(false);
  };

  const msPerFrame = 1000 / frameRate;

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 sm:p-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-100">
              Dialogue & Scene Verification Anchors
            </h2>
            <span className="text-xs text-neutral-500 font-mono">({anchors.length} locked)</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
            <span>Millisecond Drift Calibration</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-sky-400 tabular-nums">
              1 frame = {msPerFrame.toFixed(2)}ms @ {frameRate} fps
            </span>
            <span aria-hidden="true">·</span>
            <span>Sub-frame audio alignment</span>
          </div>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md transition-colors"
        >
          + Add Anchor at Current Time
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <form onSubmit={handleCreate} className="mt-6 p-6 bg-neutral-950/80 border border-neutral-800 rounded-xl space-y-4">
          <div className="text-xs text-neutral-300 font-medium">
            Lock current playhead position as sync reference:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-neutral-500">Commentary Time:</span>
              <div className="font-mono text-neutral-200 font-semibold">{formatSMPTE(currentCommentarySec, frameRate)}</div>
            </div>
            <div>
              <span className="text-neutral-500">Film Timecode:</span>
              <div className="font-mono text-amber-400 font-semibold">{formatSMPTE(currentFilmSec, frameRate)}</div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Anchor Description or Quoted Dialogue:</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Actor says: 'Look at the background prop' / Film dialogue match"
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <select
              value={anchorType}
              onChange={(e) => setAnchorType(e.target.value as any)}
              className="bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-200"
            >
              <option value="dialogue_match">Dialogue Match</option>
              <option value="visual_cue">On-Screen Visual Cue</option>
              <option value="title_card">Opening / Chapter Title Card</option>
              <option value="chapter_marker">Blu-ray Chapter Marker</option>
            </select>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1 text-xs text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-3 py-1 text-xs font-semibold bg-amber-400 text-neutral-950 rounded hover:bg-amber-300"
              >
                Save Anchor
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Selected Anchor Precision Drift Fine-Tuning Console */}
      {selectedAnchor && (
        <div className="mt-6 p-6 bg-neutral-950 border border-sky-900/60 rounded-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-neutral-200">
                Precision Drift Calibrator — {selectedAnchor.label}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-500">Film:</span>
              <span className="font-mono text-amber-400 tabular-nums">
                {formatSMPTE(selectedAnchor.filmSec, frameRate)}
              </span>
              <span className="text-neutral-600" aria-hidden="true">·</span>
              <span className="text-neutral-500">Commentary:</span>
              <span className="font-mono text-neutral-300 tabular-nums">
                {formatSMPTE(selectedAnchor.commentarySec, frameRate)}
              </span>
            </div>
          </div>

          {/* Visual Bi-directional Drift Bar Gauge */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className="text-neutral-500">Early / Leading (-250ms)</span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm font-bold tabular-nums ${
                    Math.abs(selectedAnchor.driftMs) <= 10
                      ? 'text-emerald-400'
                      : Math.abs(selectedAnchor.driftMs) <= 45
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                >
                  {selectedAnchor.driftMs > 0
                    ? `+${selectedAnchor.driftMs} ms`
                    : `${selectedAnchor.driftMs} ms`}
                </span>
                <span className="text-neutral-400 text-xs">
                  ({(selectedAnchor.driftMs / msPerFrame).toFixed(2)} frames)
                </span>
                {Math.abs(selectedAnchor.driftMs) <= 10 && (
                  <span className="text-[10px] text-emerald-400 font-sans flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Locked
                  </span>
                )}
              </div>
              <span className="text-neutral-500">Late / Lagging (+250ms)</span>
            </div>

            {/* Gauge visualization bar */}
            <div className="relative h-4 bg-neutral-900 rounded-full border border-neutral-800 overflow-hidden">
              {/* Center zero line */}
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-neutral-600 z-10" />

              {/* Threshold safe window (within 1 frame) */}
              <div
                className="absolute top-0 bottom-0 bg-emerald-950/40 border-x border-emerald-800/40"
                style={{
                  left: `${50 - (msPerFrame / 500) * 50}%`,
                  width: `${(msPerFrame / 250) * 50}%`,
                }}
              />

              {/* Active drift indicator bar */}
              {selectedAnchor.driftMs < 0 ? (
                <div
                  className={`absolute top-0 bottom-0 transition-all ${
                    Math.abs(selectedAnchor.driftMs) <= 10 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{
                    right: '50%',
                    width: `${Math.min(50, (Math.abs(selectedAnchor.driftMs) / 250) * 50)}%`,
                  }}
                />
              ) : selectedAnchor.driftMs > 0 ? (
                <div
                  className={`absolute top-0 bottom-0 transition-all ${
                    Math.abs(selectedAnchor.driftMs) <= 10 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                  style={{
                    left: '50%',
                    width: `${Math.min(50, (selectedAnchor.driftMs / 250) * 50)}%`,
                  }}
                />
              ) : null}
            </div>
          </div>

          {/* Interactive Nudge and Adjustment Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {/* Quick Nudge Buttons */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-[11px] text-neutral-500 mr-1">Nudge:</span>
              <button
                type="button"
                onClick={() => onUpdateAnchorDrift(selectedAnchor.id, selectedAnchor.driftMs - 50)}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[11px] transition-colors"
                title="Shift commentary 50ms earlier"
              >
                -50ms
              </button>
              <button
                type="button"
                onClick={() => onUpdateAnchorDrift(selectedAnchor.id, selectedAnchor.driftMs - 10)}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[11px] transition-colors"
                title="Shift commentary 10ms earlier"
              >
                -10ms
              </button>
              <button
                type="button"
                onClick={() => onUpdateAnchorDrift(selectedAnchor.id, selectedAnchor.driftMs - 1)}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[11px] transition-colors"
                title="Shift commentary 1ms earlier"
              >
                -1ms
              </button>
              <button
                type="button"
                onClick={() => onUpdateAnchorDrift(selectedAnchor.id, 0)}
                className="px-2.5 py-1 bg-neutral-850 hover:bg-neutral-800 text-sky-400 font-semibold rounded font-mono text-[11px] border border-sky-900/60 transition-colors"
                title="Reset to 0ms exact lock"
              >
                Reset 0ms
              </button>
              <button
                type="button"
                onClick={() => onUpdateAnchorDrift(selectedAnchor.id, selectedAnchor.driftMs + 1)}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[11px] transition-colors"
                title="Shift commentary 1ms later"
              >
                +1ms
              </button>
              <button
                type="button"
                onClick={() => onUpdateAnchorDrift(selectedAnchor.id, selectedAnchor.driftMs + 10)}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[11px] transition-colors"
                title="Shift commentary 10ms later"
              >
                +10ms
              </button>
              <button
                type="button"
                onClick={() => onUpdateAnchorDrift(selectedAnchor.id, selectedAnchor.driftMs + 50)}
                className="px-2 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-mono text-[11px] transition-colors"
                title="Shift commentary 50ms later"
              >
                +50ms
              </button>
            </div>

            {/* Slider & Audition */}
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-250}
                max={250}
                step={1}
                value={selectedAnchor.driftMs}
                onChange={(e) => onUpdateAnchorDrift(selectedAnchor.id, parseInt(e.target.value))}
                className="w-32 accent-sky-400 h-1.5 bg-neutral-800 rounded cursor-pointer"
                title="Drag to manually adjust drift"
              />

              <button
                type="button"
                onClick={() => onAuditionAnchor(selectedAnchor)}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-sky-300 bg-sky-950/80 hover:bg-sky-900/90 border border-sky-800/80 rounded transition-colors"
                title="Audition sync at this anchor (plays 2 seconds before and across the point)"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Audition Sync</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Anchor List Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-neutral-800 text-neutral-500 text-[11px] uppercase tracking-wider font-mono">
              <th className="py-3.5 px-4">Type</th>
              <th className="py-3.5 px-4">Film Timecode</th>
              <th className="py-3.5 px-4">Raw Comm Time</th>
              <th className="py-3.5 px-4">Reference & Dialogue</th>
              <th className="py-3.5 px-4 text-center">Drift Calibration</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/60 font-mono">
            {anchors.map((anc) => {
              const isSelected = anc.id === selectedAnchorId;
              const frames = (anc.driftMs / msPerFrame).toFixed(1);
              return (
                <tr
                  key={anc.id}
                  onClick={() => setSelectedAnchorId(anc.id)}
                  className={`transition-colors cursor-pointer ${
                    isSelected ? 'bg-sky-950/30 font-medium' : 'hover:bg-neutral-850/50'
                  }`}
                >
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="text-[10px] text-sky-400 bg-sky-950/40 border border-sky-800/40 px-2 py-0.5 rounded font-sans">
                      {anc.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-amber-400 font-semibold tabular-nums whitespace-nowrap">
                    {formatSMPTE(anc.filmSec, frameRate)}
                  </td>
                  <td className="py-4 px-4 text-neutral-300 tabular-nums whitespace-nowrap">
                    {formatSMPTE(anc.commentarySec, frameRate)}
                  </td>
                  <td className="py-4 px-4 text-neutral-200 font-sans max-w-xs truncate">
                    {anc.label}
                  </td>
                  <td className="py-4 px-4 text-center tabular-nums whitespace-nowrap">
                    <div className="inline-flex items-center gap-1.5">
                      <span
                        className={`font-semibold ${
                          Math.abs(anc.driftMs) <= 10
                            ? 'text-emerald-400'
                            : Math.abs(anc.driftMs) <= 45
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {anc.driftMs > 0 ? `+${anc.driftMs}ms` : `${anc.driftMs}ms`}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-sans">
                        ({frames} fr)
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAnchorId(anc.id);
                        }}
                        className="px-2 py-0.5 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-sky-300 rounded font-sans"
                        title="Fine-tune drift"
                      >
                        Tune
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onJumpToTime(anc.commentarySec);
                        }}
                        className="px-2 py-0.5 text-[11px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded font-sans"
                        title="Jump timeline to anchor"
                      >
                        Jump
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteAnchor(anc.id);
                        }}
                        className="p-1 text-neutral-500 hover:text-rose-400 transition-colors"
                        title="Remove anchor"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
