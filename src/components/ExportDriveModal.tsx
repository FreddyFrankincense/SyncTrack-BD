import React, { useState } from 'react';
import {
  Download,
  FolderArchive,
  FileCode,
  Terminal,
  HelpCircle,
  Check,
  Copy,
  ExternalLink,
  HardDrive,
  FileText,
  Monitor,
  Apple,
  Sparkles,
  Layers,
} from 'lucide-react';
import { DriveGiftConfig, MovieItem } from '../types/movie';
import {
  generateStandaloneHtml,
  generateWindowsHta,
  generateWindowsBatch,
  generateMacCommand,
  generateLinuxScript,
  generateAutorunInf,
  generateNieceReadme,
  generateHardDriveZip,
} from '../utils/offlinePackager';

import { DownloadedCover } from '../utils/tmdbService';

interface ExportDriveModalProps {
  movies: MovieItem[];
  config: DriveGiftConfig;
  isOpen: boolean;
  onClose: () => void;
  downloadedCovers?: Record<string, DownloadedCover>;
  onOpenTmdbPullModal?: () => void;
}

export const ExportDriveModal: React.FC<ExportDriveModalProps> = ({
  movies,
  config,
  isOpen,
  onClose,
  downloadedCovers = {},
  onOpenTmdbPullModal,
}) => {
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [selectedPreviewFile, setSelectedPreviewFile] = useState<
    'hta' | 'bat' | 'html' | 'mac' | 'readme' | 'autorun'
  >('hta');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  // File contents
  const standaloneHtml = generateStandaloneHtml(movies, config);
  const htaContent = generateWindowsHta(movies, config);
  const batContent = generateWindowsBatch(config);
  const macContent = generateMacCommand(config);
  const readmeContent = generateNieceReadme(movies, config);
  const autorunContent = generateAutorunInf(config);

  const getActiveCode = () => {
    switch (selectedPreviewFile) {
      case 'hta':
        return htaContent;
      case 'bat':
        return batContent;
      case 'html':
        return standaloneHtml;
      case 'mac':
        return macContent;
      case 'readme':
        return readmeContent;
      case 'autorun':
        return autorunContent;
    }
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Download complete ZIP package
  const handleDownloadZip = async () => {
    setIsExportingZip(true);
    try {
      const blob = await generateHardDriveZip(movies, config, downloadedCovers);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${config.nieceName.replace(/\s+/g, '_')}_Movie_Drive_Package.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP generation failed:', err);
    } finally {
      setIsExportingZip(false);
    }
  };

  // Single file download
  const handleDownloadSingle = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/85 backdrop-blur-md">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-serif font-bold text-neutral-100 flex items-center gap-2">
                <span>External Hard Drive Executable & Menu Packager</span>
              </h2>
              <p className="text-xs text-neutral-400">
                Package {movies.length} movies with executable launchers for Windows, Mac, and offline browser kiosk.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 p-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Summary Banner */}
          <div className="bg-gradient-to-r from-amber-950/30 via-neutral-900 to-neutral-900 border border-amber-900/40 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Ready to Copy to Your External Hard Drive</span>
              </h3>
              <p className="text-xs text-neutral-300 leading-relaxed max-w-2xl">
                Download the ZIP bundle, extract its contents to the root directory of your external hard drive, and copy your movie files (.mkv and .mp4) into the <code className="text-amber-400">Movies/</code> folder. When your niece plugs it in, she can launch the menu with 1 click!
              </p>
            </div>

            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="flex items-center gap-2 px-5 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex-shrink-0 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingZip ? 'Packaging ZIP...' : 'Download Full Hard Drive Kit (.zip)'}</span>
            </button>
          </div>

          {/* Drive Layout Visualization */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-5">
            <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-neutral-500" />
              <span>External Hard Drive Root Directory Layout</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="space-y-2 bg-neutral-900/80 p-3.5 rounded-lg border border-neutral-850">
                <div className="text-amber-400 font-bold flex items-center gap-1.5">
                  <HardDrive className="w-4 h-4" />
                  <span>[E:] {config.driveTitle.replace(/[^\w\s-]/gi, '').toUpperCase()} /</span>
                </div>
                <div className="pl-4 space-y-1.5 text-neutral-300">
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-semibold">📁 Movies/</span>
                    <span className="text-[10px] text-neutral-500 font-sans">Put your .mkv / .mp4 files here</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-semibold">📁 Covers/</span>
                    <span className="text-[10px] text-cyan-300 font-sans">
                      {Object.keys(downloadedCovers).length} TMDB covers saved locally
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-amber-300">🚀 Open_Movie_Menu.hta</span>
                    <span className="text-[10px] text-neutral-500 font-sans">Windows Native Executable</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-300">⚡ Start_Movie_Menu.bat</span>
                    <span className="text-[10px] text-neutral-500 font-sans">Windows 1-Click Launcher</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-violet-300">🍎 Start_Movie_Menu.command</span>
                    <span className="text-[10px] text-neutral-500 font-sans">Mac 1-Click Launcher</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-blue-300">🌐 index.html</span>
                    <span className="text-[10px] text-neutral-500 font-sans">Offline GUI (Any Browser)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">💌 README_FOR_NIECE.txt</span>
                    <span className="text-[10px] text-neutral-500 font-sans">Personal Letter & Guide</span>
                  </div>
                </div>
              </div>

              {/* Compatibility Highlights */}
              <div className="bg-neutral-900/80 p-3.5 rounded-lg border border-neutral-850 space-y-3 font-sans">
                <div className="font-semibold text-neutral-200 text-xs">How Your Niece Launches It:</div>
                <div className="space-y-2 text-xs text-neutral-400 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <Monitor className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-200">On Windows PC:</strong> Double-click <code className="text-amber-400">Open_Movie_Menu.hta</code> or <code className="text-amber-400">Start_Movie_Menu.bat</code>. Opens right away without installing anything!
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Apple className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-200">On Mac:</strong> Double-click <code className="text-amber-400">Start_Movie_Menu.command</code> or <code className="text-amber-400">index.html</code>.
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-neutral-200">Zero Internet Required:</strong> Everything runs 100% offline directly from the hard drive storage.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Individual File Preview & Downloads */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                Inspect Generated Files & Scripts
              </h4>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopy(getActiveCode(), selectedPreviewFile)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs transition-colors"
                >
                  {copiedKey === selectedPreviewFile ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copiedKey === selectedPreviewFile ? 'Copied!' : 'Copy Code'}</span>
                </button>

                <button
                  onClick={() => {
                    if (selectedPreviewFile === 'hta') handleDownloadSingle('Open_Movie_Menu.hta', htaContent, 'application/hta');
                    if (selectedPreviewFile === 'bat') handleDownloadSingle('Start_Movie_Menu.bat', batContent, 'application/x-bat');
                    if (selectedPreviewFile === 'html') handleDownloadSingle('index.html', standaloneHtml, 'text/html');
                    if (selectedPreviewFile === 'mac') handleDownloadSingle('Start_Movie_Menu.command', macContent, 'application/x-sh');
                    if (selectedPreviewFile === 'readme') handleDownloadSingle('README_FOR_NIECE.txt', readmeContent, 'text/plain');
                    if (selectedPreviewFile === 'autorun') handleDownloadSingle('autorun.inf', autorunContent, 'text/plain');
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download File</span>
                </button>
              </div>
            </div>

            {/* File Switcher Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: 'hta', label: 'Open_Movie_Menu.hta (Windows Executable)', icon: Monitor },
                { id: 'bat', label: 'Start_Movie_Menu.bat (Batch Launcher)', icon: Terminal },
                { id: 'html', label: 'index.html (Offline Menu)', icon: FileCode },
                { id: 'mac', label: 'Start_Movie_Menu.command (Mac)', icon: Apple },
                { id: 'readme', label: 'README_FOR_NIECE.txt', icon: FileText },
                { id: 'autorun', label: 'autorun.inf', icon: HardDrive },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = selectedPreviewFile === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedPreviewFile(tab.id as any)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-neutral-800 text-amber-300 border border-neutral-700 shadow-sm'
                        : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-850'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-neutral-400" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Code Box */}
            <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 font-mono text-xs text-neutral-300 max-h-72 overflow-y-auto leading-relaxed">
              <pre className="whitespace-pre-wrap">{getActiveCode()}</pre>
            </div>
          </div>

          {/* Portable VLC Setup Advice for MKV files */}
          <div className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 text-neutral-200 font-semibold">
              <span>💡 Pro-Tip for .MKV Multi-Language & Subtitle Playback:</span>
            </div>
            <p className="text-neutral-400 leading-relaxed">
              While <code className="text-amber-400">.mp4</code> files play seamlessly in any web browser and default player, high-fidelity <code className="text-amber-400">.mkv</code> files (which have multiple audio tracks like English / Japanese and subtitle tracks) work best with VLC Media Player.
            </p>
            <p className="text-neutral-400 leading-relaxed">
              You can optionally download <a href="https://portableapps.com/apps/music_video/vlc_portable" target="_blank" rel="noreferrer" className="text-amber-400 underline underline-offset-2">VLC Portable</a> and place the <code className="text-neutral-300">VLCPortable/</code> folder right on the external hard drive. That way, she can play ANY format on any PC without ever needing to install software!
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/40 flex items-center justify-between">
          <div className="text-xs text-neutral-400">
            Total Movies: <strong className="text-neutral-200">{movies.length}</strong> · Prepared for <strong className="text-neutral-200">{config.nieceName}</strong>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-medium"
            >
              Close
            </button>
            <button
              onClick={handleDownloadZip}
              disabled={isExportingZip}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-md transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download ZIP Package</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
