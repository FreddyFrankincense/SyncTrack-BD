import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Terminal,
  FileCode,
  Disc,
  FileText,
  Layers,
  Film,
  Video,
  MonitorPlay,
  CheckCircle2,
  Cpu,
  FileCheck,
} from 'lucide-react';
import { FilmSegment, ProjectData } from '../types';
import {
  generateAudacityLabels,
  generateAuthoringSheet,
  generateBatchFFmpegScript,
  generateCMX3600EDL,
  generateFFmpegScript,
  generateFilmFFmpegScript,
  generateMultiFilmMasterEDL,
  generateMultiFilmMasterSheet,
  generateZoomVideoConformScript,
  generateZoomMultiTrackXML,
} from '../utils/exportGenerators';
import {
  generateDocumentationText,
  generateDocumentationPDF,
  extractDocumentationData,
} from '../utils/pdfGenerator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ProjectData;
  activeFilmId?: string;
  onExportWavAudio: (targetFilmId?: string) => void;
  onBatchExportAllWavs?: () => void;
  isExportingAudio: boolean;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  project,
  activeFilmId,
  onExportWavAudio,
  onBatchExportAllWavs,
  isExportingAudio,
}) => {
  const films = project.films && project.films.length > 0 ? project.films : null;
  const [selectedFilmId, setSelectedFilmId] = useState<string>(activeFilmId || films?.[0]?.id || 'all');
  const [exportScope, setExportScope] = useState<'active' | 'batch'>('active');
  const [activeTab, setActiveTab] = useState<'doc_summary' | 'zoom_video' | 'ffmpeg' | 'edl' | 'sheet' | 'audacity'>('doc_summary');
  const [ffmpegFormat, setFfmpegFormat] = useState<'ac3' | 'wav' | 'flac'>('ac3');

  // Zoom Video Conform Configuration
  const [zoomFlavor, setZoomFlavor] = useState<'bash' | 'windows_bat'>('bash');
  const [zoomFps, setZoomFps] = useState<number>(25);
  const [zoomResolution, setZoomResolution] = useState<'1280x720' | '1920x1080'>('1280x720');

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (activeFilmId && films?.some((f) => f.id === activeFilmId)) {
        setSelectedFilmId(activeFilmId);
      } else if (films && films.length > 0) {
        setSelectedFilmId(films[0].id);
      } else {
        setSelectedFilmId('all');
        setExportScope('active');
      }
    }
  }, [isOpen, activeFilmId, films]);

  if (!isOpen) return null;

  const currentFilm: FilmSegment | undefined = films?.find((f) => f.id === selectedFilmId) || films?.[0];
  const videoInputName = project.videoSource?.fileName || project.audioFileName || 'zoom_webcam_recording.mp4';
  const targetSegments =
    exportScope === 'batch' && films
      ? films.flatMap((f) => f.segmentsToKeep)
      : currentFilm
      ? currentFilm.segmentsToKeep
      : project.segmentsToKeep;
  const [resW, resH] = zoomResolution.split('x').map(Number);

  // Extract structured documentation data for KPI badges & notes
  const docData = extractDocumentationData(project, currentFilm, exportScope);

  // Calculate scripts based on scope & tab
  let currentContent = '';
  if (activeTab === 'doc_summary') {
    currentContent = generateDocumentationText(project, currentFilm, exportScope);
  } else if (activeTab === 'zoom_video') {
    currentContent = generateZoomVideoConformScript(targetSegments, videoInputName, {
      fps: zoomFps,
      width: resW,
      height: resH,
      flavor: zoomFlavor,
      filmTitle: currentFilm ? currentFilm.title : project.title,
    });
  } else if (exportScope === 'batch' && films) {
    switch (activeTab) {
      case 'ffmpeg':
        currentContent = generateBatchFFmpegScript(project, ffmpegFormat);
        break;
      case 'edl':
        currentContent = generateMultiFilmMasterEDL(project);
        break;
      case 'sheet':
        currentContent = generateMultiFilmMasterSheet(project);
        break;
      case 'audacity':
        const allPauses = films.flatMap((f) => f.pauseEvents);
        currentContent = generateAudacityLabels(allPauses, project.frameRate);
        break;
    }
  } else {
    // Single / Active Film scope
    if (currentFilm) {
      switch (activeTab) {
        case 'ffmpeg':
          currentContent = generateFilmFFmpegScript(currentFilm, project.audioFileName || 'master_recording.wav', ffmpegFormat);
          break;
        case 'edl':
          currentContent = generateCMX3600EDL({
            ...project,
            title: `${project.title} - ${currentFilm.title}`,
            segmentsToKeep: currentFilm.segmentsToKeep,
            frameRate: currentFilm.frameRate,
          }, `REEL0${currentFilm.sequenceIndex}`);
          break;
        case 'sheet':
          currentContent = generateAuthoringSheet(project, currentFilm);
          break;
        case 'audacity':
          currentContent = generateAudacityLabels(currentFilm.pauseEvents, currentFilm.frameRate);
          break;
      }
    } else {
      switch (activeTab) {
        case 'ffmpeg':
          currentContent = generateFFmpegScript(project.segmentsToKeep, project.audioFileName || 'commentary_raw.wav', ffmpegFormat, project.frameRate);
          break;
        case 'edl':
          currentContent = generateCMX3600EDL(project);
          break;
        case 'sheet':
          currentContent = generateAuthoringSheet(project);
          break;
        case 'audacity':
          currentContent = generateAudacityLabels(project.pauseEvents, project.frameRate);
          break;
      }
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = (content: string, filename: string, mimeType = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPDF = () => {
    const doc = generateDocumentationPDF(project, currentFilm, exportScope);
    const baseName = (exportScope === 'batch'
      ? `${project.title}_batch_sync_documentation`
      : currentFilm
      ? `${project.title}_${currentFilm.title}_sync_documentation`
      : `${project.title}_sync_documentation`
    ).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    doc.save(`${baseName}.pdf`);
  };

  const handleDownloadTextSummary = () => {
    const text = generateDocumentationText(project, currentFilm, exportScope);
    const baseName = (exportScope === 'batch'
      ? `${project.title}_batch_sync_documentation`
      : currentFilm
      ? `${project.title}_${currentFilm.title}_sync_documentation`
      : `${project.title}_sync_documentation`
    ).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    handleDownloadFile(text, `${baseName}.txt`, 'text/plain');
  };

  const handleDownloadXML = () => {
    const xml = generateZoomMultiTrackXML(project, currentFilm, videoInputName, zoomFps);
    const filename = `${(currentFilm ? currentFilm.title : project.title).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}_zoom_multitrack.xml`;
    handleDownloadFile(xml, filename, 'application/xml');
  };

  const getExportFilename = () => {
    const base = (exportScope === 'batch' ? `${project.id}_batch_master` : (currentFilm ? currentFilm.title.replace(/\s+/g, '_').toLowerCase() : project.id));
    switch (activeTab) {
      case 'doc_summary':
        return `${base}_sync_documentation.txt`;
      case 'zoom_video':
        return zoomFlavor === 'windows_bat' ? `conform_zoom_video.bat` : `conform_zoom_video.sh`;
      case 'ffmpeg':
        return `${base}_audio_splicing.sh`;
      case 'edl':
        return `${base}.edl`;
      case 'sheet':
        return `${base}_authoring_specification.txt`;
      case 'audacity':
        return `${base}_audacity_labels.txt`;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[94vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <Disc className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-semibold text-white">
                Export Conformed Masters
              </h2>
              <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
                <span>{project.title}</span>
                {films && (
                  <>
                    <span aria-hidden="true" className="text-neutral-600">·</span>
                    <span className="text-neutral-400 font-mono">{films.length} Films</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Multi-Film Scope Selector if applicable */}
        {films && films.length > 1 && (
          <div className="bg-neutral-950 px-6 py-2.5 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Export Scope:</span>
              <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded border border-neutral-800">
                <button
                  onClick={() => setExportScope('active')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
                    exportScope === 'active'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Film className="w-3 h-3" />
                  <span>Single Film Segment</span>
                </button>
                <button
                  onClick={() => setExportScope('batch')}
                  className={`px-2.5 py-1 rounded transition-colors flex items-center gap-1.5 ${
                    exportScope === 'batch'
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Batch Export All Films</span>
                </button>
              </div>
            </div>

            {exportScope === 'active' && (
              <div className="flex items-center gap-2">
                <span className="text-neutral-400">Select Film:</span>
                <select
                  value={selectedFilmId}
                  onChange={(e) => setSelectedFilmId(e.target.value)}
                  className="bg-neutral-900 border border-neutral-700/80 rounded px-2.5 py-1 text-neutral-200 font-medium focus:outline-none focus:border-amber-500"
                >
                  {films.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.discLabel || `Film ${f.sequenceIndex}`}: {f.title} ({f.frameRate} fps)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Primary Audio WAV Action Banner */}
        <div className="bg-neutral-950/80 px-6 py-3 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-neutral-200 flex items-center gap-2">
              <span>Direct In-Browser Conformed 48kHz WAV Export</span>
              <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-1.5 py-0.2 rounded font-mono">
                Standalone Audio Deliverable
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Renders conformed commentary WAV with pause gaps excised, micro-crossfaded, and locked to 00:00:00:00.
            </p>
          </div>
          <button
            onClick={() => {
              if (exportScope === 'batch' && onBatchExportAllWavs) {
                onBatchExportAllWavs();
              } else {
                onExportWavAudio(currentFilm?.id);
              }
            }}
            disabled={isExportingAudio}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 rounded-lg shadow-sm transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExportingAudio
                ? 'Rendering WAV...'
                : exportScope === 'batch' && films
                ? `Render All ${films.length} WAVs`
                : 'Render Conformed WAV'}
            </span>
          </button>
        </div>

        {/* Export Tabs */}
        <div className="flex items-center gap-3 px-6 pt-2 border-b border-neutral-800 text-xs overflow-x-auto">
          <button
            onClick={() => setActiveTab('doc_summary')}
            className={`pb-2 px-1.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'doc_summary'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Documentation (PDF & Text)</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-800/80 font-bold">
              PDF
            </span>
          </button>
          <button
            onClick={() => setActiveTab('zoom_video')}
            className={`pb-2 px-1.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'zoom_video'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Video className="w-3.5 h-3.5 text-amber-400" />
            <span>Zoom Video Script</span>
          </button>
          <button
            onClick={() => setActiveTab('ffmpeg')}
            className={`pb-2 px-1.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'ffmpeg'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>FFmpeg Audio</span>
          </button>
          <button
            onClick={() => setActiveTab('edl')}
            className={`pb-2 px-1.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'edl'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>CMX 3600 EDL</span>
          </button>
          <button
            onClick={() => setActiveTab('sheet')}
            className={`pb-2 px-1.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'sheet'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Authoring Sheet</span>
          </button>
          <button
            onClick={() => setActiveTab('audacity')}
            className={`pb-2 px-1.5 font-medium border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'audacity'
                ? 'border-amber-400 text-amber-300 font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>Audacity</span>
          </button>
        </div>

        {/* Tab Controls for Documentation Summary (PDF & Text) */}
        {activeTab === 'doc_summary' && (
          <div className="px-6 py-2.5 bg-neutral-950/90 border-b border-neutral-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Executive KPI badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-neutral-400 text-[11px] font-medium">Audit Summary:</span>
                <span className="bg-neutral-900 border border-rose-800/60 text-rose-300 px-2 py-0.5 rounded text-[11px] font-mono font-semibold" title="Total Pause Duration Cut from Master">
                  Total Cut: -{docData.totalCutSec.toFixed(1)}s
                </span>
                <span className="bg-neutral-900 border border-sky-800/60 text-sky-300 px-2 py-0.5 rounded text-[11px] font-mono font-semibold" title="Number of Conformed Audio/Video Segments">
                  {docData.segmentCount} Segments
                </span>
                <span className="bg-neutral-900 border border-neutral-700 text-neutral-300 px-2 py-0.5 rounded text-[11px] font-mono">
                  {docData.pauseCount} Pause Events
                </span>
                <span className="bg-neutral-900 border border-emerald-800/60 text-emerald-300 px-2 py-0.5 rounded text-[11px] font-mono font-semibold uppercase">
                  {docData.conformityStatus}
                </span>
              </div>

              {/* Direct Download Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded shadow-sm transition-colors"
                  title="Generate and download multi-page executive PDF documentation report"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF Report</span>
                </button>
                <button
                  onClick={handleDownloadTextSummary}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded transition-colors"
                  title="Download plain-text documentation file (.txt)"
                >
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Download .txt</span>
                </button>
              </div>
            </div>

            {/* Engineer Notes Callout */}
            <div className="bg-neutral-900/80 border border-neutral-800 rounded p-2.5 text-[11px] flex flex-col gap-1">
              <div className="flex items-center justify-between text-neutral-400">
                <span className="font-semibold text-amber-400">Engineer Notes for Documentation:</span>
                <span className="text-[10px] font-mono text-neutral-500">
                  Sync Cue: "{docData.cuePhrase}"
                </span>
              </div>
              <p className="text-neutral-300 font-sans leading-relaxed">
                {docData.engineerNotes}
              </p>
            </div>
          </div>
        )}

        {/* Tab Controls for Zoom Video Conforming */}
        {activeTab === 'zoom_video' && (
          <div className="px-6 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              {/* Shell / Batch Flavor */}
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 text-[11px]">Format:</span>
                <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded border border-neutral-800">
                  <button
                    onClick={() => setZoomFlavor('bash')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      zoomFlavor === 'bash' ? 'bg-amber-400 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Bash (.sh)
                  </button>
                  <button
                    onClick={() => setZoomFlavor('windows_bat')}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                      zoomFlavor === 'windows_bat' ? 'bg-amber-400 text-neutral-950 font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Windows (.bat)
                  </button>
                </div>
              </div>

              {/* Framerate Selection (Default: 25 fps Zoom Standard) */}
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 text-[11px]">Framerate:</span>
                <select
                  value={zoomFps}
                  onChange={(e) => setZoomFps(parseFloat(e.target.value))}
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-[11px] text-amber-300 font-mono focus:outline-none"
                >
                  <option value={25}>25.00 fps (Zoom Webcam Default)</option>
                  <option value={23.976}>23.976 fps (Blu-ray Standard)</option>
                  <option value={24}>24.00 fps (Theatrical)</option>
                  <option value={29.97}>29.97 fps (NTSC / North America)</option>
                  <option value={59.94}>59.94 fps (High Frame Rate)</option>
                </select>
              </div>

              {/* Resolution Selection (Default: 1280x720) */}
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400 text-[11px]">Resolution:</span>
                <select
                  value={zoomResolution}
                  onChange={(e) => setZoomResolution(e.target.value as any)}
                  className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-[11px] text-neutral-200 font-mono focus:outline-none"
                >
                  <option value="1280x720">1280x720 (Zoom 720p HD)</option>
                  <option value="1920x1080">1920x1080 (1080p FHD)</option>
                </select>
              </div>
            </div>

            {/* FCPXML / Premiere Pro XML download button */}
            <button
              onClick={handleDownloadXML}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-sky-300 hover:text-sky-200 bg-sky-950/50 hover:bg-sky-900/50 border border-sky-800/60 rounded transition-colors"
              title="Download Final Cut Pro / Premiere Pro XML sequence with V1 and A1/A2 tracks"
            >
              <FileCode className="w-3 h-3" />
              <span>Download Premiere / FCP XML</span>
            </button>
          </div>
        )}

        {/* Tab Controls (Codec format for FFmpeg audio) */}
        {activeTab === 'ffmpeg' && (
          <div className="flex items-center justify-between px-6 py-2 bg-neutral-950/60 border-b border-neutral-800 text-xs text-neutral-400">
            <span className="text-[11px]">Audio Codec:</span>
            <div className="flex items-center gap-2">
              {(['ac3', 'wav', 'flac'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => setFfmpegFormat(fmt)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase ${
                    ffmpegFormat === fmt
                      ? 'bg-amber-400 text-neutral-950 font-bold'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Explanatory callout for Zoom Video Conform */}
        {activeTab === 'zoom_video' && (
          <div className="px-6 py-2 bg-amber-950/30 border-b border-amber-900/40 text-[11px] text-amber-200 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong>Single Source of Truth:</strong> The video recording is conformed strictly to match the audio contextual analysis with zero video AI computation. You get both a conformed video file and a standalone conformed 48kHz audio track.
              </span>
            </div>
            <span className="font-mono text-amber-400 text-[10px] shrink-0 font-semibold">
              {targetSegments.length} Segments Conformed
            </span>
          </div>
        )}

        {/* Code / Report Content View */}
        <div className="p-6 overflow-y-auto flex-1 font-mono text-xs bg-neutral-950 text-neutral-300 scrollbar-thin">
          <pre className="whitespace-pre-wrap leading-relaxed select-text">{currentContent}</pre>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-neutral-800 bg-neutral-900">
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span className="font-mono text-[11px] text-neutral-300">{getExportFilename()}</span>
            <span aria-hidden="true">·</span>
            <span>{currentContent.split('\n').length} lines</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors border border-neutral-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>

            {activeTab === 'doc_summary' ? (
              <>
                <button
                  onClick={handleDownloadTextSummary}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors border border-neutral-700"
                >
                  <FileText className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Download .txt</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF Report</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => handleDownloadFile(currentContent, getExportFilename(), activeTab === 'zoom_video' && zoomFlavor === 'bash' ? 'application/x-sh' : 'text/plain')}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {activeTab === 'zoom_video' ? (zoomFlavor === 'bash' ? '.sh Script' : '.bat Script') : 'File'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
