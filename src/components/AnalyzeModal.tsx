import React, { useState, useEffect } from 'react';
import { X, Sparkles, Loader2, CheckCircle, Info, Cpu, Cloud } from 'lucide-react';
import { FrameRate } from '../types';

interface AnalyzeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAnalysis: (params: {
    filmTitle: string;
    frameRate: FrameRate;
    initialOffsetSec: number;
    engineMode: 'local' | 'cloud';
  }) => void;
  isAnalyzing: boolean;
  currentTitle: string;
  currentFrameRate: FrameRate;
  currentInitialOffsetSec: number;
}

export const AnalyzeModal: React.FC<AnalyzeModalProps> = ({
  isOpen,
  onClose,
  onStartAnalysis,
  isAnalyzing,
  currentTitle,
  currentFrameRate,
  currentInitialOffsetSec,
}) => {
  const [title, setTitle] = useState(currentTitle);
  const [frameRate, setFrameRate] = useState<FrameRate>(currentFrameRate);
  const [offsetSec, setOffsetSec] = useState<number>(currentInitialOffsetSec);
  const [engineMode, setEngineMode] = useState<'local' | 'cloud'>('local');

  useEffect(() => {
    if (isOpen) {
      setTitle(currentTitle);
      setFrameRate(currentFrameRate);
      setOffsetSec(currentInitialOffsetSec);
    }
  }, [isOpen, currentTitle, currentFrameRate, currentInitialOffsetSec]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStartAnalysis({
      filmTitle: title,
      frameRate,
      initialOffsetSec: offsetSec,
      engineMode,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-lg w-full overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              Blu-ray Commentary Sync Engine
            </h2>
          </div>
          <button
            onClick={onClose}
            disabled={isAnalyzing}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Engine Mode Segmented Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-neutral-300">
              Processing Engine Architecture
            </label>
            <div className="grid grid-cols-2 gap-2 bg-neutral-950 p-1.5 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => setEngineMode('local')}
                className={`flex flex-col items-start p-2.5 rounded-md transition-all text-left ${
                  engineMode === 'local'
                    ? 'bg-neutral-900 border border-emerald-500/60 shadow-sm'
                    : 'hover:bg-neutral-900/40 text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-emerald-400" />
                  <span className={`text-xs font-semibold ${engineMode === 'local' ? 'text-white' : 'text-neutral-300'}`}>
                    100% Offline Local
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 mt-0.5">
                  Air-gapped, zero cloud, zero API keys
                </span>
              </button>

              <button
                type="button"
                onClick={() => setEngineMode('cloud')}
                className={`flex flex-col items-start p-2.5 rounded-md transition-all text-left ${
                  engineMode === 'cloud'
                    ? 'bg-neutral-900 border border-amber-500/60 shadow-sm'
                    : 'hover:bg-neutral-900/40 text-neutral-400'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-amber-400" />
                  <span className={`text-xs font-semibold ${engineMode === 'cloud' ? 'text-white' : 'text-neutral-300'}`}>
                    Cloud Gemini AI
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 mt-0.5">
                  Gemini 3.8 Flash model
                </span>
              </button>
            </div>
          </div>

          <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-neutral-300 space-y-1.5">
            <div className="flex items-center gap-2 font-medium text-emerald-400">
              <Info className="w-4 h-4 shrink-0" />
              <span>
                {engineMode === 'local'
                  ? 'Local Engine: Instant Deterministic NLP & Subtitle Alignment'
                  : 'Cloud Engine: Gemini 3.8 Flash Multi-cue Parser'}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              {engineMode === 'local'
                ? 'Runs completely on your local computer using client-side regex rules, countdown detectors, and subtitle token matching. Zero data leaves your machine.'
                : 'Sends transcript text to Gemini 3.8 Flash via backend API for deep semantic reasoning and contextual quote correlation.'}
            </p>
          </div>

          <div>
            <label className="block text-xs text-neutral-300 font-medium mb-1">
              Film / Project Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-neutral-300 font-medium mb-1">
                Blu-ray Video Frame Rate
              </label>
              <select
                value={frameRate}
                onChange={(e) => setFrameRate(parseFloat(e.target.value) as FrameRate)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              >
                <option value={23.976}>23.976 fps (Standard BD Film)</option>
                <option value={24.0}>24.000 fps (DCI / Theatrical BD)</option>
                <option value={25.0}>25.000 fps (PAL / European BD)</option>
                <option value={29.97}>29.970 fps (NTSC / 60i Concert)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-300 font-medium mb-1">
                Initial Pre-roll Offset (Sec)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={offsetSec}
                onChange={(e) => setOffsetSec(parseFloat(e.target.value) || 0)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-neutral-100 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {/* Architecture commitment notice */}
          <div className="p-3 bg-neutral-950/70 border border-neutral-800 rounded-lg text-[11px] text-neutral-400 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Video Overhead:</strong> Video footage is never analyzed by AI or sent across the network. The original audio cues remain the sole source of truth, and video tracks conform passively to the verified audio cuts.
            </span>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isAnalyzing}
              className="px-4 py-2 text-xs text-neutral-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isAnalyzing}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
                engineMode === 'local'
                  ? 'bg-emerald-400 text-neutral-950 hover:bg-emerald-300'
                  : 'bg-amber-400 text-neutral-950 hover:bg-amber-300'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing...</span>
                </>
              ) : engineMode === 'local' ? (
                <>
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Execute 100% Offline Analysis</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>Execute Cloud AI Detection</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
