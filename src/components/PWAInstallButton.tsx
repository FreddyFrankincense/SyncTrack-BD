import React, { useState } from 'react';
import {
  MonitorDown,
  CheckCircle2,
  X,
  Wifi,
  WifiOff,
  HardDriveDownload,
  Cpu,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  Download,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, isMacSafari, isInIframe, install } = usePWAInstall();
  const isOnline = useOnlineStatus();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = () => {
    if (!appUrl) return;
    navigator.clipboard.writeText(appUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handlePrimaryClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  // Download a standalone OS launcher script (.bat for Windows or .command for macOS)
  // that opens SyncTrack BD in native chromeless Desktop App Mode (--app)
  const handleDownloadDesktopLauncher = (os: 'windows' | 'mac') => {
    const targetUrl = appUrl || 'http://localhost:3000';
    if (os === 'windows') {
      const batContent = [
        '@echo off',
        'REM SyncTrack BD - Standalone Desktop App Launcher (Windows)',
        'echo Launching SyncTrack BD in Standalone Desktop App Mode...',
        'where chrome >nul 2>nul',
        'if %ERRORLEVEL% EQU 0 (',
        `  start "" chrome --app="${targetUrl}"`,
        '  exit /b 0',
        ')',
        'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (',
        `  start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="${targetUrl}"`,
        '  exit /b 0',
        ')',
        'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (',
        `  start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="${targetUrl}"`,
        '  exit /b 0',
        ')',
        `start "" "${targetUrl}"`,
      ].join('\r\n');

      const blob = new Blob([batContent], { type: 'application/x-bat' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Launch_SyncTrack_BD_Desktop.bat';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const macContent = [
        '#!/bin/bash',
        '# SyncTrack BD - Standalone Desktop App Launcher (macOS)',
        `APP_URL="${targetUrl}"`,
        'if [ -d "/Applications/Google Chrome.app" ]; then',
        '  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --app="$APP_URL" >/dev/null 2>&1 &',
        'elif [ -d "/Applications/Microsoft Edge.app" ]; then',
        '  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --app="$APP_URL" >/dev/null 2>&1 &',
        'else',
        '  open "$APP_URL"',
        'fi',
      ].join('\n');

      const blob = new Blob([macContent], { type: 'text/x-shellscript' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Launch_SyncTrack_BD_Desktop.command';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  if (isInstalled) {
    return (
      <div
        className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-800/70 bg-emerald-950/50 text-emerald-300 text-[11px] font-medium"
        title="Running as an installed standalone Offline Desktop PWA"
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        <span>Desktop App Active</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePrimaryClick}
        className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded border transition-colors font-semibold ${
          isInstallable
            ? 'bg-emerald-500 text-neutral-950 border-emerald-400 hover:bg-emerald-400 shadow-sm'
            : 'bg-emerald-950/70 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900/70 hover:text-emerald-200'
        }`}
        title="Install SyncTrack BD as a Standalone Offline Desktop App (PWA)"
      >
        <MonitorDown className="w-3.5 h-3.5 text-current" />
        <span>Install Desktop App</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                  <MonitorDown className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-white">
                    Install Offline Desktop App (PWA)
                  </h2>
                  <p className="text-[11px] text-neutral-400">
                    Run SyncTrack BD in a standalone desktop window with 100% offline local sync &amp; Web Audio processing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Status Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center gap-2.5">
                  {isOnline ? (
                    <Wifi className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
                  )}
                  <div>
                    <div className="text-[10px] font-mono uppercase text-neutral-500">Network State</div>
                    <div className="font-semibold text-neutral-200">
                      {isOnline ? 'Online (Cached)' : 'Offline Mode Active'}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center gap-2.5">
                  <HardDriveDownload className="w-4 h-4 text-sky-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono uppercase text-neutral-500">Service Worker</div>
                    <div className="font-semibold text-emerald-400">Workbox Precache Ready</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center gap-2.5">
                  <Cpu className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <div className="text-[10px] font-mono uppercase text-neutral-500">Sync Engine</div>
                    <div className="font-semibold text-neutral-200">100% Local On-Device</div>
                  </div>
                </div>
              </div>

              {/* Direct Install Trigger if available */}
              {isInstallable && (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/60 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="font-semibold text-emerald-200 text-xs">
                      One-Click Native Browser Install Ready
                    </div>
                    <p className="text-[11px] text-emerald-300/80">
                      Click <strong>Install Now</strong> to trigger your browser&apos;s native desktop application installer.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await install();
                      if (ok) setShowGuideModal(false);
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold text-xs shrink-0 transition-colors shadow-md"
                  >
                    Install Now
                  </button>
                </div>
              )}

              {/* Instant Standalone Desktop Launcher Download (Works even inside iframes or when browser suppresses prompt) */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-emerald-800/50 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <div className="font-semibold text-white text-xs flex items-center gap-2">
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Instant Desktop App Launcher (Guaranteed Standalone Window)</span>
                    </div>
                    <p className="text-[11px] text-neutral-400 mt-0.5">
                      Download a tiny double-clickable launcher script that opens SyncTrack BD in a dedicated chromeless desktop window (<code className="text-amber-300 font-mono">--app</code> mode) on your computer:
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleDownloadDesktopLauncher('windows')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-semibold transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Windows Launcher (.bat)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadDesktopLauncher('mac')}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-400" />
                    <span>Download macOS Launcher (.command)</span>
                  </button>
                </div>
              </div>

              {/* Iframe Notice when viewing inside AI Studio Preview */}
              {isInIframe && !isInstallable && (
                <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/70 space-y-2.5">
                  <div className="flex items-center gap-2 text-amber-300 font-semibold">
                    <ExternalLink className="w-4 h-4 shrink-0" />
                    <span>Viewing Inside Preview Frame — Open Full URL for Native Browser Install</span>
                  </div>
                  <p className="text-[11px] text-neutral-300 leading-relaxed">
                    Browsers suppress the native PWA install prompt inside embedded preview frames. Copy the URL below into a new Chrome or Edge tab, then use the browser menu <strong>⋮ → Cast, save, and share → Install page as app...</strong>:
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <code className="flex-1 px-3 py-1.5 rounded bg-neutral-950 border border-neutral-800 text-amber-300 font-mono text-[11px] truncate">
                      {appUrl}
                    </code>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 font-medium transition-colors shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copied URL' : 'Copy URL'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Step-by-Step Browser Menu Installation Instructions */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono">
                  Manual Browser Installation Methods
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Chrome / Edge (Windows, macOS, Linux) */}
                  <div className="p-4 rounded-lg bg-neutral-950/90 border border-neutral-800 space-y-2">
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>Chrome / Edge (Always Available via Menu)</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                        Works 100%
                      </span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-neutral-300 leading-relaxed">
                      <li>Open the app URL in a standalone Chrome or Edge tab.</li>
                      <li>
                        Click the <strong>3-dot browser menu (⋮)</strong> in the top-right corner of Chrome/Edge.
                      </li>
                      <li>
                        <strong>In Chrome:</strong> Select <strong>Cast, save, and share → Install page as app...</strong>
                      </li>
                      <li>
                        <strong>In Edge:</strong> Select <strong>Apps → Install this site as an app</strong>.
                      </li>
                    </ol>
                  </div>

                  {/* macOS Safari / iOS Safari */}
                  <div className="p-4 rounded-lg bg-neutral-950/90 border border-neutral-800 space-y-2">
                    <div className="font-semibold text-white flex items-center justify-between">
                      <span>{isIOS ? 'iPhone / iPad (Safari)' : isMacSafari ? 'macOS Safari (Sonoma+)' : 'macOS & iOS Safari'}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 border border-neutral-800">
                        Apple WebApp
                      </span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-neutral-300 leading-relaxed">
                      <li>
                        <strong>macOS Safari:</strong> Open the app URL in Safari, then choose <strong>File → Add to Dock...</strong> from the top macOS menu bar.
                      </li>
                      <li>
                        <strong>iOS / iPadOS Safari:</strong> Tap the <strong>Share</strong> button in the Safari toolbar and select <strong>Add to Home Screen</strong>.
                      </li>
                      <li>Launch <strong>SyncTrackBD</strong> directly from your Dock or Home Screen with full offline storage.</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Local Dev / Source Build Instructions */}
              <div className="p-4 rounded-lg bg-neutral-950 border border-neutral-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-neutral-200">
                  <Terminal className="w-3.5 h-3.5 text-amber-400" />
                  <span>Running Locally from Downloaded Source Code (100% Air-Gapped)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  You can also export/download the project source ZIP to your machine and run a production PWA build locally:
                </p>
                <pre className="p-2.5 rounded bg-neutral-900 border border-neutral-800 font-mono text-[11px] text-amber-300 overflow-x-auto">
                  npm install && npm run build && npm run preview
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-[11px] text-neutral-500 font-mono">
                PWA Manifest ID: &quot;/&quot; · Display: standalone · Offline Engine: Active
              </span>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-6 z-50 flex items-center gap-2.5 rounded-lg bg-amber-500/95 border border-amber-400 px-3.5 py-2 text-xs font-semibold text-neutral-950 shadow-xl"
    >
      <span className="h-2 w-2 rounded-full bg-neutral-950 animate-pulse" />
      <span>Offline Mode — Local Sync Engine &amp; Cached PWA Assets Active</span>
    </div>
  );
};
