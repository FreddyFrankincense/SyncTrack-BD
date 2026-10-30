import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Scissors,
  Plus,
  Eye,
  EyeOff,
  Film,
  Maximize2,
  Split,
  Layers,
  Play,
  CheckCircle2,
  Activity,
  Flame,
  AlertTriangle,
  Crosshair,
} from 'lucide-react';
import { AnchorPoint, FilmSegment, FrameRate, PauseEvent, AudioSegment } from '../types';
import { formatSMPTE } from '../utils/timecode';

interface WaveformTimelineProps {
  durationSec: number;
  currentPlayheadSec: number;
  onSeek: (sec: number) => void;
  pauseEvents: PauseEvent[];
  anchorPoints: AnchorPoint[];
  peaks: Float32Array | null;
  frameRate: FrameRate;
  onSelectPause: (pauseId: string) => void;
  selectedPauseId: string | null;
  onAddManualPause: (timeSec: number) => void;
  initialSyncOffsetSec: number;
  // Multi-film support
  films?: FilmSegment[];
  activeFilmId?: string;
  onSelectFilm?: (filmId: string) => void;
  // Spliced preview track props
  computedSegments?: AudioSegment[];
  currentFilmSec?: number;
  playbackMode?: 'synced' | 'raw';
  onPreviewSplice?: (pause: PauseEvent) => void;
  onTogglePause?: (pauseId: string) => void;
  isFineTuning?: boolean;
}

export type TimelineViewMode = 'split' | 'master' | 'preview';
export type DriftSeverity = 'locked' | 'moderate' | 'high';

interface SpliceSeamInfo {
  index: number;
  filmTimestampSec: number;
  rawStartSec: number;
  rawResumeSec: number;
  durationCutSec: number;
  crossfadeMs: number;
  pauseId?: string;
  pauseEvent?: PauseEvent;
  leftSeg: AudioSegment;
  rightSeg: AudioSegment;
}

export interface SegmentDriftProfile {
  segment: AudioSegment;
  anchors: AnchorPoint[];
  maxAbsDriftMs: number;
  avgAbsDriftMs: number;
  signedPeakDriftMs: number;
  worstAnchor: AnchorPoint | null;
  severity: DriftSeverity;
  heatIntensity: number; // 0..1 normalized
}

export const WaveformTimeline: React.FC<WaveformTimelineProps> = ({
  durationSec,
  currentPlayheadSec,
  onSeek,
  pauseEvents,
  anchorPoints,
  peaks,
  frameRate,
  onSelectPause,
  selectedPauseId,
  onAddManualPause,
  initialSyncOffsetSec,
  films,
  activeFilmId,
  onSelectFilm,
  computedSegments,
  currentFilmSec = 0,
  playbackMode = 'synced',
  onPreviewSplice,
  onTogglePause,
  isFineTuning = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rulerCanvasRef = useRef<HTMLCanvasElement>(null);
  const masterCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showAnchorsOnTrack, setShowAnchorsOnTrack] = useState(true);
  const [showDriftHeatMap, setShowDriftHeatMap] = useState(true);
  const [timelineViewMode, setTimelineViewMode] = useState<TimelineViewMode>('split');
  const [hoveredSeam, setHoveredSeam] = useState<SpliceSeamInfo | null>(null);
  const [hoveredDriftProfile, setHoveredDriftProfile] = useState<{
    profile: SegmentDriftProfile;
    x: number;
    track: 'master' | 'preview';
    localDriftMs: number;
  } | null>(null);
  const [containerWidth, setContainerWidth] = useState(1000);
  const [forceHighRes, setForceHighRes] = useState(false);

  // Low-pass filtered macro-envelope of peaks so overview mode is calm and low-noise
  const smoothedPeaks = useMemo(() => {
    if (!peaks || peaks.length === 0) return null;
    const len = peaks.length;
    const out = new Float32Array(len);
    const radius = Math.max(6, Math.floor(len / 75));
    for (let i = 0; i < len; i++) {
      let sum = 0;
      let count = 0;
      const start = Math.max(0, i - radius);
      const end = Math.min(len - 1, i + radius);
      for (let j = start; j <= end; j++) {
        sum += peaks[j];
        count++;
      }
      const avg = count > 0 ? sum / count : 0;
      out[i] = Math.pow(avg, 0.85) * 0.72;
    }
    return out;
  }, [peaks]);

  // High-resolution granularity is only active when zoomed in (>= 2.5x) or explicitly toggled
  const isGlobalHighRes = forceHighRes || zoomLevel >= 2.5;

  // Resize listener + ResizeObserver for responsive container width tracking
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      observer = new ResizeObserver(() => handleResize());
      observer.observe(containerRef.current);
    }
    return () => {
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
    };
  }, []);

  const TRACK_PAD_X = 36;
  const timelineWidth = Math.max(containerWidth, Math.round(containerWidth * zoomLevel));
  const usableTrackWidth = Math.max(200, timelineWidth - TRACK_PAD_X * 2);
  const trackStartX = TRACK_PAD_X;
  const trackEndX = TRACK_PAD_X + usableTrackWidth;
  const pxPerSec = usableTrackWidth / (durationSec || 1);

  // Effective kept audio segments
  const effectiveSegments: AudioSegment[] = useMemo(() => {
    if (computedSegments && computedSegments.length > 0) {
      return computedSegments;
    }
    const enabledPauses = pauseEvents
      .filter((p) => p.enabled)
      .sort((a, b) => a.commentaryPauseStartSec - b.commentaryPauseStartSec);

    const segs: AudioSegment[] = [];
    let curSrc = initialSyncOffsetSec;
    let curFilm = 0;

    enabledPauses.forEach((pause, idx) => {
      if (pause.commentaryPauseStartSec > curSrc) {
        const segDur = pause.commentaryPauseStartSec - curSrc;
        segs.push({
          segmentIndex: idx + 1,
          rawCommentaryStartSec: curSrc,
          rawCommentaryEndSec: pause.commentaryPauseStartSec,
          targetFilmStartSec: curFilm,
          targetFilmEndSec: curFilm + segDur,
          durationSec: segDur,
        });
        curFilm += segDur;
      }
      curSrc = Math.max(curSrc, pause.commentaryResumeSec);
    });

    if (curSrc < durationSec) {
      const segDur = durationSec - curSrc;
      segs.push({
        segmentIndex: segs.length + 1,
        rawCommentaryStartSec: curSrc,
        rawCommentaryEndSec: durationSec,
        targetFilmStartSec: curFilm,
        targetFilmEndSec: curFilm + segDur,
        durationSec: segDur,
      });
    }

    return segs;
  }, [computedSegments, pauseEvents, initialSyncOffsetSec, durationSec]);

  // Sorted anchor points by commentarySec for continuous drift interpolation
  const sortedAnchors = useMemo(() => {
    return [...anchorPoints].sort((a, b) => a.commentarySec - b.commentarySec);
  }, [anchorPoints]);

  // Per-Segment Drift Profiles for the Drift Heat-Map Overlay
  const segmentDriftProfiles: SegmentDriftProfile[] = useMemo(() => {
    return effectiveSegments.map((seg) => {
      // Find anchors within this segment's raw commentary range (with 1.5s boundary tolerance)
      const inRangeAnchors = sortedAnchors.filter(
        (a) =>
          a.commentarySec >= seg.rawCommentaryStartSec - 1.5 &&
          a.commentarySec <= seg.rawCommentaryEndSec + 1.5
      );

      // If no anchors fall strictly inside this segment, sample nearest flanking anchor within 60s
      let evaluatedAnchors = inRangeAnchors;
      if (evaluatedAnchors.length === 0 && sortedAnchors.length > 0) {
        const segMid = (seg.rawCommentaryStartSec + seg.rawCommentaryEndSec) / 2;
        let nearest = sortedAnchors[0];
        let minDist = Math.abs(nearest.commentarySec - segMid);
        for (let i = 1; i < sortedAnchors.length; i++) {
          const d = Math.abs(sortedAnchors[i].commentarySec - segMid);
          if (d < minDist) {
            minDist = d;
            nearest = sortedAnchors[i];
          }
        }
        if (minDist <= 90) {
          evaluatedAnchors = [nearest];
        }
      }

      if (evaluatedAnchors.length === 0) {
        return {
          segment: seg,
          anchors: [],
          maxAbsDriftMs: 0,
          avgAbsDriftMs: 0,
          signedPeakDriftMs: 0,
          worstAnchor: null,
          severity: 'locked' as DriftSeverity,
          heatIntensity: 0.08,
        };
      }

      let maxAbs = 0;
      let sumAbs = 0;
      let worst: AnchorPoint = evaluatedAnchors[0];

      evaluatedAnchors.forEach((a) => {
        const abs = Math.abs(a.driftMs);
        sumAbs += abs;
        if (abs >= maxAbs) {
          maxAbs = abs;
          worst = a;
        }
      });

      const avgAbs = Math.round((sumAbs / evaluatedAnchors.length) * 10) / 10;
      const severity: DriftSeverity =
        maxAbs > 45 ? 'high' : maxAbs > 10 ? 'moderate' : 'locked';
      const heatIntensity = Math.min(1, Math.max(0.08, maxAbs / 75));

      return {
        segment: seg,
        anchors: inRangeAnchors,
        maxAbsDriftMs: maxAbs,
        avgAbsDriftMs: avgAbs,
        signedPeakDriftMs: worst.driftMs,
        worstAnchor: worst,
        severity,
        heatIntensity,
      };
    });
  }, [effectiveSegments, sortedAnchors]);

  // Continuous local drift estimator (in ms) at any raw commentary timestamp
  // Combines piecewise linear interpolation between anchors + Gaussian hotspot amplification near anchors
  const getInterpolatedAbsDriftAtRawSec = useMemo(() => {
    if (sortedAnchors.length === 0) {
      return (_rawSec: number) => 0;
    }
    const radiusSec = Math.max(8, durationSec * 0.035);
    return (rawSec: number): number => {
      // 1. Piecewise linear interpolation between bracketing anchors
      let baseDrift = 0;
      if (rawSec <= sortedAnchors[0].commentarySec) {
        const dist = sortedAnchors[0].commentarySec - rawSec;
        const falloff = Math.exp(-(dist * dist) / (2 * radiusSec * radiusSec * 4));
        baseDrift = Math.abs(sortedAnchors[0].driftMs) * falloff;
      } else if (rawSec >= sortedAnchors[sortedAnchors.length - 1].commentarySec) {
        const last = sortedAnchors[sortedAnchors.length - 1];
        const dist = rawSec - last.commentarySec;
        const falloff = Math.exp(-(dist * dist) / (2 * radiusSec * radiusSec * 4));
        baseDrift = Math.abs(last.driftMs) * falloff;
      } else {
        for (let i = 0; i < sortedAnchors.length - 1; i++) {
          const left = sortedAnchors[i];
          const right = sortedAnchors[i + 1];
          if (rawSec >= left.commentarySec && rawSec <= right.commentarySec) {
            const span = Math.max(0.001, right.commentarySec - left.commentarySec);
            const t = (rawSec - left.commentarySec) / span;
            baseDrift =
              Math.abs(left.driftMs) * (1 - t) + Math.abs(right.driftMs) * t;
            break;
          }
        }
      }

      // 2. Gaussian hotspot plume around nearby anchors so high-deviation anchors glow prominently
      let hotspotBoost = 0;
      for (let i = 0; i < sortedAnchors.length; i++) {
        const a = sortedAnchors[i];
        const d = rawSec - a.commentarySec;
        if (Math.abs(d) <= radiusSec * 2.5) {
          const g = Math.exp(-(d * d) / (2 * radiusSec * radiusSec));
          hotspotBoost = Math.max(hotspotBoost, Math.abs(a.driftMs) * g);
        }
      }

      return Math.max(baseDrift, hotspotBoost);
    };
  }, [sortedAnchors, durationSec]);

  // Total conformed preview duration
  const totalConformedSec = useMemo(() => {
    if (effectiveSegments.length > 0) {
      return effectiveSegments.reduce((sum, s) => sum + s.durationSec, 0);
    }
    const totalCut = pauseEvents.filter((p) => p.enabled).reduce((sum, p) => sum + p.durationCutSec, 0);
    return Math.max(1, durationSec - totalCut);
  }, [effectiveSegments, pauseEvents, durationSec]);

  const totalCutSec = useMemo(() => {
    return pauseEvents.filter((p) => p.enabled).reduce((sum, p) => sum + p.durationCutSec, 0);
  }, [pauseEvents]);

  // Spliced seams across adjacent segments
  const spliceSeams: SpliceSeamInfo[] = useMemo(() => {
    const list: SpliceSeamInfo[] = [];
    if (effectiveSegments.length < 2) return list;

    for (let i = 0; i < effectiveSegments.length - 1; i++) {
      const leftSeg = effectiveSegments[i];
      const rightSeg = effectiveSegments[i + 1];
      const seamFilmSec = leftSeg.targetFilmEndSec;

      const matchPause = pauseEvents.find(
        (p) =>
          p.enabled &&
          Math.abs(p.commentaryPauseStartSec - leftSeg.rawCommentaryEndSec) < 0.5
      );

      list.push({
        index: i + 1,
        filmTimestampSec: seamFilmSec,
        rawStartSec: leftSeg.rawCommentaryEndSec,
        rawResumeSec: rightSeg.rawCommentaryStartSec,
        durationCutSec: rightSeg.rawCommentaryStartSec - leftSeg.rawCommentaryEndSec,
        crossfadeMs: matchPause ? matchPause.crossfadeMs : 20,
        pauseId: matchPause?.id,
        pauseEvent: matchPause,
        leftSeg,
        rightSeg,
      });
    }
    return list;
  }, [effectiveSegments, pauseEvents]);

  // Selected pause object
  const selectedPause = useMemo(() => {
    return pauseEvents.find((p) => p.id === selectedPauseId) || null;
  }, [pauseEvents, selectedPauseId]);

  // Aggregate Sync Confidence Score & Anchor Alignment breakdown for current film
  const anchorSyncStats = useMemo(() => {
    const total = anchorPoints.length;
    if (total === 0) {
      return {
        total: 0,
        alignedCount: 0,
        driftedCount: 0,
        minorDriftCount: 0,
        severeDriftCount: 0,
        alignedPct: 100,
        minorDriftPct: 0,
        severeDriftPct: 0,
        score: 100,
        avgDriftMs: 0,
        maxDriftMs: 0,
        worstAnchor: null as AnchorPoint | null,
      };
    }

    let alignedCount = 0;
    let minorDriftCount = 0;
    let severeDriftCount = 0;
    let totalScorePoints = 0;
    let sumAbsDrift = 0;
    let maxDriftMs = 0;
    let worstAnchor: AnchorPoint | null = anchorPoints[0];

    anchorPoints.forEach((a) => {
      const absDrift = Math.abs(a.driftMs);
      sumAbsDrift += absDrift;
      if (absDrift >= maxDriftMs) {
        maxDriftMs = absDrift;
        worstAnchor = a;
      }
      if (absDrift <= 10) {
        alignedCount++;
        totalScorePoints += 100;
      } else if (absDrift <= 45) {
        minorDriftCount++;
        totalScorePoints += Math.max(60, Math.round(100 - (absDrift - 10) * 1.1));
      } else {
        severeDriftCount++;
        totalScorePoints += Math.max(15, Math.round(60 - (absDrift - 45) * 0.8));
      }
    });

    const driftedCount = minorDriftCount + severeDriftCount;
    const score = Math.round(totalScorePoints / total);
    const alignedPct = (alignedCount / total) * 100;
    const minorDriftPct = (minorDriftCount / total) * 100;
    const severeDriftPct = (severeDriftCount / total) * 100;
    const avgDriftMs = Math.round((sumAbsDrift / total) * 10) / 10;

    return {
      total,
      alignedCount,
      driftedCount,
      minorDriftCount,
      severeDriftCount,
      alignedPct,
      minorDriftPct,
      severeDriftPct,
      score,
      avgDriftMs,
      maxDriftMs,
      worstAnchor,
    };
  }, [anchorPoints]);

  // High/Moderate drift segments for quick visual auditing
  const driftedSegments = useMemo(() => {
    return segmentDriftProfiles.filter((p) => p.severity !== 'locked');
  }, [segmentDriftProfiles]);

  const highDriftSegmentCount = useMemo(() => {
    return segmentDriftProfiles.filter((p) => p.severity === 'high').length;
  }, [segmentDriftProfiles]);

  // Helper to map local absolute drift (ms) to thermal RGBA color
  const getThermalPeakColor = (absDriftMs: number, useHiRes: boolean, defaultRgba: string): string => {
    if (!showDriftHeatMap) return defaultRgba;
    if (absDriftMs > 45) {
      const alpha = useHiRes ? 0.96 : 0.82;
      return `rgba(244, 63, 94, ${alpha})`; // Rose-500 High Drift
    }
    if (absDriftMs > 25) {
      const alpha = useHiRes ? 0.92 : 0.75;
      return `rgba(249, 115, 22, ${alpha})`; // Orange-500 Elevated Drift
    }
    if (absDriftMs > 10) {
      const alpha = useHiRes ? 0.88 : 0.68;
      return `rgba(245, 158, 11, ${alpha})`; // Amber-500 Moderate Drift
    }
    const alpha = useHiRes ? 0.78 : 0.46;
    return `rgba(16, 185, 129, ${alpha})`; // Emerald-500 Nominal/Locked
  };

  // 1. Draw Timecode Ruler Canvas
  useEffect(() => {
    const canvas = rulerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const height = 28;
    if (canvas.width !== timelineWidth) canvas.width = timelineWidth;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, timelineWidth, height);
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, timelineWidth, height);

    // Subtle padded gutter zones on left and right ends
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(0, 0, trackStartX, height);
    ctx.fillRect(trackEndX, 0, timelineWidth - trackEndX, height);

    ctx.strokeStyle = '#383838';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#a3a3a3';
    ctx.font = '9.5px JetBrains Mono, monospace';

    let stepSec = 10;
    if (pxPerSec > 40) stepSec = 1;
    else if (pxPerSec > 20) stepSec = 2;
    else if (pxPerSec > 8) stepSec = 5;
    else if (pxPerSec > 4) stepSec = 10;
    else if (pxPerSec > 1.5) stepSec = 30;
    else stepSec = 60;

    const totalSteps = Math.ceil(durationSec / stepSec);
    for (let i = 0; i <= totalSteps; i++) {
      const sec = Math.min(durationSec, i * stepSec);
      const x = trackStartX + sec * pxPerSec;
      if (x > trackEndX + 1) break;

      const isMajor = i % 2 === 0 || sec === 0 || sec === durationSec;
      const tickHeight = isMajor ? 12 : 6;

      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x, height - tickHeight);
      ctx.stroke();

      if (isMajor && x + 50 < timelineWidth) {
        ctx.fillText(formatSMPTE(sec, frameRate), x + 4, 12);
      }
      if (sec === durationSec) break;
    }

    // Multi-Film chapter banners on top of ruler if multi-film
    if (films && films.length > 0) {
      films.forEach((film) => {
        const startX = trackStartX + film.rawRange.startSec * pxPerSec;
        const width = (film.rawRange.endSec - film.rawRange.startSec) * pxPerSec;
        const isActive = film.id === activeFilmId;

        ctx.fillStyle = isActive ? 'rgba(245, 158, 11, 0.3)' : 'rgba(56, 189, 248, 0.15)';
        ctx.fillRect(startX, 0, width, 4);

        if (width > 80) {
          ctx.fillStyle = isActive ? '#fbbf24' : '#7dd3fc';
          ctx.font = 'bold 8.5px JetBrains Mono, monospace';
          ctx.fillText(`▶ ${film.discLabel || `Film ${film.sequenceIndex}`}: ${film.title}`, startX + 6, height - 3);
        }
      });
    }
  }, [timelineWidth, trackStartX, trackEndX, durationSec, pxPerSec, frameRate, films, activeFilmId]);

  // 2. Draw Track 1: Master Recording (Raw Waveform + Drift Heat-Map + Cut Zones)
  useEffect(() => {
    if (timelineViewMode === 'preview') return;
    const canvas = masterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = timelineWidth;
    const height = timelineViewMode === 'split' ? 88 : 124;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Track background
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, height);

    // Left & Right Padded Selection Gutters
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, trackStartX, height);
    ctx.fillRect(trackEndX, 0, width - trackEndX, height);

    ctx.strokeStyle = '#262626';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trackStartX, 0);
    ctx.lineTo(trackStartX, height);
    ctx.moveTo(trackEndX, 0);
    ctx.lineTo(trackEndX, height);
    ctx.stroke();

    // =========================================================================
    // DRIFT HEAT-MAP OVERLAY (Master Recording Track - Segment Zones & Hotspots)
    // =========================================================================
    if (showDriftHeatMap && segmentDriftProfiles.length > 0) {
      segmentDriftProfiles.forEach((profile) => {
        const segStartX = Math.max(trackStartX, trackStartX + profile.segment.rawCommentaryStartSec * pxPerSec);
        const segEndX = Math.min(trackEndX, trackStartX + profile.segment.rawCommentaryEndSec * pxPerSec);
        const segW = Math.max(0, segEndX - segStartX);
        if (segW <= 1) return;

        // Segment background thermal wash
        if (profile.severity === 'high') {
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, `rgba(244, 63, 94, ${0.18 + profile.heatIntensity * 0.16})`);
          grad.addColorStop(0.5, `rgba(225, 29, 72, ${0.10 + profile.heatIntensity * 0.12})`);
          grad.addColorStop(1, `rgba(244, 63, 94, ${0.20 + profile.heatIntensity * 0.16})`);
          ctx.fillStyle = grad;
          ctx.fillRect(segStartX, 0, segW, height);
        } else if (profile.severity === 'moderate') {
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, `rgba(245, 158, 11, ${0.12 + profile.heatIntensity * 0.12})`);
          grad.addColorStop(0.5, `rgba(217, 119, 6, ${0.06 + profile.heatIntensity * 0.08})`);
          grad.addColorStop(1, `rgba(245, 158, 11, ${0.14 + profile.heatIntensity * 0.12})`);
          ctx.fillStyle = grad;
          ctx.fillRect(segStartX, 0, segW, height);
        } else {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.04)';
          ctx.fillRect(segStartX, 0, segW, height);
        }

        // Top & bottom thermal severity rail bars (3px height)
        const railColor =
          profile.severity === 'high'
            ? '#f43f5e'
            : profile.severity === 'moderate'
            ? '#f59e0b'
            : 'rgba(16, 185, 129, 0.55)';
        ctx.fillStyle = railColor;
        ctx.fillRect(segStartX, 0, segW, 3);
        ctx.fillRect(segStartX, height - 3, segW, 3);
      });

      // Radial thermal plumes around moderate & high-drift anchors
      const plumeRadiusPx = Math.max(28, Math.min(110, usableTrackWidth * 0.045));
      anchorPoints.forEach((anc) => {
        const absDrift = Math.abs(anc.driftMs);
        if (absDrift <= 10) return;
        const ax = trackStartX + anc.commentarySec * pxPerSec;
        if (ax < trackStartX || ax > trackEndX) return;

        const isSevere = absDrift > 45;
        const radGrad = ctx.createRadialGradient(ax, height / 2, 2, ax, height / 2, plumeRadiusPx);
        if (isSevere) {
          radGrad.addColorStop(0, 'rgba(244, 63, 94, 0.36)');
          radGrad.addColorStop(0.55, 'rgba(244, 63, 94, 0.14)');
          radGrad.addColorStop(1, 'rgba(244, 63, 94, 0)');
        } else {
          radGrad.addColorStop(0, 'rgba(245, 158, 11, 0.26)');
          radGrad.addColorStop(0.55, 'rgba(245, 158, 11, 0.10)');
          radGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
        }
        ctx.fillStyle = radGrad;
        ctx.fillRect(
          Math.max(trackStartX, ax - plumeRadiusPx),
          0,
          Math.min(trackEndX - Math.max(trackStartX, ax - plumeRadiusPx), plumeRadiusPx * 2),
          height
        );
      });
    }

    // Multi-Film: Draw Intermission gap patterns between sequential films
    if (films && films.length > 1) {
      for (let i = 0; i < films.length - 1; i++) {
        const interStart = films[i].rawRange.endSec;
        const interEnd = films[i + 1].rawRange.startSec;
        if (interEnd > interStart) {
          const startX = trackStartX + interStart * pxPerSec;
          const interW = (interEnd - interStart) * pxPerSec;

          ctx.fillStyle = 'rgba(23, 23, 23, 0.95)';
          ctx.fillRect(startX, 0, interW, height);

          ctx.save();
          ctx.strokeStyle = 'rgba(115, 115, 115, 0.2)';
          ctx.lineWidth = 1;
          for (let sx = startX; sx < startX + interW + height; sx += 8) {
            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx - height, height);
            ctx.stroke();
          }
          ctx.restore();

          ctx.strokeStyle = '#525252';
          ctx.lineWidth = 1;
          ctx.strokeRect(startX, 0, interW, height);

          ctx.fillStyle = '#a3a3a3';
          ctx.font = 'bold 8.5px JetBrains Mono, monospace';
          const gapDur = interEnd - interStart;
          ctx.fillText(`⏸ INTERMISSION (${gapDur.toFixed(0)}s)`, startX + 6, height / 2);
        }
      }
    }

    // Centerline
    const midY = height / 2;
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trackStartX, midY);
    ctx.lineTo(trackEndX, midY);
    ctx.stroke();

    // Pre-roll initial trim region if any (scoped to active film start if multi-film)
    const activeFilmObj = films && activeFilmId ? films.find((f) => f.id === activeFilmId) : null;
    const preRollStartSec = activeFilmObj ? activeFilmObj.rawRange.startSec : 0;
    if (initialSyncOffsetSec > preRollStartSec) {
      const preRollStartX = trackStartX + preRollStartSec * pxPerSec;
      const preRollWidth = (initialSyncOffsetSec - preRollStartSec) * pxPerSec;
      ctx.fillStyle = 'rgba(75, 85, 99, 0.25)';
      ctx.fillRect(preRollStartX, 0, preRollWidth, height);
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(preRollStartX, 0, preRollWidth, height);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '8px JetBrains Mono, monospace';
      ctx.fillText(`PRE-ROLL TRIM`, preRollStartX + 4, height - 6);
    }

    // Draw Pause Cut Zones
    pauseEvents.forEach((pause) => {
      const startX = trackStartX + pause.commentaryPauseStartSec * pxPerSec;
      const cutWidth = (pause.commentaryResumeSec - pause.commentaryPauseStartSec) * pxPerSec;
      const isSelected = pause.id === selectedPauseId;

      if (pause.enabled) {
        ctx.fillStyle = isSelected ? 'rgba(239, 68, 68, 0.38)' : 'rgba(217, 119, 6, 0.22)';
        ctx.fillRect(startX, 0, cutWidth, height);

        // Striped diagonal lines
        ctx.save();
        ctx.strokeStyle = isSelected ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.2)';
        ctx.lineWidth = 1.5;
        const stripeStep = 10;
        for (let sx = startX; sx < startX + cutWidth + height; sx += stripeStep) {
          ctx.beginPath();
          ctx.moveTo(sx, 0);
          ctx.lineTo(sx - height, height);
          ctx.stroke();
        }
        ctx.restore();

        // Crossfade Transition Ramps
        if (pause.crossfadeMs > 0) {
          const xfadePx = Math.max(3, (pause.crossfadeMs / 1000) * pxPerSec);

          const inFadeStart = Math.max(trackStartX, startX - xfadePx);
          const inGradient = ctx.createLinearGradient(inFadeStart, 0, startX, 0);
          inGradient.addColorStop(0, 'rgba(56, 189, 248, 0.05)');
          inGradient.addColorStop(1, 'rgba(56, 189, 248, 0.45)');
          ctx.fillStyle = inGradient;
          ctx.beginPath();
          ctx.moveTo(inFadeStart, 0);
          ctx.lineTo(startX, 0);
          ctx.lineTo(startX, height);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(inFadeStart, 0);
          ctx.lineTo(startX, height);
          ctx.stroke();
          ctx.setLineDash([]);

          const outFadeEnd = Math.min(trackEndX, startX + cutWidth + xfadePx);
          const outGradient = ctx.createLinearGradient(startX + cutWidth, 0, outFadeEnd, 0);
          outGradient.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
          outGradient.addColorStop(1, 'rgba(56, 189, 248, 0.05)');
          ctx.fillStyle = outGradient;
          ctx.beginPath();
          ctx.moveTo(startX + cutWidth, height);
          ctx.lineTo(outFadeEnd, 0);
          ctx.lineTo(startX + cutWidth, 0);
          ctx.closePath();
          ctx.fill();

          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(startX + cutWidth, height);
          ctx.lineTo(outFadeEnd, 0);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.strokeStyle = isSelected ? '#ef4444' : '#f59e0b';
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(startX, 0, cutWidth, height);

        ctx.fillStyle = isSelected ? '#fecaca' : '#fde68a';
        ctx.font = 'bold 8.5px JetBrains Mono, monospace';
        const xfadeText = pause.crossfadeMs > 0 ? ` · XFade ${pause.crossfadeMs}ms` : ' · 0ms';
        ctx.fillText(`CUT: -${pause.durationCutSec.toFixed(1)}s${xfadeText}`, startX + 4, 14);
      } else {
        ctx.fillStyle = 'rgba(82, 82, 82, 0.15)';
        ctx.fillRect(startX, 0, cutWidth, height);
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, 0, cutWidth, height);
        ctx.fillStyle = '#737373';
        ctx.font = '8px JetBrains Mono, monospace';
        ctx.fillText(`BYPASSED`, startX + 4, 14);
      }
    });

    // Draw Audio Waveform Peaks for Master Tape
    const fineTuneStartX =
      isFineTuning && selectedPause
        ? Math.max(trackStartX, trackStartX + (selectedPause.commentaryPauseStartSec - 6) * pxPerSec)
        : -1;
    const fineTuneEndX =
      isFineTuning && selectedPause
        ? Math.min(trackEndX, trackStartX + (selectedPause.commentaryResumeSec + 6) * pxPerSec)
        : -1;

    let x = trackStartX;
    while (x < trackEndX) {
      const inLocalFineTuneZone = x >= fineTuneStartX && x <= fineTuneEndX;
      const useHiResHere = isGlobalHighRes || inLocalFineTuneZone;
      const step = useHiResHere ? 2.5 : 8;
      const barW = useHiResHere ? 1.5 : 4.5;

      let amp = 0.15;
      const sourcePeaks = useHiResHere ? peaks : smoothedPeaks || peaks;
      if (sourcePeaks && sourcePeaks.length > 0) {
        const startRatio = Math.max(0, Math.min(1, (x - trackStartX) / usableTrackWidth));
        const endRatio = Math.max(0, Math.min(1, (x + step - trackStartX) / usableTrackWidth));
        const startIdx = Math.min(sourcePeaks.length - 1, Math.floor(startRatio * sourcePeaks.length));
        const endIdx = Math.min(sourcePeaks.length - 1, Math.max(startIdx, Math.floor(endRatio * sourcePeaks.length)));
        let sum = 0;
        let count = 0;
        for (let idx = startIdx; idx <= endIdx; idx++) {
          sum += sourcePeaks[idx];
          count++;
        }
        amp = count > 0 ? sum / count : sourcePeaks[startIdx];
      } else {
        const normalizedT = (x - trackStartX) / usableTrackWidth;
        amp = useHiResHere
          ? Math.abs(Math.sin(normalizedT * 80) * 0.3 + Math.cos(normalizedT * 220) * 0.15) + 0.1
          : Math.abs(Math.sin(normalizedT * 24) * 0.25) + 0.12;
      }

      const rawSecHere = ((x - trackStartX) / usableTrackWidth) * durationSec;
      const localAbsDrift = showDriftHeatMap ? getInterpolatedAbsDriftAtRawSec(rawSecHere) : 0;

      const scaleFactor = useHiResHere ? 0.42 : 0.33;
      const barHeight = Math.max(1.5, amp * (height * scaleFactor));
      const defaultColor = useHiResHere ? 'rgba(245, 158, 11, 0.88)' : 'rgba(245, 158, 11, 0.48)';
      ctx.fillStyle = getThermalPeakColor(localAbsDrift, useHiResHere, defaultColor);
      ctx.fillRect(x, midY - barHeight, Math.min(barW, trackEndX - x), barHeight * 2);

      x += step;
    }

    // Draw Drift Heat-Map Segment Deviation Badges on Master Track
    if (showDriftHeatMap) {
      segmentDriftProfiles.forEach((profile) => {
        if (profile.severity === 'locked') return;
        const segStartX = Math.max(trackStartX, trackStartX + profile.segment.rawCommentaryStartSec * pxPerSec);
        const segEndX = Math.min(trackEndX, trackStartX + profile.segment.rawCommentaryEndSec * pxPerSec);
        const segW = segEndX - segStartX;
        if (segW < 55) return;

        const isHigh = profile.severity === 'high';
        const sign = profile.signedPeakDriftMs > 0 ? `+${profile.signedPeakDriftMs}` : `${profile.signedPeakDriftMs}`;
        const label = `SEG #${profile.segment.segmentIndex} · ${isHigh ? 'HIGH DRIFT' : 'DRIFT'} ${sign}ms`;
        ctx.font = 'bold 8px JetBrains Mono, monospace';
        const badgeW = Math.min(segW - 8, ctx.measureText(label).width + 10);
        const badgeX = segStartX + 6;
        const badgeY = height - 17;

        ctx.fillStyle = isHigh ? 'rgba(159, 18, 57, 0.92)' : 'rgba(146, 64, 14, 0.90)';
        ctx.fillRect(badgeX, badgeY, badgeW, 12);
        ctx.strokeStyle = isHigh ? '#fb7185' : '#fbbf24';
        ctx.lineWidth = 1;
        ctx.strokeRect(badgeX, badgeY, badgeW, 12);

        ctx.fillStyle = isHigh ? '#ffe4e6' : '#fef3c7';
        ctx.fillText(label, badgeX + 5, badgeY + 9);
      });
    }

    // Multi-Film: Highlight active film and draw clear boundary markers
    if (films && films.length > 0) {
      films.forEach((film) => {
        const startX = trackStartX + film.rawRange.startSec * pxPerSec;
        const endX = trackStartX + film.rawRange.endSec * pxPerSec;
        const isActive = film.id === activeFilmId;

        ctx.strokeStyle = isActive ? '#f59e0b' : '#38bdf8';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.setLineDash([4, 3]);

        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(startX, height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(endX, 0);
        ctx.lineTo(endX, height);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = isActive ? '#f59e0b' : '#0284c7';
        ctx.fillRect(startX, 0, Math.min(160, endX - startX), 14);
        ctx.fillStyle = '#0a0a0a';
        ctx.font = 'bold 8.5px JetBrains Mono, monospace';
        ctx.fillText(`▶ ${film.title}`, startX + 4, 10);

        if (!isActive) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(startX, 0, endX - startX, height);
        }
      });
    }

    // Draw Anchor Points with Millisecond Drift Badge
    if (showAnchorsOnTrack) {
      anchorPoints.forEach((anc) => {
        const x = trackStartX + anc.commentarySec * pxPerSec;
        const absDrift = Math.abs(anc.driftMs);
        const isLocked = absDrift <= 10;
        const isModerate = absDrift > 10 && absDrift <= 45;
        const color = isLocked ? '#10b981' : isModerate ? '#f59e0b' : '#f43f5e';
        const textColor = isLocked ? '#a7f3d0' : isModerate ? '#fde68a' : '#fecdd3';

        ctx.strokeStyle = color;
        ctx.lineWidth = absDrift > 45 ? 2 : 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        ctx.setLineDash([]);

        // Outer halo for high-drift anchors when heat-map is active
        if (showDriftHeatMap && absDrift > 10) {
          ctx.fillStyle = absDrift > 45 ? 'rgba(244, 63, 94, 0.35)' : 'rgba(245, 158, 11, 0.3)';
          ctx.beginPath();
          ctx.arc(x, 8, absDrift > 45 ? 7 : 5.5, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, 8, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = textColor;
        ctx.font = 'bold 7.5px JetBrains Mono, monospace';
        const driftSign = anc.driftMs > 0 ? `+${anc.driftMs}` : `${anc.driftMs}`;
        ctx.fillText(`[${driftSign}ms]`, x + 5, 20);
      });
    }
  }, [
    timelineViewMode,
    timelineWidth,
    usableTrackWidth,
    trackStartX,
    trackEndX,
    peaks,
    smoothedPeaks,
    isGlobalHighRes,
    isFineTuning,
    selectedPause,
    pauseEvents,
    selectedPauseId,
    initialSyncOffsetSec,
    pxPerSec,
    anchorPoints,
    showAnchorsOnTrack,
    showDriftHeatMap,
    segmentDriftProfiles,
    getInterpolatedAbsDriftAtRawSec,
    durationSec,
    films,
    activeFilmId,
  ]);

  // 3. Draw Track 2: Conformed BD Preview (Post-Splice Audio + Drift Heat-Map + Seams)
  useEffect(() => {
    if (timelineViewMode === 'master') return;
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = timelineWidth;
    const height = timelineViewMode === 'split' ? 88 : 124;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;

    ctx.clearRect(0, 0, width, height);

    // Track background (Deep slate blue-gray for conformed digital preview)
    ctx.fillStyle = '#080e1a';
    ctx.fillRect(0, 0, width, height);

    // Left & Right Padded Selection Gutters
    ctx.fillStyle = '#050911';
    ctx.fillRect(0, 0, trackStartX, height);
    ctx.fillRect(trackEndX, 0, width - trackEndX, height);

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trackStartX, 0);
    ctx.lineTo(trackStartX, height);
    ctx.moveTo(trackEndX, 0);
    ctx.lineTo(trackEndX, height);
    ctx.stroke();

    const conformedPxWidth = totalConformedSec * pxPerSec;
    const conformedEndX = Math.min(trackEndX, trackStartX + conformedPxWidth);

    // =========================================================================
    // DRIFT HEAT-MAP OVERLAY (Conformed BD Preview Track)
    // =========================================================================
    if (showDriftHeatMap && segmentDriftProfiles.length > 0) {
      segmentDriftProfiles.forEach((profile) => {
        const segStartX = Math.max(trackStartX, trackStartX + profile.segment.targetFilmStartSec * pxPerSec);
        const segEndX = Math.min(conformedEndX, trackStartX + profile.segment.targetFilmEndSec * pxPerSec);
        const segW = Math.max(0, segEndX - segStartX);
        if (segW <= 1) return;

        if (profile.severity === 'high') {
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, `rgba(244, 63, 94, ${0.20 + profile.heatIntensity * 0.16})`);
          grad.addColorStop(0.5, `rgba(190, 18, 60, ${0.12 + profile.heatIntensity * 0.12})`);
          grad.addColorStop(1, `rgba(244, 63, 94, ${0.22 + profile.heatIntensity * 0.16})`);
          ctx.fillStyle = grad;
          ctx.fillRect(segStartX, 0, segW, height);
        } else if (profile.severity === 'moderate') {
          const grad = ctx.createLinearGradient(0, 0, 0, height);
          grad.addColorStop(0, `rgba(245, 158, 11, ${0.14 + profile.heatIntensity * 0.12})`);
          grad.addColorStop(0.5, `rgba(180, 83, 9, ${0.07 + profile.heatIntensity * 0.08})`);
          grad.addColorStop(1, `rgba(245, 158, 11, ${0.16 + profile.heatIntensity * 0.12})`);
          ctx.fillStyle = grad;
          ctx.fillRect(segStartX, 0, segW, height);
        } else {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.045)';
          ctx.fillRect(segStartX, 0, segW, height);
        }

        // Top & bottom thermal severity rail bars (3px height)
        const railColor =
          profile.severity === 'high'
            ? '#f43f5e'
            : profile.severity === 'moderate'
            ? '#f59e0b'
            : 'rgba(16, 185, 129, 0.55)';
        ctx.fillStyle = railColor;
        ctx.fillRect(segStartX, 0, segW, 3);
        ctx.fillRect(segStartX, height - 3, segW, 3);
      });
    }

    // Excised runtime zone at the end of conformed track
    if (conformedEndX < trackEndX) {
      const remainingW = trackEndX - conformedEndX;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.fillRect(conformedEndX, 0, remainingW, height);

      // Diagonal crosshatching for trimmed tail
      ctx.save();
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.35)';
      ctx.lineWidth = 1;
      for (let sx = conformedEndX; sx < trackEndX + height; sx += 10) {
        ctx.beginPath();
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx - height, height);
        ctx.stroke();
      }
      ctx.restore();

      // Feature completion marker
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(conformedEndX, 0);
      ctx.lineTo(conformedEndX, height);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 8.5px JetBrains Mono, monospace';
      const savedSec = durationSec - totalConformedSec;
      ctx.fillText(`⮑ END OF SPLICED AUDIO (-${savedSec.toFixed(1)}s dead air excised)`, conformedEndX + 10, height / 2 + 3);
    }

    // Centerline
    const midY = height / 2;
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(trackStartX, midY);
    ctx.lineTo(conformedEndX, midY);
    ctx.stroke();

    // Render continuous audio waveform without the excised cut gaps (segment-by-segment O(W) pass)
    if (effectiveSegments.length > 0) {
      const seamXs = spliceSeams.map((s) => trackStartX + s.filmTimestampSec * pxPerSec);
      const selectedSeam = spliceSeams.find((s) => s.pauseId && s.pauseId === selectedPauseId);
      const selectedSeamX = selectedSeam ? trackStartX + selectedSeam.filmTimestampSec * pxPerSec : -9999;

      for (const seg of effectiveSegments) {
        const segStartX = Math.max(trackStartX, Math.floor(trackStartX + seg.targetFilmStartSec * pxPerSec));
        const segEndX = Math.min(conformedEndX, Math.ceil(trackStartX + seg.targetFilmEndSec * pxPerSec));

        let x = segStartX;
        while (x < segEndX) {
          const nearSelectedSeam = isFineTuning && Math.abs(x - selectedSeamX) <= 6 * pxPerSec;
          const useHiResHere = isGlobalHighRes || nearSelectedSeam;
          const step = useHiResHere ? 2.5 : 8;
          const barW = useHiResHere ? 1.5 : 4.5;

          const filmSec = (x - trackStartX) / pxPerSec;
          const offset = filmSec - seg.targetFilmStartSec;
          const rawSec = seg.rawCommentaryStartSec + offset;
          let amp = 0.15;

          const sourcePeaks = useHiResHere ? peaks : smoothedPeaks || peaks;
          if (sourcePeaks && sourcePeaks.length > 0 && durationSec > 0) {
            const rawRatio = Math.max(0, Math.min(1, rawSec / durationSec));
            const peakIdx = Math.min(sourcePeaks.length - 1, Math.floor(rawRatio * sourcePeaks.length));
            amp = sourcePeaks[peakIdx];
          } else {
            const normalizedT = rawSec / (durationSec || 1);
            amp = useHiResHere
              ? Math.abs(Math.sin(normalizedT * 120) * 0.3 + Math.cos(normalizedT * 310) * 0.15) + 0.12
              : Math.abs(Math.sin(normalizedT * 24) * 0.25) + 0.12;
          }

          const scaleFactor = useHiResHere ? 0.42 : 0.33;
          const barHeight = Math.max(1.5, amp * (height * scaleFactor));
          let isNearSplice = false;
          for (let si = 0; si < seamXs.length; si++) {
            if (Math.abs(seamXs[si] - x) < 8) {
              isNearSplice = true;
              break;
            }
          }

          if (isNearSplice) {
            ctx.fillStyle = '#38bdf8';
          } else {
            const localAbsDrift = showDriftHeatMap ? getInterpolatedAbsDriftAtRawSec(rawSec) : 0;
            const defaultCyan = useHiResHere ? 'rgba(6, 182, 212, 0.88)' : 'rgba(6, 182, 212, 0.48)';
            ctx.fillStyle = getThermalPeakColor(localAbsDrift, useHiResHere, defaultCyan);
          }
          ctx.fillRect(x, midY - barHeight, Math.min(barW, segEndX - x), barHeight * 2);

          x += step;
        }
      }
    }

    // Draw Drift Heat-Map Segment Deviation Badges on Conformed Preview Track
    if (showDriftHeatMap) {
      segmentDriftProfiles.forEach((profile) => {
        if (profile.severity === 'locked') return;
        const segStartX = Math.max(trackStartX, trackStartX + profile.segment.targetFilmStartSec * pxPerSec);
        const segEndX = Math.min(conformedEndX, trackStartX + profile.segment.targetFilmEndSec * pxPerSec);
        const segW = segEndX - segStartX;
        if (segW < 55) return;

        const isHigh = profile.severity === 'high';
        const sign = profile.signedPeakDriftMs > 0 ? `+${profile.signedPeakDriftMs}` : `${profile.signedPeakDriftMs}`;
        const label = `SEG #${profile.segment.segmentIndex} · ${isHigh ? 'PEAK DRIFT' : 'DRIFT'} ${sign}ms`;
        ctx.font = 'bold 8px JetBrains Mono, monospace';
        const badgeW = Math.min(segW - 8, ctx.measureText(label).width + 10);
        const badgeX = segStartX + 6;
        const badgeY = height - 17;

        ctx.fillStyle = isHigh ? 'rgba(159, 18, 57, 0.92)' : 'rgba(146, 64, 14, 0.90)';
        ctx.fillRect(badgeX, badgeY, badgeW, 12);
        ctx.strokeStyle = isHigh ? '#fb7185' : '#fbbf24';
        ctx.lineWidth = 1;
        ctx.strokeRect(badgeX, badgeY, badgeW, 12);

        ctx.fillStyle = isHigh ? '#ffe4e6' : '#fef3c7';
        ctx.fillText(label, badgeX + 5, badgeY + 9);
      });
    }

    // Draw Splice Seams with Crossfade Ramps & Badges
    spliceSeams.forEach((seam) => {
      const seamX = trackStartX + seam.filmTimestampSec * pxPerSec;
      const isSelected = seam.pauseId === selectedPauseId;

      const xfadeSec = (seam.crossfadeMs || 20) / 1000;
      const xfadePx = Math.max(4, xfadeSec * pxPerSec);
      const xfadeLeft = Math.max(trackStartX, seamX - xfadePx / 2);
      const xfadeRight = Math.min(trackEndX, seamX + xfadePx / 2);

      // Crossfade area tint
      ctx.fillStyle = isSelected ? 'rgba(245, 158, 11, 0.25)' : 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(xfadeLeft, 0, xfadeRight - xfadeLeft, height);

      // Crossfade ramp lines
      ctx.save();
      ctx.strokeStyle = isSelected ? 'rgba(251, 191, 36, 0.65)' : 'rgba(56, 189, 248, 0.45)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);

      ctx.beginPath();
      ctx.moveTo(xfadeLeft, 3);
      ctx.lineTo(xfadeRight, height - 3);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(xfadeLeft, height - 3);
      ctx.lineTo(xfadeRight, 3);
      ctx.stroke();
      ctx.restore();

      // Splice seam vertical line
      ctx.strokeStyle = isSelected ? '#f59e0b' : '#38bdf8';
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(seamX, 0);
      ctx.lineTo(seamX, height);
      ctx.stroke();

      // Top splice bracket notch
      ctx.fillStyle = isSelected ? '#f59e0b' : '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(seamX - 4, 0);
      ctx.lineTo(seamX + 4, 0);
      ctx.lineTo(seamX, 5);
      ctx.closePath();
      ctx.fill();

      // Bottom splice notch
      ctx.beginPath();
      ctx.moveTo(seamX - 4, height);
      ctx.lineTo(seamX + 4, height);
      ctx.lineTo(seamX, height - 5);
      ctx.closePath();
      ctx.fill();

      // Seam label badge
      ctx.fillStyle = isSelected ? '#f59e0b' : '#0284c7';
      const labelText = `SEAM #${seam.index}: -${seam.durationCutSec.toFixed(1)}s (${seam.crossfadeMs}ms)`;
      const badgeW = Math.min(145, Math.max(70, ctx.measureText(labelText).width + 8));

      ctx.fillRect(seamX - badgeW / 2, 5, badgeW, 13);
      ctx.fillStyle = '#0a0a0a';
      ctx.font = 'bold 8px JetBrains Mono, monospace';
      ctx.fillText(labelText, seamX - badgeW / 2 + 4, 15);
    });
  }, [
    timelineViewMode,
    timelineWidth,
    trackStartX,
    trackEndX,
    pxPerSec,
    effectiveSegments,
    segmentDriftProfiles,
    showDriftHeatMap,
    getInterpolatedAbsDriftAtRawSec,
    spliceSeams,
    totalConformedSec,
    durationSec,
    peaks,
    smoothedPeaks,
    isGlobalHighRes,
    isFineTuning,
    selectedPauseId,
  ]);

  // Click on Master Track (seeks raw master tape time; clicking in left/right padding cleanly selects 0s or end)
  const handleMasterTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const seekSec = Math.max(0, Math.min(durationSec, (clickX - trackStartX) / pxPerSec));
    onSeek(seekSec);
  };

  // Hover on Master Track for Drift Heat-Map inspection
  const handleMouseMoveMaster = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!showDriftHeatMap || !containerRef.current) {
      if (hoveredDriftProfile) setHoveredDriftProfile(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const hoverX = e.clientX - rect.left + scrollLeft;
    const rawSec = Math.max(0, Math.min(durationSec, (hoverX - trackStartX) / pxPerSec));

    const matchProfile = segmentDriftProfiles.find(
      (p) =>
        rawSec >= p.segment.rawCommentaryStartSec &&
        rawSec <= p.segment.rawCommentaryEndSec
    );
    if (matchProfile && matchProfile.severity !== 'locked') {
      const localDriftMs = Math.round(getInterpolatedAbsDriftAtRawSec(rawSec));
      setHoveredDriftProfile({
        profile: matchProfile,
        x: Math.max(trackStartX + 90, Math.min(trackEndX - 90, hoverX)),
        track: 'master',
        localDriftMs,
      });
    } else {
      setHoveredDriftProfile(null);
    }
  };

  // Click on Conformed Preview Track (maps film time to master tape time)
  const handlePreviewTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const clickX = e.clientX - rect.left + scrollLeft;
    const clickedFilmSec = Math.max(0, Math.min(totalConformedSec, (clickX - trackStartX) / pxPerSec));

    // Find if user clicked on or very close to a splice seam (< 12px)
    const clickedSeam = spliceSeams.find(
      (s) => Math.abs(trackStartX + s.filmTimestampSec * pxPerSec - clickX) <= 12
    );

    if (clickedSeam) {
      if (clickedSeam.pauseId) {
        onSelectPause(clickedSeam.pauseId);
      }
      if (clickedSeam.pauseEvent && onPreviewSplice) {
        onPreviewSplice(clickedSeam.pauseEvent);
        return;
      }
    }

    // Map clicked filmSec to raw commentary second
    const seg = effectiveSegments.find(
      (s) => clickedFilmSec >= s.targetFilmStartSec && clickedFilmSec <= s.targetFilmEndSec
    );

    if (seg) {
      const rawSec = seg.rawCommentaryStartSec + (clickedFilmSec - seg.targetFilmStartSec);
      onSeek(rawSec);
    } else if (effectiveSegments.length > 0) {
      if (clickedFilmSec <= effectiveSegments[0].targetFilmStartSec) {
        onSeek(effectiveSegments[0].rawCommentaryStartSec);
      } else {
        onSeek(effectiveSegments[effectiveSegments.length - 1].rawCommentaryEndSec);
      }
    }
  };

  // Track hover for splice seams and Drift Heat-Map segments on Preview Track
  const handleMouseMovePreview = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const scrollLeft = containerRef.current.scrollLeft;
    const hoverX = e.clientX - rect.left + scrollLeft;

    const nearbySeam = spliceSeams.find(
      (s) => Math.abs(trackStartX + s.filmTimestampSec * pxPerSec - hoverX) <= 14
    );
    setHoveredSeam(nearbySeam || null);

    if (showDriftHeatMap && !nearbySeam) {
      const filmSec = Math.max(0, Math.min(totalConformedSec, (hoverX - trackStartX) / pxPerSec));
      const matchProfile = segmentDriftProfiles.find(
        (p) =>
          filmSec >= p.segment.targetFilmStartSec &&
          filmSec <= p.segment.targetFilmEndSec
      );
      if (matchProfile && matchProfile.severity !== 'locked') {
        const rawSec =
          matchProfile.segment.rawCommentaryStartSec +
          (filmSec - matchProfile.segment.targetFilmStartSec);
        const localDriftMs = Math.round(getInterpolatedAbsDriftAtRawSec(rawSec));
        setHoveredDriftProfile({
          profile: matchProfile,
          x: Math.max(trackStartX + 90, Math.min(trackEndX - 90, hoverX)),
          track: 'preview',
          localDriftMs,
        });
      } else {
        setHoveredDriftProfile(null);
      }
    } else if (nearbySeam) {
      setHoveredDriftProfile(null);
    }
  };

  const playheadMasterX = trackStartX + currentPlayheadSec * pxPerSec;
  const playheadPreviewX = trackStartX + (currentFilmSec || 0) * pxPerSec;

  // Zoom to active film region helper
  const handleZoomToActiveFilm = () => {
    if (!films || !activeFilmId || !containerRef.current) return;
    const film = films.find((f) => f.id === activeFilmId);
    if (!film) return;
    const filmDur = film.rawRange.endSec - film.rawRange.startSec;
    if (filmDur <= 0) return;
    const desiredZoom = Math.min(10, Math.max(1, (durationSec / filmDur) * 0.9));
    setZoomLevel(desiredZoom);

    setTimeout(() => {
      if (containerRef.current) {
        const newTimelineW = Math.max(containerWidth, Math.round(containerWidth * desiredZoom));
        const newUsableW = Math.max(200, newTimelineW - TRACK_PAD_X * 2);
        const filmStartPx = TRACK_PAD_X + film.rawRange.startSec * (newUsableW / durationSec);
        containerRef.current.scrollLeft = Math.max(0, filmStartPx - 40);
      }
    }, 50);
  };

  // Audit helper: jump to a specific segment or worst anchor point and center timeline scroll
  const handleAuditDriftSegment = (profile: SegmentDriftProfile) => {
    const targetSec = profile.worstAnchor
      ? profile.worstAnchor.commentarySec
      : (profile.segment.rawCommentaryStartSec + profile.segment.rawCommentaryEndSec) / 2;
    onSeek(targetSec);

    if (containerRef.current) {
      const targetPx = trackStartX + targetSec * pxPerSec;
      const viewW = containerRef.current.clientWidth;
      containerRef.current.scrollTo({
        left: Math.max(0, targetPx - viewW / 2),
        behavior: 'smooth',
      });
    }
  };

  const enabledCutCount = pauseEvents.filter((p) => p.enabled).length;

  return (
    <div className="bg-neutral-950 border-b border-neutral-800 select-none">
      {/* Timeline Quick Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-6 sm:px-8 py-3.5 bg-neutral-900/80 border-b border-neutral-800 text-xs gap-4">
        {/* Left Toolbar Controls */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Split / Single Track View Mode Switcher */}
          <div className="flex items-center bg-neutral-950 p-0.5 rounded border border-neutral-800">
            <button
              onClick={() => setTimelineViewMode('split')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                timelineViewMode === 'split'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Split Track: Master Tape + Conformed Preview stacked"
            >
              <Split className="w-3.5 h-3.5 text-cyan-400" />
              <span>Split</span>
            </button>
            <button
              onClick={() => setTimelineViewMode('master')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                timelineViewMode === 'master'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Master Tape Only"
            >
              <Layers className="w-3.5 h-3.5 text-amber-400" />
              <span>Master</span>
            </button>
            <button
              onClick={() => setTimelineViewMode('preview')}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                timelineViewMode === 'preview'
                  ? 'bg-neutral-800 text-white shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
              title="Conformed BD Preview Only"
            >
              <Film className="w-3.5 h-3.5 text-sky-400" />
              <span>Preview</span>
            </button>
          </div>

          <span className="text-neutral-700 hidden sm:inline" aria-hidden="true">|</span>

          {/* Drift Heat-Map Overlay Toggle */}
          <button
            onClick={() => setShowDriftHeatMap((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-[11px] font-medium border ${
              showDriftHeatMap
                ? highDriftSegmentCount > 0
                  ? 'text-rose-200 bg-rose-950/50 border-rose-700/60 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : 'text-amber-200 bg-amber-950/40 border-amber-700/50'
                : 'text-neutral-400 bg-neutral-950/60 border-neutral-800 hover:text-neutral-200'
            }`}
            title="Toggle Drift Heat-Map Overlay to visually audit segments with high anchor-point deviation"
          >
            <Flame
              className={`w-3.5 h-3.5 ${
                showDriftHeatMap
                  ? highDriftSegmentCount > 0
                    ? 'text-rose-400'
                    : 'text-amber-400'
                  : 'text-neutral-500'
              }`}
            />
            <span>Drift Heat-Map</span>
            {driftedSegments.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded font-mono text-[9.5px] font-bold ${
                  showDriftHeatMap
                    ? highDriftSegmentCount > 0
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                      : 'bg-amber-500/30 text-amber-200 border border-amber-500/40'
                    : 'bg-neutral-800 text-neutral-400'
                }`}
              >
                {driftedSegments.length} {driftedSegments.length === 1 ? 'hotspot' : 'hotspots'}
              </span>
            )}
          </button>

          {/* Sync Anchors Toggle */}
          <button
            onClick={() => setShowAnchorsOnTrack(!showAnchorsOnTrack)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-[11px] ${
              showAnchorsOnTrack
                ? 'text-sky-300 bg-sky-950/40 border border-sky-800/40'
                : 'text-neutral-400 hover:text-neutral-200 border border-transparent'
            }`}
            title="Toggle visibility of sync anchor markers on waveform"
          >
            {showAnchorsOnTrack ? <Eye className="w-3 h-3 text-sky-400" /> : <EyeOff className="w-3 h-3 text-neutral-500" />}
            <span>Anchors ({anchorPoints.length})</span>
          </button>

          {/* Waveform Frequency Granularity Toggle */}
          <button
            onClick={() => setForceHighRes((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-colors text-[11px] border ${
              isGlobalHighRes
                ? 'text-amber-300 bg-amber-950/40 border-amber-800/50'
                : 'text-neutral-400 bg-neutral-950/60 border-neutral-800 hover:text-neutral-200'
            }`}
            title="Low-res macro envelope by default; high-res frequency transients activate automatically when fine-tuning cuts or zooming >= 250%"
          >
            <Activity className="w-3 h-3 text-amber-400" />
            <span>{isGlobalHighRes ? 'Fine-Tune Hi-Res' : isFineTuning ? 'Cut Boundary Hi-Res' : 'Low-Res Envelope'}</span>
          </button>

          {/* Zoom to Active Film Button */}
          {films && films.length > 0 && (
            <button
              onClick={handleZoomToActiveFilm}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-amber-300 bg-amber-950/40 hover:bg-amber-900/50 border border-amber-800/50 rounded transition-colors"
              title="Zoom and center timeline on active film segment"
            >
              <Maximize2 className="w-3 h-3 text-amber-400" />
              <span>Zoom Film</span>
            </button>
          )}

          {/* Audio Continuity Badge */}
          <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 bg-neutral-950 rounded border border-neutral-800/70 text-[11px] text-neutral-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400 font-mono">{spliceSeams.length} seams</span>
            <span className="text-neutral-600">·</span>
            <span className="text-neutral-400 font-mono">-{totalCutSec.toFixed(1)}s cut</span>
          </div>

          {/* Aggregate Sync Confidence Score Progress Bar */}
          <div
            className="flex items-center gap-2 px-2.5 py-1 bg-neutral-950 rounded border border-neutral-800/80 text-[11px]"
            title={`Aggregate Sync Confidence: ${anchorSyncStats.score}% · ${anchorSyncStats.alignedCount}/${anchorSyncStats.total} anchors locked (≤10ms), ${anchorSyncStats.driftedCount} with drift (avg ±${anchorSyncStats.avgDriftMs}ms)`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-neutral-400 font-medium">Sync Confidence</span>
              <span
                className={`font-mono font-bold tabular-nums ${
                  anchorSyncStats.score >= 90
                    ? 'text-emerald-400'
                    : anchorSyncStats.score >= 75
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {anchorSyncStats.score}%
              </span>
            </div>

            {/* Segmented Progress-Style Bar (Aligned vs Drift) */}
            <svg
              viewBox="0 0 100 8"
              preserveAspectRatio="none"
              className="w-20 h-2 rounded-full overflow-hidden bg-neutral-900 border border-neutral-800 shrink-0"
              role="progressbar"
              aria-valuenow={anchorSyncStats.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Film Sync Confidence Score"
            >
              {anchorSyncStats.alignedPct > 0 && (
                <rect
                  x={0}
                  y={0}
                  width={anchorSyncStats.alignedPct}
                  height={8}
                  className="fill-emerald-500 transition-all duration-300"
                />
              )}
              {anchorSyncStats.minorDriftPct > 0 && (
                <rect
                  x={anchorSyncStats.alignedPct}
                  y={0}
                  width={anchorSyncStats.minorDriftPct}
                  height={8}
                  className="fill-amber-400 transition-all duration-300"
                />
              )}
              {anchorSyncStats.severeDriftPct > 0 && (
                <rect
                  x={anchorSyncStats.alignedPct + anchorSyncStats.minorDriftPct}
                  y={0}
                  width={anchorSyncStats.severeDriftPct}
                  height={8}
                  className="fill-rose-500 transition-all duration-300"
                />
              )}
            </svg>

            <div className="flex items-center gap-1 font-mono text-[10px] tabular-nums">
              <span className="text-emerald-400 font-semibold">
                {anchorSyncStats.alignedCount}/{anchorSyncStats.total} aligned
              </span>
              <span className="text-neutral-600">·</span>
              <span
                className={
                  anchorSyncStats.driftedCount > 0 ? 'text-amber-400 font-semibold' : 'text-neutral-500'
                }
              >
                {anchorSyncStats.driftedCount} drift
              </span>
            </div>
          </div>
        </div>

        {/* Right Toolbar Controls (Audition Selected & Zoom) */}
        <div className="flex items-center gap-3">
          {selectedPause && onPreviewSplice && (
            <button
              onClick={() => onPreviewSplice(selectedPause)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-amber-200 bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 rounded transition-colors"
              title="Audition audio continuity across selected pause cut"
            >
              <Play className="w-3 h-3 fill-amber-400 text-amber-400" />
              <span>Audition Cut</span>
            </button>
          )}

          <button
            onClick={() => onAddManualPause(currentPlayheadSec)}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 transition-colors"
            title="Mark manual cut at current playhead position"
          >
            <Plus className="w-3 h-3 text-amber-400" />
            <span>Mark Cut</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 pl-2 border-l border-neutral-800">
            <button
              onClick={() => setZoomLevel((z) => Math.max(1, z - 0.5))}
              disabled={zoomLevel <= 1}
              className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 rounded hover:bg-neutral-800"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[11px] font-mono text-neutral-400 min-w-[34px] text-center">
              {Math.round(zoomLevel * 100)}%
            </span>
            <button
              onClick={() => setZoomLevel((z) => Math.min(10, z + 0.5))}
              disabled={zoomLevel >= 10}
              className="p-1 text-neutral-400 hover:text-white disabled:opacity-30 rounded hover:bg-neutral-800"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Drift Heat-Map Visual Audit Strip */}
      {showDriftHeatMap && (
        <div className="flex flex-wrap items-center justify-between px-6 sm:px-8 py-2 bg-neutral-950/95 border-b border-neutral-800/80 text-[11px] gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5 text-neutral-300 font-mono text-[10.5px]">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-semibold tracking-wide text-neutral-200">DRIFT HEAT-MAP AUDIT:</span>
            </div>

            {/* Thermal Scale Legend */}
            <div className="flex items-center gap-3 text-[10px] font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500/80 border border-emerald-400" />
                <span>≤10ms Locked</span>
              </span>
              <span className="flex items-center gap-1.5 text-amber-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500/80 border border-amber-400" />
                <span>11–45ms Moderate</span>
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500/80 border border-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.6)]" />
                <span>&gt;45ms High Deviation</span>
              </span>
            </div>

            {/* Quick-Jump Hotspot Segment Audit Buttons */}
            {driftedSegments.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap pl-2 border-l border-neutral-800">
                <span className="text-[10px] text-neutral-400 font-mono mr-1">Audit Hotspots:</span>
                {driftedSegments.map((profile) => {
                  const isHigh = profile.severity === 'high';
                  const sign =
                    profile.signedPeakDriftMs > 0
                      ? `+${profile.signedPeakDriftMs}`
                      : `${profile.signedPeakDriftMs}`;
                  return (
                    <button
                      key={`audit-seg-${profile.segment.segmentIndex}`}
                      onClick={() => handleAuditDriftSegment(profile)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] transition-all cursor-pointer border ${
                        isHigh
                          ? 'bg-rose-950/60 hover:bg-rose-900/80 text-rose-200 border-rose-700/70 shadow-[0_0_8px_rgba(244,63,94,0.2)]'
                          : 'bg-amber-950/50 hover:bg-amber-900/70 text-amber-200 border-amber-700/60'
                      }`}
                      title={`Click to seek playhead to Segment #${profile.segment.segmentIndex} worst anchor (${
                        profile.worstAnchor?.label || 'Anchor'
                      } at ${formatSMPTE(
                        profile.worstAnchor?.commentarySec ?? profile.segment.rawCommentaryStartSec,
                        frameRate
                      )})`}
                    >
                      <Crosshair className={`w-2.5 h-2.5 ${isHigh ? 'text-rose-400' : 'text-amber-400'}`} />
                      <span className="font-bold">Seg #{profile.segment.segmentIndex}</span>
                      <span>({sign}ms)</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] font-mono text-emerald-400 pl-2 border-l border-neutral-800">
                All segments locked within ≤10ms studio tolerance
              </span>
            )}
          </div>

          {/* Peak Deviation Summary & Worst Anchor Jump */}
          {anchorSyncStats.worstAnchor && anchorSyncStats.maxDriftMs > 10 && (
            <button
              onClick={() => {
                if (anchorSyncStats.worstAnchor) {
                  onSeek(anchorSyncStats.worstAnchor.commentarySec);
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-[10px] font-mono text-neutral-300 transition-colors cursor-pointer"
              title="Jump directly to highest anchor-point deviation on timeline"
            >
              <AlertTriangle
                className={`w-3 h-3 ${
                  anchorSyncStats.maxDriftMs > 45 ? 'text-rose-400' : 'text-amber-400'
                }`}
              />
              <span>
                Peak Deviation:{' '}
                <strong
                  className={
                    anchorSyncStats.maxDriftMs > 45 ? 'text-rose-400' : 'text-amber-400'
                  }
                >
                  {anchorSyncStats.worstAnchor.driftMs > 0
                    ? `+${anchorSyncStats.worstAnchor.driftMs}ms`
                    : `${anchorSyncStats.worstAnchor.driftMs}ms`}
                </strong>{' '}
                @ {formatSMPTE(anchorSyncStats.worstAnchor.commentarySec, frameRate)}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Padded Outer Wrapper + Scrollable Timeline Canvas Container */}
      <div className="px-6 sm:px-8 py-4 bg-neutral-950">
        <div
          ref={containerRef}
          className="overflow-x-auto relative cursor-crosshair scrollbar-thin rounded-xl border border-neutral-800/90 bg-neutral-950 shadow-inner"
        >
          <div style={{ width: timelineWidth }} className="relative select-none">
            {/* Top SMPTE Timecode Ruler */}
            <canvas ref={rulerCanvasRef} className="block w-full border-b border-neutral-800/80" />

            {/* =========================================================================
                TRACK 1: MASTER RECORDING (RAW TAPE)
               ========================================================================= */}
            {(timelineViewMode === 'split' || timelineViewMode === 'master') && (
              <div className="relative group border-b border-neutral-800/60">
                {/* Track 1 Label Overlay Header */}
                <div className="sticky left-0 z-20 flex items-center justify-between px-5 py-2 bg-neutral-950/85 backdrop-blur-xs border-b border-neutral-800/40 text-[10.5px]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-semibold text-[9px] border border-amber-500/30">
                      TRK 1
                    </span>
                    <span className="font-semibold text-neutral-200 tracking-wide">
                      MASTER RECORDING
                    </span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-400 font-mono">
                      Raw Tape: {formatSMPTE(durationSec, frameRate)}
                    </span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-amber-400/90 font-mono">
                      {pauseEvents.length} Pauses ({enabledCutCount} active cuts)
                    </span>
                    {showDriftHeatMap && (
                      <>
                        <span className="text-neutral-500">·</span>
                        <span className="text-rose-400/90 font-mono flex items-center gap-1">
                          <Flame className="w-3 h-3 text-rose-400" />
                          <span>Thermal Drift Overlay Active</span>
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-400">
                    <span className="text-neutral-500">Tape TC:</span>
                    <span className="text-amber-400 font-bold">{formatSMPTE(currentPlayheadSec, frameRate)}</span>
                  </div>
                </div>

                {/* Master Waveform Canvas */}
                <div
                  onMouseDown={handleMasterTrackClick}
                  onMouseMove={handleMouseMoveMaster}
                  onMouseLeave={() => setHoveredDriftProfile(null)}
                  className="relative"
                >
                  <canvas ref={masterCanvasRef} className="block w-full" />

                  {/* Master Playhead (Red Needle) */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-30"
                    style={{
                      left: `${playheadMasterX}px`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="w-2.5 h-2.5 bg-red-500 transform rotate-45 -mt-1 mx-auto shadow-md" />
                    <div className="w-[1.5px] h-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.9)] mx-auto" />
                  </div>

                  {/* Hover Drift Heat-Map Telemetry HUD on Master Track */}
                  {hoveredDriftProfile && hoveredDriftProfile.track === 'master' && (
                    <div
                      className={`absolute top-2 z-40 bg-neutral-900/95 text-neutral-200 rounded px-2.5 py-1.5 shadow-xl text-[10px] font-mono pointer-events-none transform -translate-x-1/2 flex items-center gap-2 border ${
                        hoveredDriftProfile.profile.severity === 'high'
                          ? 'border-rose-500/70'
                          : 'border-amber-500/70'
                      }`}
                      style={{ left: `${hoveredDriftProfile.x}px` }}
                    >
                      <Flame
                        className={`w-3 h-3 ${
                          hoveredDriftProfile.profile.severity === 'high'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      />
                      <span className="font-bold">
                        SEG #{hoveredDriftProfile.profile.segment.segmentIndex}
                      </span>
                      <span className="text-neutral-500">|</span>
                      <span
                        className={
                          hoveredDriftProfile.profile.severity === 'high'
                            ? 'text-rose-300 font-bold'
                            : 'text-amber-300 font-bold'
                        }
                      >
                        Peak:{' '}
                        {hoveredDriftProfile.profile.signedPeakDriftMs > 0
                          ? `+${hoveredDriftProfile.profile.signedPeakDriftMs}ms`
                          : `${hoveredDriftProfile.profile.signedPeakDriftMs}ms`}
                      </span>
                      <span className="text-neutral-500">|</span>
                      <span className="text-neutral-300">
                        Local: ±{hoveredDriftProfile.localDriftMs}ms
                      </span>
                      {hoveredDriftProfile.profile.worstAnchor && (
                        <>
                          <span className="text-neutral-500">|</span>
                          <span className="text-sky-300 truncate max-w-[140px]">
                            {hoveredDriftProfile.profile.worstAnchor.label}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* =========================================================================
                SPLICE CONTINUITY CONNECTOR (In Split Mode)
                Shows visual funnels connecting excised pause regions to conformed seams
               ========================================================================= */}
            {timelineViewMode === 'split' && (
              <div className="relative h-8 bg-neutral-950 border-b border-neutral-800/80 overflow-hidden">
                <svg width={timelineWidth} height={32} className="block absolute inset-0">
                  {/* Draw funnels from raw pause cut regions to conformed splice seams */}
                  {pauseEvents
                    .filter((p) => p.enabled)
                    .map((pause) => {
                      const startRawX = trackStartX + pause.commentaryPauseStartSec * pxPerSec;
                      const endRawX = trackStartX + pause.commentaryResumeSec * pxPerSec;
                      const isSelected = pause.id === selectedPauseId;

                      // Find corresponding seam in conformed preview
                      const seam = spliceSeams.find((s) => s.pauseId === pause.id);
                      const seamX = seam ? trackStartX + seam.filmTimestampSec * pxPerSec : startRawX;

                      return (
                        <g key={`connector-${pause.id}`}>
                          {/* Funnel Polygon (Collapsing cut time into splice seam) */}
                          <polygon
                            points={`${startRawX},0 ${endRawX},0 ${seamX + 2},32 ${seamX - 2},32`}
                            fill={isSelected ? 'rgba(245, 158, 11, 0.35)' : 'rgba(56, 189, 248, 0.15)'}
                            stroke={isSelected ? '#f59e0b' : 'rgba(56, 189, 248, 0.4)'}
                            strokeWidth={isSelected ? 1.5 : 0.8}
                            className="cursor-pointer transition-colors"
                            onClick={() => {
                              onSelectPause(pause.id);
                              if (onPreviewSplice) onPreviewSplice(pause);
                            }}
                          />
                          {/* Scissors Glyph at seam junction */}
                          <circle
                            cx={seamX}
                            cy={16}
                            r={isSelected ? 5 : 4}
                            fill={isSelected ? '#f59e0b' : '#0284c7'}
                            className="cursor-pointer"
                            onClick={() => {
                              onSelectPause(pause.id);
                              if (onPreviewSplice) onPreviewSplice(pause);
                            }}
                          />
                        </g>
                      );
                    })}
                </svg>

                {/* Center status prompt */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[9.5px] font-mono text-neutral-400">
                  <span className="bg-neutral-900/90 px-2.5 py-0.5 rounded border border-neutral-800/80 shadow-xs flex items-center gap-1.5">
                    <Scissors className="w-2.5 h-2.5 text-amber-400" />
                    <span>SPLICE ALIGNMENT BUS · Cut Excisions Funnel to Continuous Seams</span>
                  </span>
                </div>
              </div>
            )}

            {/* =========================================================================
                TRACK 2: CONFORMED BD PREVIEW (POST-SPLICE AUDIO)
               ========================================================================= */}
            {(timelineViewMode === 'split' || timelineViewMode === 'preview') && (
              <div className="relative group">
                {/* Track 2 Label Overlay Header */}
                <div className="sticky left-0 z-20 flex items-center justify-between px-5 py-2 bg-neutral-950/85 backdrop-blur-xs border-b border-neutral-800/40 text-[10.5px]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-semibold text-[9px] border border-cyan-500/30">
                      TRK 2
                    </span>
                    <span className="font-semibold text-neutral-200 tracking-wide">
                      CONFORMED BD PREVIEW
                    </span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-cyan-400/90 font-mono">
                      Spliced Runtime: {formatSMPTE(totalConformedSec, frameRate)}
                    </span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-neutral-400 font-mono">
                      {spliceSeams.length} continuous splices
                    </span>
                    <span className="text-neutral-500">·</span>
                    <span className="text-emerald-400 font-mono">
                      Continuous Sync ({playbackMode === 'synced' ? 'Auditioning Seamlessly' : 'Linear Master'})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 font-mono text-[10px] text-neutral-400">
                    <span className="text-neutral-500">Film TC:</span>
                    <span className="text-cyan-400 font-bold">{formatSMPTE(currentFilmSec, frameRate)}</span>
                  </div>
                </div>

                {/* Conformed Preview Waveform Canvas */}
                <div
                  onMouseDown={handlePreviewTrackClick}
                  onMouseMove={handleMouseMovePreview}
                  onMouseLeave={() => {
                    setHoveredSeam(null);
                    setHoveredDriftProfile(null);
                  }}
                  className="relative"
                >
                  <canvas ref={previewCanvasRef} className="block w-full" />

                  {/* Conformed Film Playhead (Cyan Needle with Diamond Head) */}
                  <div
                    className="absolute top-0 bottom-0 pointer-events-none z-30"
                    style={{
                      left: `${playheadPreviewX}px`,
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div className="w-2.5 h-2.5 bg-cyan-400 transform rotate-45 -mt-1 mx-auto shadow-md" />
                    <div className="w-[1.5px] h-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.9)] mx-auto" />
                  </div>

                  {/* Hover Seam Tooltip HUD */}
                  {hoveredSeam && (
                    <div
                      className="absolute top-2 z-40 bg-neutral-900/95 text-neutral-200 border border-cyan-500/50 rounded px-2.5 py-1.5 shadow-xl text-[10px] font-mono pointer-events-none transform -translate-x-1/2 flex items-center gap-2"
                      style={{ left: `${trackStartX + hoveredSeam.filmTimestampSec * pxPerSec}px` }}
                    >
                      <Scissors className="w-3 h-3 text-cyan-400" />
                      <span>SEAM #{hoveredSeam.index}</span>
                      <span className="text-neutral-500">|</span>
                      <span className="text-cyan-300">-{hoveredSeam.durationCutSec.toFixed(1)}s cut</span>
                      <span className="text-neutral-500">|</span>
                      <span className="text-amber-300">{hoveredSeam.crossfadeMs}ms XFade</span>
                      <span className="text-emerald-400 font-semibold">Click to Audition</span>
                    </div>
                  )}

                  {/* Hover Drift Heat-Map Telemetry HUD on Preview Track */}
                  {hoveredDriftProfile && hoveredDriftProfile.track === 'preview' && !hoveredSeam && (
                    <div
                      className={`absolute top-2 z-40 bg-neutral-900/95 text-neutral-200 rounded px-2.5 py-1.5 shadow-xl text-[10px] font-mono pointer-events-none transform -translate-x-1/2 flex items-center gap-2 border ${
                        hoveredDriftProfile.profile.severity === 'high'
                          ? 'border-rose-500/70'
                          : 'border-amber-500/70'
                      }`}
                      style={{ left: `${hoveredDriftProfile.x}px` }}
                    >
                      <Flame
                        className={`w-3 h-3 ${
                          hoveredDriftProfile.profile.severity === 'high'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      />
                      <span className="font-bold">
                        CONFORMED SEG #{hoveredDriftProfile.profile.segment.segmentIndex}
                      </span>
                      <span className="text-neutral-500">|</span>
                      <span
                        className={
                          hoveredDriftProfile.profile.severity === 'high'
                            ? 'text-rose-300 font-bold'
                            : 'text-amber-300 font-bold'
                        }
                      >
                        Peak Drift:{' '}
                        {hoveredDriftProfile.profile.signedPeakDriftMs > 0
                          ? `+${hoveredDriftProfile.profile.signedPeakDriftMs}ms`
                          : `${hoveredDriftProfile.profile.signedPeakDriftMs}ms`}
                      </span>
                      <span className="text-neutral-500">|</span>
                      <span className="text-neutral-300">
                        Local: ±{hoveredDriftProfile.localDriftMs}ms
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Continuity Legend & Quick Tips Footer */}
      <div className="flex flex-wrap items-center justify-between px-6 sm:px-8 py-3.5 bg-neutral-950 border-t border-neutral-900 text-[10.5px] text-neutral-400 gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-500/30 border border-amber-500 rounded-xs" />
            <span>Master Cut Region (Excised Tape Audio)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-cyan-500/30 border border-cyan-400 rounded-xs" />
            <span>Conformed BD Audio (Post-Splice Waveform)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-sky-500 border border-sky-300 rounded-full" />
            <span>Crossfade Seam (Seamless Audio Transition)</span>
          </div>
          {showDriftHeatMap && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-rose-500/40 border border-rose-500 rounded-xs" />
              <span>Drift Heat-Map Hotspot (High Anchor Deviation)</span>
            </div>
          )}
        </div>

        <div className="text-neutral-500 font-mono text-[10px]">
          Click Track 1 to scrub Master Tape · Click Track 2 to scrub Conformed Film · Click Hotspots to Audit Drift
        </div>
      </div>
    </div>
  );
};

