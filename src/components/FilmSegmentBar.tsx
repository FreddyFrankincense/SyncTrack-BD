import React, { useState } from 'react';
import { Layers, Film, Plus, Edit2, Clock, Check, Scissors, AlertCircle, ChevronRight, Disc } from 'lucide-react';
import { FilmSegment, FrameRate } from '../types';
import { formatSMPTE } from '../utils/timecode';

interface FilmSegmentBarProps {
  films: FilmSegment[];
  activeFilmId: string;
  onSelectFilm: (filmId: string) => void;
  onAddFilmSegment: (newFilm: Omit<FilmSegment, 'id' | 'sequenceIndex'>) => void;
  onUpdateFilmSegment: (filmId: string, updates: Partial<FilmSegment>) => void;
  onSplitFilmAtPlayhead: () => void;
  currentPlayheadSec: number;
  masterDurationSec: number;
  masterFrameRate: FrameRate;
  onJumpToFilmStart: (filmId: string) => void;
}

export const FilmSegmentBar: React.FC<FilmSegmentBarProps> = ({
  films,
  activeFilmId,
  onSelectFilm,
  onAddFilmSegment,
  onUpdateFilmSegment,
  onSplitFilmAtPlayhead,
  currentPlayheadSec,
  masterDurationSec,
  masterFrameRate,
  onJumpToFilmStart,
}) => {
  const [isEditingFilm, setIsEditingFilm] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDiscLabel, setEditDiscLabel] = useState('');
  const [editFps, setEditFps] = useState<FrameRate>(23.976);
  const [editDurationSec, setEditDurationSec] = useState(600);
  const [editStartSec, setEditStartSec] = useState(0);
  const [editEndSec, setEditEndSec] = useState(600);

  const activeFilm = films.find((f) => f.id === activeFilmId) || films[0];

  const handleStartEdit = (film: FilmSegment) => {
    setIsEditingFilm(film.id);
    setEditTitle(film.title);
    setEditDiscLabel(film.discLabel || `Disc ${film.sequenceIndex}`);
    setEditFps(film.frameRate);
    setEditDurationSec(film.filmDurationSec);
    setEditStartSec(film.rawRange.startSec);
    setEditEndSec(film.rawRange.endSec);
  };

  const handleSaveEdit = () => {
    if (!isEditingFilm) return;
    onUpdateFilmSegment(isEditingFilm, {
      title: editTitle,
      discLabel: editDiscLabel,
      frameRate: editFps,
      filmDurationSec: editDurationSec,
      rawRange: {
        startSec: editStartSec,
        endSec: editEndSec,
      },
    });
    setIsEditingFilm(null);
  };

  // Check if current playhead is in an intermission gap
  let currentIntermission: { start: number; end: number; duration: number } | null = null;
  for (let i = 0; i < films.length - 1; i++) {
    const currentEnd = films[i].rawRange.endSec;
    const nextStart = films[i + 1].rawRange.startSec;
    if (nextStart > currentEnd && currentPlayheadSec >= currentEnd && currentPlayheadSec <= nextStart) {
      currentIntermission = {
        start: currentEnd,
        end: nextStart,
        duration: nextStart - currentEnd,
      };
      break;
    }
  }

  return (
    <div className="bg-neutral-900 border-b border-neutral-800 px-6 sm:px-8 py-5">
      {/* Top row: Bar title, active indicator, and action triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-200">
            <Layers className="w-3.5 h-3.5 text-amber-500" />
            <span>Film Tracks</span>
          </div>
          <span className="text-[11px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
            {films.length} Films · {formatSMPTE(masterDurationSec, masterFrameRate)}
          </span>
          {currentIntermission && (
            <span className="text-[11px] text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded font-mono flex items-center gap-1 animate-pulse">
              <span>⏸ Intermission ({currentIntermission.duration.toFixed(0)}s gap)</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onSplitFilmAtPlayhead}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-950 hover:bg-neutral-800 border border-neutral-700/80 rounded transition-colors"
            title="Split the master recording tape into a new film segment at the current playhead position"
          >
            <Scissors className="w-3 h-3 text-amber-400" />
            <span>Split at Playhead</span>
          </button>
        </div>
      </div>

      {/* Visual Film Strip */}
      <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {films.map((film, index) => {
          const isActive = film.id === activeFilmId;
          const isPlayheadInside =
            currentPlayheadSec >= film.rawRange.startSec && currentPlayheadSec <= film.rawRange.endSec;
          const prevFilm = index > 0 ? films[index - 1] : null;
          const hasIntermissionBefore = prevFilm && film.rawRange.startSec > prevFilm.rawRange.endSec;
          const intermissionDuration = hasIntermissionBefore ? film.rawRange.startSec - prevFilm.rawRange.endSec : 0;

          return (
            <React.Fragment key={film.id}>
              {/* Intermission Block */}
              {hasIntermissionBefore && (
                <div
                  className="shrink-0 flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-neutral-950/80 border border-neutral-800/80 text-[11px] text-neutral-400 font-mono"
                  title={`Tape gap between films: ${intermissionDuration.toFixed(0)}s (Disc swap / break)`}
                >
                  <span className="text-amber-500/80">⏸ Intermission</span>
                  <span className="text-neutral-500">({intermissionDuration.toFixed(0)}s)</span>
                </div>
              )}

              {/* Film Segment Block */}
              <div
                onClick={() => onSelectFilm(film.id)}
                className={`shrink-0 flex flex-col gap-2.5 p-4 rounded-xl border cursor-pointer transition-all min-w-[260px] max-w-[360px] ${
                  isActive
                    ? 'bg-neutral-850 border-amber-500/80 shadow-sm shadow-amber-500/10'
                    : 'bg-neutral-950/70 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <Film className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-amber-400' : 'text-neutral-400'}`} />
                    <span className="text-xs font-semibold text-neutral-200 truncate">
                      {film.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 bg-neutral-800 text-neutral-300 rounded">
                      {film.discLabel || `Disc ${film.sequenceIndex}`}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(film);
                      }}
                      className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
                      title="Edit Film Segment Parameters"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                  <span>Tape: {formatSMPTE(film.rawRange.startSec, film.frameRate)} - {formatSMPTE(film.rawRange.endSec, film.frameRate)}</span>
                  <span className="text-amber-400/90">{film.pauseEvents.filter(p => p.enabled).length} Cuts</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-neutral-500 pt-1 border-t border-neutral-800/60">
                  <div className="flex items-center gap-1">
                    {isPlayheadInside && (
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    )}
                    <span>{film.frameRate} fps · Synced BD: {formatSMPTE(film.summary.finalSyncedDurationSec, film.frameRate)}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpToFilmStart(film.id);
                    }}
                    className="text-amber-400 hover:text-amber-300 hover:underline flex items-center gap-0.5"
                    title="Jump playhead to this film's initial sync count-in"
                  >
                    <span>Jump</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Edit Film Modal */}
      {isEditingFilm && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Film className="w-4 h-4 text-amber-500" />
              <span>Edit Film Segment Properties</span>
            </h3>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-neutral-400 block mb-1">Film Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Disc / Stream Label</label>
                  <input
                    type="text"
                    value={editDiscLabel}
                    onChange={(e) => setEditDiscLabel(e.target.value)}
                    placeholder="e.g. Disc 1 / Feature 1"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Blu-ray Frame Rate</label>
                  <select
                    value={editFps}
                    onChange={(e) => setEditFps(parseFloat(e.target.value) as FrameRate)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-500 font-mono"
                  >
                    <option value={23.976}>23.976 fps (BD Film)</option>
                    <option value={24}>24.000 fps (Cinema)</option>
                    <option value={25}>25.000 fps (PAL BD)</option>
                    <option value={29.97}>29.97 fps (NTSC BD)</option>
                    <option value={59.94}>59.94 fps</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-neutral-400 block mb-1">Master Tape Start (sec)</label>
                  <input
                    type="number"
                    step="1"
                    value={editStartSec}
                    onChange={(e) => setEditStartSec(parseFloat(e.target.value) || 0)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-neutral-400 block mb-1">Master Tape End (sec)</label>
                  <input
                    type="number"
                    step="1"
                    value={editEndSec}
                    onChange={(e) => setEditEndSec(parseFloat(e.target.value) || 0)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-neutral-400 block mb-1">Target Disc Film Duration (sec)</label>
                <input
                  type="number"
                  step="1"
                  value={editDurationSec}
                  onChange={(e) => setEditDurationSec(parseFloat(e.target.value) || 0)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-neutral-100 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 mt-5 pt-4 border-t border-neutral-800">
              <button
                onClick={() => setIsEditingFilm(null)}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded shadow transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
