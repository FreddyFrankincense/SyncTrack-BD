import React, { useRef, useEffect, useState } from 'react';
import {
  Video,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  ChevronDown,
  ChevronUp,
  Upload,
  Scissors,
  CheckCircle2,
  Users,
  Info,
} from 'lucide-react';
import { FrameRate, PauseEvent, VideoSourceInfo } from '../types';
import { formatSMPTE } from '../utils/timecode';

interface ZoomWebcamMonitorProps {
  currentCommentarySec: number;
  isPlaying: boolean;
  playbackMode: 'synced' | 'raw';
  currentPauses: PauseEvent[];
  frameRate: FrameRate | 25;
  videoSource?: VideoSourceInfo;
  onUploadVideoFile: (file: File) => void;
  onSeek: (sec: number) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  activeFilmTitle?: string;
}

export const ZoomWebcamMonitor: React.FC<ZoomWebcamMonitorProps> = ({
  currentCommentarySec,
  isPlaying,
  playbackMode,
  currentPauses,
  frameRate,
  videoSource,
  onUploadVideoFile,
  onSeek,
  isOpen,
  onToggleOpen,
  activeFilmTitle,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isMuted, setIsMuted] = useState(true);
  const [showFramingGuides, setShowFramingGuides] = useState(true);
  const [displayMode, setDisplayMode] = useState<'docked' | 'theater'>('docked');
  const [detectedDimensions, setDetectedDimensions] = useState<{ width: number; height: number } | null>(null);

  // Reset detected dimensions when video source URL changes
  useEffect(() => {
    setDetectedDimensions(null);
  }, [videoSource?.url]);

  // Active cut zone check
  const activeCutZone = currentPauses.find(
    (p) =>
      p.enabled &&
      currentCommentarySec >= p.commentaryPauseStartSec &&
      currentCommentarySec < p.commentaryResumeSec
  );

  // Frame duration at current fps (e.g., 25 fps = 0.040s = 40ms)
  const frameDurationSec = 1 / frameRate;

  // Sync HTML5 video element with currentCommentarySec
  useEffect(() => {
    if (!isOpen || !videoRef.current || !videoSource?.url) return;
    const vid = videoRef.current;

    // Only seek if difference is greater than 1 frame to prevent jitter
    if (Math.abs(vid.currentTime - currentCommentarySec) > frameDurationSec * 0.8) {
      vid.currentTime = currentCommentarySec;
    }

    if (isPlaying && vid.paused) {
      vid.play().catch(() => {
        // Autoplay policy or video not ready
      });
    } else if (!isPlaying && !vid.paused) {
      vid.pause();
    }
  }, [isOpen, currentCommentarySec, isPlaying, videoSource?.url, frameDurationSec]);

  // Canvas-based high-fidelity Dual Zoom Webcam Simulator when no file is loaded yet
  useEffect(() => {
    if (!isOpen || (videoSource?.url && !videoSource?.isSimulated)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dual side-by-side 16:9 webcam layout (2560 x 720 docked, 2560 x 960 theater)
    const W = 2560;
    const H = displayMode === 'theater' ? 960 : 720;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;

    const pad = 16;
    const gap = 16;
    const tileW = (W - pad * 2 - gap) / 2;
    const tileH = H - pad * 2;
    const leftX = pad;
    const rightX = pad + tileW + gap;
    const leftCenterX = leftX + tileW / 2;
    const rightCenterX = rightX + tileW / 2;
    const centerY = H / 2 + 12;

    // Background: Dark Zoom room
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    // Left Webcam Tile (Host 1 / Speaker A)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(leftX, pad, tileW, tileH, 10);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Right Webcam Tile (Host 2 / Speaker B)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(rightX, pad, tileW, tileH, 10);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Webcam 1 & 2 Avatar & Wave
    const t = currentCommentarySec * 4;
    const isHost1Speaking = Math.sin(t) > -0.2;
    const isHost2Speaking = Math.cos(t * 0.8) > 0.1;

    // Host 1 circle
    ctx.beginPath();
    ctx.arc(leftCenterX, centerY, 96, 0, Math.PI * 2);
    ctx.fillStyle = isHost1Speaking ? '#0369a1' : '#1e3a5f';
    ctx.fill();
    ctx.strokeStyle = isHost1Speaking ? '#38bdf8' : '#475569';
    ctx.lineWidth = isHost1Speaking ? 5 : 2;
    ctx.stroke();

    // Host 1 Initials
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H1', leftCenterX, centerY + 15);

    // Host 2 circle
    ctx.beginPath();
    ctx.arc(rightCenterX, centerY, 96, 0, Math.PI * 2);
    ctx.fillStyle = isHost2Speaking ? '#047857' : '#14532d';
    ctx.fill();
    ctx.strokeStyle = isHost2Speaking ? '#34d399' : '#475569';
    ctx.lineWidth = isHost2Speaking ? 5 : 2;
    ctx.stroke();

    // Host 2 Initials
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H2', rightCenterX, centerY + 15);

    // Name labels in lower-left of each tile (Standard Zoom UI)
    const badgeY = H - pad - 60;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(leftX + 24, badgeY, 320, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Host 1 (Lead Commentator)', leftX + 40, badgeY + 29);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(rightX + 24, badgeY, 320, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('Host 2 (Guest / Co-Host)', rightX + 40, badgeY + 29);

    // Audio mic status badges
    if (isHost1Speaking) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(leftX + 324, badgeY + 22, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isHost2Speaking) {
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(rightX + 324, badgeY + 22, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Top HUD: Intended Dual Zoom Overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.beginPath();
    ctx.roundRect(pad + 16, pad + 16, W - (pad + 16) * 2, 54, 8);
    ctx.fill();

    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ZOOM RECORDING FOLLOWER', pad + 40, pad + 50);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillText('· Dual Webcam Side-by-Side @ 25.00 fps · Audio Master Truth (Zero Video AI)', pad + 360, pad + 49);

    // Live SMPTE Burn-In in Top Right
    const smpteBurn = formatSMPTE(currentCommentarySec, frameRate);
    const frameNum = Math.floor(currentCommentarySec * frameRate);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`SMPTE: ${smpteBurn} [Fr ${frameNum}]`, W - pad - 40, pad + 50);

    // Framing Center Split Guide if enabled
    if (showFramingGuides) {
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.moveTo(W / 2, 0);
      ctx.lineTo(W / 2, H);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cut Alert Overlay if in cut zone
    if (activeCutZone) {
      ctx.fillStyle = 'rgba(225, 29, 72, 0.85)';
      ctx.fillRect(0, H / 2 - 48, W, 96);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        `EXCISED PAUSE ZONE: -${activeCutZone.durationCutSec.toFixed(1)}s ("${activeCutZone.triggerPhrase.slice(0, 48)}")`,
        W / 2,
        H / 2 - 4
      );
      ctx.font = '18px monospace';
      ctx.fillStyle = '#fecdd3';
      ctx.fillText(
        `Audio Master cuts video from ${formatSMPTE(activeCutZone.commentaryPauseStartSec, frameRate)} to ${formatSMPTE(activeCutZone.commentaryResumeSec, frameRate)}`,
        W / 2,
        H / 2 + 28
      );
    }
  }, [isOpen, currentCommentarySec, frameRate, showFramingGuides, activeCutZone, videoSource?.url, videoSource?.isSimulated, displayMode]);

  // Frame Nudge Handlers (25 fps = 40ms/frame)
  const handleNudgeFrames = (deltaFrames: number) => {
    const deltaSec = deltaFrames * frameDurationSec;
    onSeek(Math.max(0, currentCommentarySec + deltaSec));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadVideoFile(e.target.files[0]);
    }
  };

  const displayWidth = detectedDimensions?.width || videoSource?.width || 1280;
  const displayHeight = detectedDimensions?.height || videoSource?.height || 720;

  if (!isOpen) {
    return (
      <div className="bg-neutral-900 border-b border-neutral-800 px-6 sm:px-8 py-3.5 flex items-center justify-between text-xs text-neutral-400">
        <div className="flex items-center gap-2.5">
          <Video className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-medium text-neutral-300">Zoom Webcam Video Monitor</span>
          <span className="text-[11px] font-mono bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
            {displayWidth}x{displayHeight} @ {frameRate} fps
          </span>
          <span className="text-neutral-500">· Follower track (Audio master)</span>
        </div>
        <button
          onClick={onToggleOpen}
          className="flex items-center gap-1 text-amber-400 hover:text-amber-300 transition-colors font-medium"
        >
          <span>Open Monitor</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <section className="bg-neutral-950 border-b border-neutral-800 transition-all select-none w-full">
      {/* Monitor Header Toolbar */}
      <div className="px-6 sm:px-8 py-3.5 bg-neutral-900/90 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        {/* Left: Status & Format Info */}
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Video className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-white">Webcam Monitor</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="bg-neutral-800 border border-neutral-700 text-amber-300 px-2 py-0.5 rounded font-semibold">
              {displayWidth}x{displayHeight}
            </span>
            <span className="bg-neutral-800 border border-neutral-700 text-sky-300 px-2 py-0.5 rounded font-semibold">
              {frameRate} FPS
            </span>
          </div>

          {videoSource?.fileName && (
            <span className="text-neutral-400 truncate max-w-xs text-[11px]">
              Source: <span className="text-neutral-200 font-mono">{videoSource.fileName}</span>
            </span>
          )}
        </div>

        {/* Right: Controls & Presets */}
        <div className="flex items-center gap-2">
          {/* Frame Nudge Buttons */}
          <div className="flex items-center gap-0.5 bg-neutral-900 border border-neutral-800 rounded p-0.5 text-[11px] font-mono">
            <button
              onClick={() => handleNudgeFrames(-5)}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
              title={`Step backward 5 frames (${(5 * frameDurationSec * 1000).toFixed(0)}ms)`}
            >
              -5 Fr
            </button>
            <button
              onClick={() => handleNudgeFrames(-1)}
              className="px-1.5 py-0.5 text-neutral-300 hover:text-white rounded hover:bg-neutral-800"
              title={`Step backward 1 frame (${(frameDurationSec * 1000).toFixed(0)}ms at ${frameRate}fps)`}
            >
              -1 Fr
            </button>
            <span className="px-1 text-neutral-600">|</span>
            <button
              onClick={() => handleNudgeFrames(1)}
              className="px-1.5 py-0.5 text-neutral-300 hover:text-white rounded hover:bg-neutral-800"
              title={`Step forward 1 frame (${(frameDurationSec * 1000).toFixed(0)}ms at ${frameRate}fps)`}
            >
              +1 Fr
            </button>
            <button
              onClick={() => handleNudgeFrames(5)}
              className="px-1.5 py-0.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
              title={`Step forward 5 frames (${(5 * frameDurationSec * 1000).toFixed(0)}ms)`}
            >
              +5 Fr
            </button>
          </div>

          {/* Dual-webcam split guide toggle */}
          <button
            onClick={() => setShowFramingGuides(!showFramingGuides)}
            className={`px-2 py-1 rounded border transition-colors flex items-center gap-1 text-[11px] ${
              showFramingGuides
                ? 'bg-amber-950/40 text-amber-300 border-amber-800/60'
                : 'text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title="Toggle 50/50 dual-webcam framing grid"
          >
            <Users className="w-3 h-3" />
            <span className="hidden sm:inline">Grid</span>
          </button>

          {/* Video Element Mute Toggle when real video is loaded */}
          {videoSource?.url && !videoSource.isSimulated && (
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-1.5 rounded border transition-colors ${
                isMuted
                  ? 'text-neutral-400 border-neutral-800 hover:text-white hover:bg-neutral-800'
                  : 'bg-sky-950/40 text-sky-300 border-sky-800/60'
              }`}
              title={isMuted ? 'Video element muted (Web Audio master plays audio)' : 'Mute HTML5 video element audio'}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Theater vs Docked sizing */}
          <button
            onClick={() => setDisplayMode(displayMode === 'docked' ? 'theater' : 'docked')}
            className="p-1.5 text-neutral-400 hover:text-white rounded border border-neutral-800 hover:bg-neutral-800 transition-colors"
            title={displayMode === 'docked' ? 'Expand Full-Bleed Theater Mode' : 'Docked Full-Width View'}
          >
            {displayMode === 'docked' ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>

          {/* Upload Real Zoom MP4 */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-neutral-950 bg-amber-400 hover:bg-amber-300 rounded shadow-sm transition-colors"
            title="Load your Zoom MP4/MOV recording into the monitor"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{videoSource?.url ? 'Replace Video' : 'Load Video'}</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Collapse Monitor */}
          <button
            onClick={onToggleOpen}
            className="p-1.5 text-neutral-400 hover:text-white rounded hover:bg-neutral-800 transition-colors ml-1"
            title="Collapse Video Monitor"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Video Viewport Canvas / Video Element - Full Horizontal Page Width */}
      <div
        className={`w-full flex flex-col items-center justify-center bg-neutral-950 ${
          displayMode === 'theater' ? 'p-0' : 'py-6 px-6 sm:px-8'
        }`}
      >
        <div
          className={`relative overflow-hidden bg-neutral-900 shadow-xl transition-all duration-300 w-full ${
            displayMode === 'theater'
              ? 'rounded-none border-b border-neutral-800'
              : 'rounded-lg border border-neutral-800'
          }`}
        >
          {videoSource?.url && !videoSource.isSimulated ? (
            <video
              ref={videoRef}
              src={videoSource.url}
              muted={isMuted}
              playsInline
              onLoadedMetadata={(e) => {
                const vid = e.currentTarget;
                if (vid.videoWidth && vid.videoHeight) {
                  setDetectedDimensions({
                    width: vid.videoWidth,
                    height: vid.videoHeight,
                  });
                }
              }}
              className="w-full h-auto block bg-black"
            />
          ) : (
            <canvas
              ref={canvasRef}
              className="w-full h-auto block bg-black"
            />
          )}

          {/* 50/50 Dual Webcam Framing Overlay (Over live video) */}
          {videoSource?.url && !videoSource.isSimulated && showFramingGuides && (
            <div className="absolute inset-0 pointer-events-none flex">
              <div className="flex-1 border-r border-dashed border-amber-500/40 relative">
                <span className="absolute bottom-3 left-3 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                  Host 1 Webcam
                </span>
              </div>
              <div className="flex-1 relative">
                <span className="absolute bottom-3 right-3 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded font-medium">
                  Host 2 Webcam
                </span>
              </div>
            </div>
          )}

          {/* Live Cut Alert Flash Badge */}
          {activeCutZone && (
            <div className="absolute top-4 left-4 right-4 bg-rose-600/90 backdrop-blur-sm border border-rose-400 text-white px-4 py-2 rounded-lg flex items-center justify-between shadow-lg animate-pulse z-20">
              <div className="flex items-center gap-2">
                <Scissors className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Cut Active: Skipping -{activeCutZone.durationCutSec.toFixed(1)}s
                </span>
              </div>
              <span className="font-mono text-xs font-semibold">
                Jump Target: {formatSMPTE(activeCutZone.commentaryResumeSec, frameRate)}
              </span>
            </div>
          )}

          {/* Sub-frame Burn-In HUD in lower-right of video */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 pointer-events-none">
            <div className="bg-black/80 backdrop-blur-md px-2.5 py-1 rounded border border-neutral-700/80 font-mono text-xs text-amber-300 tabular-nums font-semibold flex items-center gap-1.5 shadow">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>{formatSMPTE(currentCommentarySec, frameRate)}</span>
              <span className="text-[10px] text-neutral-400 font-normal">
                [Fr {Math.floor(currentCommentarySec * frameRate)}]
              </span>
            </div>
          </div>

          {/* Audio Follower Notice in lower-left */}
          <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
            <div className="bg-black/75 backdrop-blur-sm px-2.5 py-1 rounded border border-neutral-800 text-[10px] text-neutral-300 flex items-center gap-1.5 shadow">
              <Info className="w-3 h-3 text-sky-400" />
              <span>Audio Master Track Follower</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
