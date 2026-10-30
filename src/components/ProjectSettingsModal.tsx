import React, { useState, useEffect } from 'react';
import { X, Settings, Check } from 'lucide-react';
import { FilmSegment, FrameRate, ProjectData } from '../types';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
  activeFilm?: FilmSegment | null;
  onUpdateSettings: (updates: Partial<ProjectData>) => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  onClose,
  project,
  activeFilm,
  onUpdateSettings,
}) => {
  const effectiveFrameRate = activeFilm ? activeFilm.frameRate : project.frameRate;
  const effectiveInitialSync = activeFilm ? activeFilm.initialSync : project.initialSync;
  const effectiveDirector = activeFilm ? activeFilm.director || project.director || '' : project.director || '';
  const effectiveGenres = activeFilm
    ? (activeFilm.genres && activeFilm.genres.length > 0 ? activeFilm.genres : project.genres || []).join(', ')
    : (project.genres || []).join(', ');

  const [title, setTitle] = useState(project.title);
  const [director, setDirector] = useState(effectiveDirector);
  const [genresText, setGenresText] = useState(effectiveGenres);
  const [frameRate, setFrameRate] = useState<FrameRate>(effectiveFrameRate);
  const [initialOffset, setInitialOffset] = useState<number>(effectiveInitialSync.commentaryStartSec);
  const [cuePhrase, setCuePhrase] = useState(effectiveInitialSync.cuePhrase);

  useEffect(() => {
    if (isOpen) {
      setTitle(project.title);
      setDirector(effectiveDirector);
      setGenresText(effectiveGenres);
      setFrameRate(effectiveFrameRate);
      setInitialOffset(effectiveInitialSync.commentaryStartSec);
      setCuePhrase(effectiveInitialSync.cuePhrase);
    }
  }, [isOpen, project, effectiveFrameRate, effectiveInitialSync, effectiveDirector, effectiveGenres]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedGenres = genresText
      .split(',')
      .map((g) => g.trim())
      .filter(Boolean);
    onUpdateSettings({
      title,
      director: director.trim() || undefined,
      genres: parsedGenres.length > 0 ? parsedGenres : undefined,
      frameRate,
      initialSync: {
        ...effectiveInitialSync,
        commentaryStartSec: initialOffset,
        cuePhrase,
      },
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-white">
              Project & Blu-ray Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-neutral-300 font-medium mb-1">Project Name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Director</label>
              <input
                type="text"
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                placeholder="e.g. Ridley Vance"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-neutral-300 font-medium mb-1">Genres (comma-separated)</label>
              <input
                type="text"
                value={genresText}
                onChange={(e) => setGenresText(e.target.value)}
                placeholder="e.g. Sci-Fi, Cyberpunk"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Blu-ray Frame Rate</label>
            <select
              value={frameRate}
              onChange={(e) => setFrameRate(parseFloat(e.target.value) as FrameRate)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400"
            >
              <option value={23.976}>23.976 fps (Standard 24p Blu-ray Master)</option>
              <option value={24.0}>24.000 fps (Exact DCI Theatrical)</option>
              <option value={25.0}>25.000 fps (European 50i / 25p PAL)</option>
              <option value={29.97}>29.970 fps (NTSC 60i Master)</option>
            </select>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">
              Opening Pre-Roll Delay / Count-In Offset (Seconds)
            </label>
            <input
              type="number"
              step="0.05"
              min="0"
              value={initialOffset}
              onChange={(e) => setInitialOffset(parseFloat(e.target.value) || 0)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400"
            />
            <p className="text-[11px] text-neutral-500 mt-1">
              Time elapsed in commentary audio before participants trigger playback on the movie disc.
            </p>
          </div>

          <div>
            <label className="block text-neutral-300 font-medium mb-1">Opening Verbal Cue</label>
            <input
              type="text"
              value={cuePhrase}
              onChange={(e) => setCuePhrase(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-neutral-100 focus:outline-none focus:border-amber-400"
              placeholder="e.g. Three, two, one, press play!"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
