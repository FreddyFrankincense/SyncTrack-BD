import React from 'react';
import { X, Disc3, FolderPlus, Check, Layers } from 'lucide-react';
import { SAMPLE_PROJECTS } from '../data/sampleProjects';
import { ProjectData } from '../types';

interface ProjectSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentProjectId: string;
  onSelectProject: (project: ProjectData) => void;
  onNewBlankProject: () => void;
}

export const ProjectSelectModal: React.FC<ProjectSelectModalProps> = ({
  isOpen,
  onClose,
  currentProjectId,
  onSelectProject,
  onNewBlankProject,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-xl w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Disc3 className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-semibold text-white">
              Blu-ray Commentary Projects
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-xs text-neutral-400">
            Choose a realistic authoring scenario with pre-recorded disc freeze pauses, sequential multi-film marathons, or start an empty project.
          </p>

          <div className="space-y-2.5">
            {SAMPLE_PROJECTS.map((proj) => {
              const isSelected = proj.id === currentProjectId;
              const isMulti = proj.isMultiFilm && proj.films && proj.films.length > 0;
              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    onSelectProject(proj);
                    onClose();
                  }}
                  className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-neutral-850 border-amber-500/80'
                      : 'bg-neutral-950/60 border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-semibold text-neutral-200">
                        {proj.title}
                      </div>
                      {isMulti && (
                        <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/70 border border-amber-800/80 px-1.5 py-0.2 rounded font-mono">
                          <Layers className="w-2.5 h-2.5" />
                          <span>{proj.films?.length} Sequential Films</span>
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                        <Check className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-1 flex-wrap">
                    {proj.director && (
                      <>
                        <span className="text-sky-300 font-medium">Dir. {proj.director}</span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    {isMulti ? (
                      <>
                        <span>{proj.films?.reduce((acc, f) => acc + f.pauseEvents.length, 0)} cuts total</span>
                        <span aria-hidden="true">·</span>
                        <span>Multi-Disc Marathons</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-rose-400 tabular-nums">Intermission supported</span>
                      </>
                    ) : (
                      <>
                        <span>{proj.pauseEvents.length} pause cuts detected</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{proj.frameRate} fps</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono text-rose-400 tabular-nums">-{proj.summary.totalCutSec.toFixed(1)}s delay removed</span>
                      </>
                    )}
                  </div>
                  {proj.genres && proj.genres.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-2">
                      {proj.genres.map((g) => (
                        <span
                          key={g}
                          className="text-[10px] px-1.5 py-0.2 rounded bg-neutral-900 border border-neutral-800 text-neutral-300"
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-2">
            <button
              onClick={() => {
                onNewBlankProject();
                onClose();
              }}
              className="w-full py-2.5 px-4 rounded-lg border border-dashed border-neutral-700 hover:border-amber-400/80 text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-850/50 flex items-center justify-center gap-2 transition-all"
            >
              <FolderPlus className="w-4 h-4 text-amber-400" />
              <span>Create New Custom Blu-ray Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
