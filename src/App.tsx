import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ShieldAlert, ChevronRight } from 'lucide-react';
import { SAMPLE_PROJECTS } from './data/sampleProjects';
import { AnchorPoint, AudioSegment, FilmSegment, FrameRate, PauseEvent, ProjectData, SyncSummary } from './types';
import { TopNav } from './components/TopNav';
import { TimecodeBar } from './components/TimecodeBar';
import { FilmSegmentBar } from './components/FilmSegmentBar';
import { WaveformTimeline } from './components/WaveformTimeline';
import { PauseEventList } from './components/PauseEventList';
import { ContextualReviewSection } from './components/ContextualReviewSection';
import { AnchorPointsList } from './components/AnchorPointsList';
import { TranscriptView } from './components/TranscriptView';
import { ZoomWebcamMonitor } from './components/ZoomWebcamMonitor';
import { ExportModal } from './components/ExportModal';
import { AnalyzeModal } from './components/AnalyzeModal';
import { ProjectSelectModal } from './components/ProjectSelectModal';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { OfflineIndicator } from './components/PWAInstallButton';
import {
  getAudioContext,
  extractPeaks,
  generateSyntheticCommentary,
  renderSyncedAudioBuffer,
} from './utils/audioSynthesizer';
import { audioBufferToWavBlob } from './utils/wavEncoder';
import { formatSMPTE } from './utils/timecode';
import { runLocalSyncAnalysis, computeSegmentsAndSummary } from './utils/localSyncEngine';

function recomputeFilmMetrics(film: FilmSegment): FilmSegment {
  const { reconciledPauses, segmentsToKeep, summary } = computeSegmentsAndSummary({
    pauses: film.pauseEvents,
    initialStartSec: film.initialSync.commentaryStartSec,
    rawStartSec: film.rawRange.startSec,
    rawEndSec: film.rawRange.endSec,
    frameRate: film.frameRate,
    existingSummary: film.summary,
    engineerNotes: film.summary.engineerNotes,
    filmId: film.id,
  });
  return {
    ...film,
    pauseEvents: reconciledPauses,
    segmentsToKeep,
    summary,
  };
}

function recomputeProjectMetrics(proj: ProjectData): ProjectData {
  const { reconciledPauses, segmentsToKeep, summary } = computeSegmentsAndSummary({
    pauses: proj.pauseEvents,
    initialStartSec: proj.initialSync.commentaryStartSec,
    rawStartSec: 0,
    rawEndSec: proj.summary.totalRawDurationSec,
    frameRate: proj.frameRate,
    existingSummary: proj.summary,
    engineerNotes: proj.summary.engineerNotes,
  });
  return {
    ...proj,
    pauseEvents: reconciledPauses,
    segmentsToKeep,
    summary,
  };
}

function syncMultiFilmProjectSummary(proj: ProjectData, updatedFilms: FilmSegment[]): ProjectData {
  const totalCutSec = Math.round(updatedFilms.reduce((acc, f) => acc + f.summary.totalCutSec, 0) * 1000) / 1000;
  const pauseCount = updatedFilms.reduce((acc, f) => acc + f.summary.pauseCount, 0);
  const finalSyncedDurationSec = Math.max(
    0,
    Math.round((proj.summary.totalRawDurationSec - totalCutSec) * 1000) / 1000
  );
  const hasNeedsReview = updatedFilms.some(
    (f) => f.summary.conformityStatus === 'needs-manual-review' || f.summary.conformityStatus === 'needs-review'
  );
  const hasMinorDrift = updatedFilms.some((f) => f.summary.conformityStatus === 'minor-drift');
  const conformityStatus: SyncSummary['conformityStatus'] = hasNeedsReview
    ? 'needs-manual-review'
    : hasMinorDrift
    ? 'minor-drift'
    : 'in-sync';

  return {
    ...proj,
    films: updatedFilms,
    summary: {
      ...proj.summary,
      totalCutSec,
      finalSyncedDurationSec,
      pauseCount,
      conformityStatus,
    },
  };
}

export default function App() {
  // Current active project state
  const [project, setProject] = useState<ProjectData>(SAMPLE_PROJECTS[0]);
  const [activeFilmId, setActiveFilmId] = useState<string>(
    SAMPLE_PROJECTS[0].films?.[0]?.id || 'film-1'
  );
  const [currentView, setCurrentView] = useState<'pauses' | 'anchors' | 'transcript' | 'review'>('pauses');
  const [isVideoMonitorOpen, setIsVideoMonitorOpen] = useState(true);

  // Modals state
  const [isAnalyzeOpen, setIsAnalyzeOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isProjectSelectOpen, setIsProjectSelectOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);

  // Playback & Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'synced' | 'raw'>('synced');
  const [currentCommentarySec, setCurrentCommentarySec] = useState<number>(project.initialSync.commentaryStartSec);
  const [volume, setVolume] = useState<number>(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [selectedPauseId, setSelectedPauseId] = useState<string | null>(project.pauseEvents[0]?.id || null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  // AI & Processing state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isExportingAudio, setIsExportingAudio] = useState(false);
  const [activeSplicePreview, setActiveSplicePreview] = useState<{ pause: PauseEvent; endAtSec: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

  const toastTimerRef = useRef<number | null>(null);
  const hasCustomAudioRef = useRef<boolean>(false);

  const showToast = useCallback((message: string, type: 'info' | 'error' | 'success' = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr));
      toastTimerRef.current = null;
    }, 4500);
  }, []);

  // Resolve active film segment (for sequential multi-film projects)
  const activeFilm: FilmSegment | null = useMemo(() => {
    if (project.isMultiFilm && project.films && project.films.length > 0) {
      return project.films.find((f) => f.id === activeFilmId) || project.films[0];
    }
    return null;
  }, [project, activeFilmId]);

  // Web Audio Buffers and Graph refs
  const rawAudioBufferRef = useRef<AudioBuffer | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const startTimeRef = useRef<number>(0);
  const offsetRef = useRef<number>(project.initialSync.commentaryStartSec);
  const animationFrameRef = useRef<number | null>(null);
  const videoObjectUrlRef = useRef<string | null>(null);

  // Active pauses and anchors based on current film
  const currentPauses = useMemo(() => {
    return activeFilm ? activeFilm.pauseEvents : project.pauseEvents;
  }, [activeFilm, project.pauseEvents]);

  // Refs for real-time audio loop access without stale closures
  const activeSplicePreviewRef = useRef<{ pause: PauseEvent; endAtSec: number } | null>(null);
  const playbackModeRef = useRef<'synced' | 'raw'>(playbackMode);
  const currentPausesRef = useRef<PauseEvent[]>(currentPauses);

  useEffect(() => {
    playbackModeRef.current = playbackMode;
  }, [playbackMode]);

  useEffect(() => {
    currentPausesRef.current = currentPauses;
  }, [currentPauses]);

  useEffect(() => {
    activeSplicePreviewRef.current = activeSplicePreview;
  }, [activeSplicePreview]);

  useEffect(() => {
    return () => {
      if (videoObjectUrlRef.current) {
        URL.revokeObjectURL(videoObjectUrlRef.current);
        videoObjectUrlRef.current = null;
      }
      if (audioSourceRef.current) {
        try {
          audioSourceRef.current.stop();
          audioSourceRef.current.disconnect();
        } catch {
          // Ignore cleanup errors
        }
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const unverifiedCutCount = useMemo(() => {
    return currentPauses.filter(
      (p) => (p.confidence === 'low' || p.confidence === 'medium') && !p.isUserVerified
    ).length;
  }, [currentPauses]);

  const currentAnchors = useMemo(() => {
    return activeFilm ? activeFilm.anchorPoints : project.anchorPoints;
  }, [activeFilm, project.anchorPoints]);

  const currentInitialSync = useMemo(() => {
    return activeFilm ? activeFilm.initialSync : project.initialSync;
  }, [activeFilm, project.initialSync]);

  const currentFrameRate = useMemo(() => {
    return activeFilm ? activeFilm.frameRate : project.frameRate;
  }, [activeFilm, project.frameRate]);

  // Derive segments to keep from active pauses for current film
  const computedSegments = useMemo(() => {
    const rawStart = activeFilm ? activeFilm.rawRange.startSec : 0;
    const totalEnd = activeFilm ? activeFilm.rawRange.endSec : project.summary.totalRawDurationSec;
    return computeSegmentsAndSummary({
      pauses: currentPauses,
      initialStartSec: currentInitialSync.commentaryStartSec,
      rawStartSec: rawStart,
      rawEndSec: totalEnd,
      frameRate: currentFrameRate,
      filmId: activeFilm?.id,
    }).segmentsToKeep;
  }, [activeFilm, currentPauses, currentInitialSync, currentFrameRate, project.summary.totalRawDurationSec]);

  // Derive current Film timecode and Intermission state
  const { currentFilmSec, isIntermission } = useMemo(() => {
    // Check if playhead is in an intermission between films
    if (project.isMultiFilm && project.films && project.films.length > 1) {
      for (let i = 0; i < project.films.length - 1; i++) {
        const interStart = project.films[i].rawRange.endSec;
        const interEnd = project.films[i + 1].rawRange.startSec;
        if (interEnd > interStart && currentCommentarySec >= interStart && currentCommentarySec <= interEnd) {
          return { currentFilmSec: 0, isIntermission: true };
        }
      }
    }

    const initStart = currentInitialSync.commentaryStartSec;

    if (playbackMode === 'raw') {
      return {
        currentFilmSec: Math.max(0, currentCommentarySec - initStart),
        isIntermission: false,
      };
    }

    // Synced mode
    const matchedSeg = computedSegments.find(
      (s) => currentCommentarySec >= s.rawCommentaryStartSec && currentCommentarySec <= s.rawCommentaryEndSec
    );
    if (matchedSeg) {
      const offsetInSeg = currentCommentarySec - matchedSeg.rawCommentaryStartSec;
      return {
        currentFilmSec: matchedSeg.targetFilmStartSec + offsetInSeg,
        isIntermission: false,
      };
    }

    const inPause = currentPauses.find(
      (p) => p.enabled && currentCommentarySec >= p.commentaryPauseStartSec && currentCommentarySec <= p.commentaryResumeSec
    );
    if (inPause) {
      return {
        currentFilmSec: inPause.filmTimestampSec,
        isIntermission: false,
      };
    }

    return {
      currentFilmSec: Math.max(0, currentCommentarySec - initStart),
      isIntermission: false,
    };
  }, [currentCommentarySec, playbackMode, computedSegments, currentInitialSync, currentPauses, project]);

  // Check if playhead is currently inside a pause region
  const activePauseNotice = useMemo(() => {
    const inPause = currentPauses.find(
      (p) => currentCommentarySec >= p.commentaryPauseStartSec && currentCommentarySec <= p.commentaryResumeSec
    );
    if (inPause) {
      return inPause.enabled
        ? `In Cut Region: -${inPause.durationCutSec.toFixed(1)}s "${inPause.triggerPhrase}"`
        : `Bypassed Pause: "${inPause.triggerPhrase}"`;
    }
    return null;
  }, [currentCommentarySec, currentPauses]);

  // Generate synthetic commentary buffer when switching projects (skip if user uploaded a custom audio/video file)
  useEffect(() => {
    if (hasCustomAudioRef.current) {
      return;
    }
    const allPauses = project.films && project.films.length > 0
      ? project.films.flatMap((f) => f.pauseEvents)
      : project.pauseEvents;

    const buffer = generateSyntheticCommentary(
      project.summary.totalRawDurationSec,
      allPauses,
      project.initialSync.commentaryStartSec
    );
    rawAudioBufferRef.current = buffer;
    setPeaks(extractPeaks(buffer, 1200));

    const startSec = activeFilm ? activeFilm.initialSync.commentaryStartSec : project.initialSync.commentaryStartSec;
    offsetRef.current = startSec;
    setCurrentCommentarySec(startSec);
  }, [project.id, project.summary.totalRawDurationSec]);

  // Update volume gain node
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Audio Playback Engine using Web Audio API
  const stopAudio = useCallback((keepSplicePreview = false) => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch (e) {
        // Ignored
      }
      audioSourceRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setIsPlaying(false);
    if (!keepSplicePreview) {
      activeSplicePreviewRef.current = null;
      setActiveSplicePreview(null);
    }
  }, []);

  const playAudioAt = useCallback(
    (startSec: number, keepSplicePreview = false) => {
      const buffer = rawAudioBufferRef.current;
      if (!buffer) return;

      const ctx = getAudioContext();
      stopAudio(keepSplicePreview);

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.value = isMuted ? 0 : volume;
      gainNodeRef.current = gain;

      source.connect(gain);
      gain.connect(ctx.destination);

      const boundedStart = Math.max(0, Math.min(buffer.duration - 0.05, startSec));
      startTimeRef.current = ctx.currentTime - boundedStart;
      offsetRef.current = boundedStart;

      source.start(0, boundedStart);
      audioSourceRef.current = source;
      setIsPlaying(true);

      const updateLoop = () => {
        if (!audioSourceRef.current) return;
        const currentPlayTime = ctx.currentTime - startTimeRef.current;

        if (currentPlayTime >= buffer.duration) {
          stopAudio(false);
          setCurrentCommentarySec(buffer.duration);
          return;
        }

        // Splice Audition cutoff check
        const splicePreview = activeSplicePreviewRef.current;
        if (splicePreview && currentPlayTime >= splicePreview.endAtSec) {
          stopAudio(false);
          showToast(`Finished splice audition for: "${splicePreview.pause.triggerPhrase}"`, 'success');
          return;
        }

        // Automatic skip over excised pauses in synced mode
        if (playbackModeRef.current === 'synced') {
          for (const pause of currentPausesRef.current) {
            if (
              pause.enabled &&
              currentPlayTime >= pause.commentaryPauseStartSec &&
              currentPlayTime < pause.commentaryResumeSec
            ) {
              const jumpTarget = pause.commentaryResumeSec + 0.02;
              playAudioAt(jumpTarget, true);
              return;
            }
          }
        }

        setCurrentCommentarySec(currentPlayTime);
        animationFrameRef.current = requestAnimationFrame(updateLoop);
      };

      animationFrameRef.current = requestAnimationFrame(updateLoop);
    },
    [volume, isMuted, stopAudio, showToast]
  );

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stopAudio(false);
    } else {
      playAudioAt(currentCommentarySec, false);
    }
  }, [isPlaying, currentCommentarySec, playAudioAt, stopAudio]);

  const handleSeek = useCallback(
    (sec: number) => {
      const bounded = Math.max(0, Math.min(project.summary.totalRawDurationSec, sec));
      setCurrentCommentarySec(bounded);
      offsetRef.current = bounded;
      if (isPlaying) {
        playAudioAt(bounded, Boolean(activeSplicePreviewRef.current));
      }
    },
    [isPlaying, project.summary.totalRawDurationSec, playAudioAt]
  );

  // Switch Active Film Segment
  const handleSelectFilm = useCallback(
    (filmId: string) => {
      setActiveFilmId(filmId);
      const film = project.films?.find((f) => f.id === filmId);
      if (film) {
        handleSeek(film.initialSync.commentaryStartSec);
        setSelectedPauseId(film.pauseEvents[0]?.id || null);
        showToast(`Active Film: ${film.title} (${film.discLabel || `Disc ${film.sequenceIndex}`})`, 'info');
      }
    },
    [project.films, handleSeek, showToast]
  );

  // Jump to film count-in
  const handleJumpToFilmStart = useCallback(
    (filmId: string) => {
      const film = project.films?.find((f) => f.id === filmId);
      if (film) {
        setActiveFilmId(filmId);
        handleSeek(film.initialSync.commentaryStartSec);
        showToast(`Jumped to ${film.title} count-in (${film.initialSync.cuePhrase})`, 'info');
      }
    },
    [project.films, handleSeek, showToast]
  );

  // Update Film Segment properties
  const handleUpdateFilmSegment = useCallback(
    (filmId: string, updates: Partial<FilmSegment>) => {
      setProject((prev) => {
        if (!prev.films) return prev;
        const updatedFilms = prev.films.map((f) =>
          f.id === filmId ? recomputeFilmMetrics({ ...f, ...updates }) : f
        );
        return syncMultiFilmProjectSummary(prev, updatedFilms);
      });
      showToast('Film segment parameters updated.', 'success');
    },
    [showToast]
  );

  // Split master recording into a new sequential film at playhead
  const handleSplitFilmAtPlayhead = useCallback(() => {
    const splitPoint = Math.round(currentCommentarySec);

    if (!project.films || project.films.length === 0) {
      const film1Raw: FilmSegment = {
        id: 'film-1',
        sequenceIndex: 1,
        title: `${project.title} - Feature 1`,
        discLabel: 'Disc 1',
        filmDurationSec: Math.max(60, splitPoint),
        frameRate: project.frameRate,
        rawRange: { startSec: 0, endSec: splitPoint },
        initialSync: project.initialSync,
        pauseEvents: project.pauseEvents.filter((p) => p.commentaryPauseStartSec < splitPoint),
        anchorPoints: project.anchorPoints.filter((a) => a.commentarySec < splitPoint),
        segmentsToKeep: [],
        summary: { ...project.summary, totalRawDurationSec: splitPoint },
        commentaryTranscript: project.commentaryTranscript,
        filmDialogueOrCues: project.filmDialogueOrCues,
      };

      const film2Raw: FilmSegment = {
        id: 'film-2',
        sequenceIndex: 2,
        title: `${project.title} - Feature 2`,
        discLabel: 'Disc 2',
        filmDurationSec: Math.max(60, project.summary.totalRawDurationSec - splitPoint),
        frameRate: project.frameRate,
        rawRange: { startSec: splitPoint, endSec: project.summary.totalRawDurationSec },
        initialSync: {
          commentaryStartSec: Math.min(project.summary.totalRawDurationSec, splitPoint + 10),
          filmStartSec: 0,
          cuePhrase: 'Part 2 count-in: 3, 2, 1, play!',
          preRollAction: 'Trim 10s pre-roll',
        },
        pauseEvents: project.pauseEvents.filter((p) => p.commentaryPauseStartSec >= splitPoint),
        anchorPoints: project.anchorPoints.filter((a) => a.commentarySec >= splitPoint),
        segmentsToKeep: [],
        summary: {
          totalRawDurationSec: project.summary.totalRawDurationSec - splitPoint,
          totalCutSec: 0,
          finalSyncedDurationSec: project.summary.totalRawDurationSec - splitPoint,
          pauseCount: 0,
          conformityStatus: 'in-sync',
          engineerNotes: 'Feature 2 split from master tape.',
        },
      };

      const film1 = recomputeFilmMetrics(film1Raw);
      const film2 = recomputeFilmMetrics(film2Raw);

      setProject((prev) => ({
        ...prev,
        isMultiFilm: true,
        films: [film1, film2],
      }));
      setActiveFilmId('film-2');
      showToast(`Master tape split into 2 sequential film segments at ${formatSMPTE(splitPoint, project.frameRate)}!`, 'success');
      return;
    }

    const target = activeFilm || project.films[0];
    if (splitPoint <= target.rawRange.startSec + 20 || splitPoint >= target.rawRange.endSec - 20) {
      showToast('Playhead must be at least 20 seconds inside a film segment to split.', 'error');
      return;
    }

    const updatedTarget = recomputeFilmMetrics({
      ...target,
      rawRange: { ...target.rawRange, endSec: splitPoint },
      filmDurationSec: Math.max(60, splitPoint - target.rawRange.startSec),
      pauseEvents: target.pauseEvents.filter((p) => p.commentaryPauseStartSec < splitPoint),
      anchorPoints: target.anchorPoints.filter((a) => a.commentarySec < splitPoint),
    });

    const newIndex = project.films.length + 1;
    const newFilm = recomputeFilmMetrics({
      id: `film-${Date.now()}`,
      sequenceIndex: newIndex,
      title: `Film ${newIndex}: Sequel / Next Feature`,
      discLabel: `Disc ${newIndex}`,
      filmDurationSec: Math.max(60, target.rawRange.endSec - splitPoint),
      frameRate: target.frameRate,
      rawRange: { startSec: splitPoint, endSec: target.rawRange.endSec },
      initialSync: {
        commentaryStartSec: Math.min(target.rawRange.endSec, splitPoint + 10),
        filmStartSec: 0,
        cuePhrase: 'Disc count-in: 3, 2, 1, play!',
        preRollAction: 'Trim 10s pre-roll',
      },
      pauseEvents: target.pauseEvents.filter((p) => p.commentaryPauseStartSec >= splitPoint),
      anchorPoints: target.anchorPoints.filter((a) => a.commentarySec >= splitPoint),
      segmentsToKeep: [],
      summary: {
        totalRawDurationSec: target.rawRange.endSec - splitPoint,
        totalCutSec: 0,
        finalSyncedDurationSec: target.rawRange.endSec - splitPoint,
        pauseCount: 0,
        conformityStatus: 'in-sync',
        engineerNotes: `Feature split at ${formatSMPTE(splitPoint, target.frameRate)}.`,
      },
    });

    const newFilms = project.films
      .flatMap((f) => (f.id === target.id ? [updatedTarget, newFilm] : [f]))
      .map((f, i) => ({ ...f, sequenceIndex: i + 1 }));

    setProject((prev) => ({
      ...prev,
      films: newFilms,
    }));
    setActiveFilmId(newFilm.id);
    showToast(`Created new sequential film segment starting at ${formatSMPTE(splitPoint, target.frameRate)}!`, 'success');
  }, [currentCommentarySec, project, activeFilm, showToast]);

  // Audition splice point
  const handlePreviewSplice = (pause: PauseEvent) => {
    const auditionStart = Math.max(0, pause.commentaryPauseStartSec - 3.0);
    const auditionEnd = pause.commentaryResumeSec + 3.0;
    const previewObj = { pause, endAtSec: auditionEnd };

    activeSplicePreviewRef.current = previewObj;
    setActiveSplicePreview(previewObj);
    setCurrentCommentarySec(auditionStart);
    offsetRef.current = auditionStart;
    playAudioAt(auditionStart, true);

    showToast(
      `Auditioning cut: -${pause.durationCutSec.toFixed(1)}s ("${pause.triggerPhrase.slice(0, 32)}...")`,
      'info'
    );
  };

  // Jump to prev/next pause cuts
  const handleJumpNextPause = () => {
    const next = currentPauses
      .filter((p) => p.commentaryPauseStartSec > currentCommentarySec + 0.5)
      .sort((a, b) => a.commentaryPauseStartSec - b.commentaryPauseStartSec)[0];
    if (next) {
      handleSeek(next.commentaryPauseStartSec);
      setSelectedPauseId(next.id);
    }
  };

  const handleJumpPrevPause = () => {
    const prev = currentPauses
      .filter((p) => p.commentaryPauseStartSec < currentCommentarySec - 1)
      .sort((a, b) => b.commentaryPauseStartSec - a.commentaryPauseStartSec)[0];
    if (prev) {
      handleSeek(prev.commentaryPauseStartSec);
      setSelectedPauseId(prev.id);
    } else {
      handleSeek(currentInitialSync.commentaryStartSec);
    }
  };

  // Pause event manipulation (aware of active film)
  const handleTogglePause = (id: string) => {
    setProject((prev) => {
      if (activeFilm && prev.films) {
        const updatedFilms = prev.films.map((f) => {
          if (f.id !== activeFilm.id) return f;
          const updatedPauses = f.pauseEvents.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
          return recomputeFilmMetrics({ ...f, pauseEvents: updatedPauses });
        });
        return syncMultiFilmProjectSummary(prev, updatedFilms);
      }

      const updated = prev.pauseEvents.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p));
      return recomputeProjectMetrics({ ...prev, pauseEvents: updated });
    });
  };

  const handleUpdatePause = (id: string, updates: Partial<PauseEvent>) => {
    setProject((prev) => {
      if (activeFilm && prev.films) {
        const updatedFilms = prev.films.map((f) => {
          if (f.id !== activeFilm.id) return f;
          const updatedPauses = f.pauseEvents.map((p) => (p.id === id ? { ...p, ...updates } : p));
          return recomputeFilmMetrics({ ...f, pauseEvents: updatedPauses });
        });
        return syncMultiFilmProjectSummary(prev, updatedFilms);
      }

      const updated = prev.pauseEvents.map((p) => (p.id === id ? { ...p, ...updates } : p));
      return recomputeProjectMetrics({ ...prev, pauseEvents: updated });
    });
  };

  const handleDeletePause = (id: string) => {
    setProject((prev) => {
      if (activeFilm && prev.films) {
        const updatedFilms = prev.films.map((f) => {
          if (f.id !== activeFilm.id) return f;
          const updatedPauses = f.pauseEvents.filter((p) => p.id !== id);
          return recomputeFilmMetrics({ ...f, pauseEvents: updatedPauses });
        });
        return syncMultiFilmProjectSummary(prev, updatedFilms);
      }

      const updated = prev.pauseEvents.filter((p) => p.id !== id);
      return recomputeProjectMetrics({ ...prev, pauseEvents: updated });
    });
  };

  const handleAddManualPause = (timeSec?: number) => {
    const atTime = timeSec !== undefined ? timeSec : currentCommentarySec;
    const newPause: PauseEvent = {
      id: `pause-manual-${Date.now()}`,
      commentaryPauseStartSec: atTime,
      commentaryResumeSec: atTime + 15.0,
      durationCutSec: 15.0,
      filmTimestampSec: currentFilmSec,
      triggerPhrase: 'Manual cut mark at timecode',
      resumePhrase: 'Manual resume cut boundary',
      confidence: 'high',
      reason: 'Manual Blu-ray author splice',
      enabled: true,
      crossfadeMs: 20,
      filmId: activeFilm?.id,
    };

    setProject((prev) => {
      if (activeFilm && prev.films) {
        const updatedFilms = prev.films.map((f) => {
          if (f.id !== activeFilm.id) return f;
          const updated = [...f.pauseEvents, newPause].sort(
            (a, b) => a.commentaryPauseStartSec - b.commentaryPauseStartSec
          );
          return recomputeFilmMetrics({ ...f, pauseEvents: updated });
        });
        return syncMultiFilmProjectSummary(prev, updatedFilms);
      }

      const updated = [...prev.pauseEvents, newPause].sort(
        (a, b) => a.commentaryPauseStartSec - b.commentaryPauseStartSec
      );
      return recomputeProjectMetrics({ ...prev, pauseEvents: updated });
    });
    setSelectedPauseId(newPause.id);
  };

  // Anchor points manipulation
  const handleAddAnchor = (newAnchor: Omit<AnchorPoint, 'id' | 'driftMs'>) => {
    const created: AnchorPoint = {
      ...newAnchor,
      id: `anchor-${Date.now()}`,
      driftMs: 0,
      filmId: activeFilm?.id,
    };

    setProject((prev) => {
      if (activeFilm && prev.films) {
        const updatedFilms = prev.films.map((f) => {
          if (f.id !== activeFilm.id) return f;
          return {
            ...f,
            anchorPoints: [...f.anchorPoints, created].sort((a, b) => a.filmSec - b.filmSec),
          };
        });
        return { ...prev, films: updatedFilms };
      }

      return {
        ...prev,
        anchorPoints: [...prev.anchorPoints, created].sort((a, b) => a.filmSec - b.filmSec),
      };
    });
  };

  const handleDeleteAnchor = (id: string) => {
    setProject((prev) => {
      if (activeFilm && prev.films) {
        const updatedFilms = prev.films.map((f) => {
          if (f.id !== activeFilm.id) return f;
          return {
            ...f,
            anchorPoints: f.anchorPoints.filter((a) => a.id !== id),
          };
        });
        return { ...prev, films: updatedFilms };
      }

      return {
        ...prev,
        anchorPoints: prev.anchorPoints.filter((a) => a.id !== id),
      };
    });
  };

  const handleUpdateAnchorDrift = (id: string, newDriftMs: number) => {
    setProject((prev) => {
      if (activeFilm && prev.films) {
        const updatedFilms = prev.films.map((f) => {
          if (f.id !== activeFilm.id) return f;
          return {
            ...f,
            anchorPoints: f.anchorPoints.map((a) => (a.id === id ? { ...a, driftMs: newDriftMs } : a)),
          };
        });
        return { ...prev, films: updatedFilms };
      }

      return {
        ...prev,
        anchorPoints: prev.anchorPoints.map((a) => (a.id === id ? { ...a, driftMs: newDriftMs } : a)),
      };
    });
  };

  const handleAuditionAnchor = (anchor: AnchorPoint) => {
    const auditionStart = Math.max(0, anchor.commentarySec - 2.5);
    handleSeek(auditionStart);
    if (!isPlaying) {
      playAudioAt(auditionStart, false);
    }
    showToast(
      `Auditioning sync at ${formatSMPTE(anchor.filmSec, currentFrameRate)} (${anchor.driftMs > 0 ? '+' : ''}${anchor.driftMs}ms)`,
      'info'
    );
  };

  // Sync Analysis execution
  const executeAISyncAnalysis = async (params: {
    filmTitle: string;
    frameRate: FrameRate;
    initialOffsetSec: number;
    engineMode?: 'local' | 'cloud';
  }) => {
    setIsAnalyzing(true);
    const mode = params.engineMode || 'local';

    try {
      if (mode === 'local') {
        const localResult = runLocalSyncAnalysis({
          commentaryTranscript: activeFilm?.commentaryTranscript || project.commentaryTranscript,
          filmDialogueOrCues: activeFilm?.filmDialogueOrCues || project.filmDialogueOrCues,
          filmTitle: params.filmTitle,
          frameRate: params.frameRate,
          initialOffsetSec: params.initialOffsetSec,
          filmDurationSec: activeFilm ? activeFilm.filmDurationSec : project.filmDurationSec,
          rawStartSec: activeFilm ? activeFilm.rawRange.startSec : 0,
          rawEndSec: activeFilm ? activeFilm.rawRange.endSec : project.summary.totalRawDurationSec,
        });

        setProject((prev) => {
          if (activeFilm && prev.films) {
            const updatedFilms = prev.films.map((f) => {
              if (f.id !== activeFilm.id) return f;
              return recomputeFilmMetrics({
                ...f,
                title: params.filmTitle,
                frameRate: params.frameRate,
                initialSync: localResult.initialSync,
                pauseEvents: localResult.pauseEvents,
                anchorPoints: localResult.anchorPoints,
                summary: localResult.summary,
              });
            });
            return syncMultiFilmProjectSummary(prev, updatedFilms);
          }

          return recomputeProjectMetrics({
            ...prev,
            title: params.filmTitle,
            frameRate: params.frameRate,
            initialSync: localResult.initialSync,
            pauseEvents: localResult.pauseEvents,
            anchorPoints: localResult.anchorPoints,
            summary: localResult.summary,
          });
        });

        setIsAnalyzeOpen(false);
        showToast(
          `100% Offline Local Engine conformed master (${localResult.pauseEvents.length} pauses detected, zero cloud calls).`,
          'success'
        );
        return;
      }

      // Cloud Gemini AI Execution
      const res = await fetch('/api/analyze-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentaryTranscript: activeFilm?.commentaryTranscript || project.commentaryTranscript,
          filmDialogueOrCues: activeFilm?.filmDialogueOrCues || project.filmDialogueOrCues,
          filmTitle: params.filmTitle,
          frameRate: params.frameRate,
          initialOffsetSec: params.initialOffsetSec,
          filmDurationSec: activeFilm ? activeFilm.filmDurationSec : project.filmDurationSec,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const mappedPauses: PauseEvent[] = (data.pauseEvents || []).map((p: any) => ({
        id: p.id || `pause-${Math.random().toString(36).substring(7)}`,
        commentaryPauseStartSec: p.commentaryPauseStartSec,
        commentaryResumeSec: p.commentaryResumeSec,
        durationCutSec: p.durationCutSec,
        filmTimestampSec: p.filmTimestampSec,
        triggerPhrase: p.triggerPhrase,
        resumePhrase: p.resumePhrase,
        confidence: p.confidence || 'high',
        ambiguityType: p.ambiguityType || (p.confidence === 'low' ? 'chaotic_start_stop' : undefined),
        confidenceScore: p.confidenceScore || (p.confidence === 'low' ? 40 : p.confidence === 'medium' ? 65 : 95),
        contextualWarning: p.contextualWarning,
        isUserVerified: p.confidence === 'high',
        reason: p.reason || 'Contextual pause',
        enabled: true,
        crossfadeMs: 20,
        filmId: activeFilm?.id,
      }));

      const mappedAnchors: AnchorPoint[] = (data.anchorPoints || []).map((a: any) => ({
        id: `anchor-${Math.random().toString(36).substring(7)}`,
        commentarySec: a.commentarySec,
        filmSec: a.filmSec,
        label: a.label,
        type: a.type || 'dialogue_match',
        driftMs: Math.round((Math.random() - 0.5) * 16),
        filmId: activeFilm?.id,
      }));

      setProject((prev) => {
        if (activeFilm && prev.films) {
          const updatedFilms = prev.films.map((f) => {
            if (f.id !== activeFilm.id) return f;
            return recomputeFilmMetrics({
              ...f,
              title: params.filmTitle,
              frameRate: params.frameRate,
              initialSync: {
                ...f.initialSync,
                commentaryStartSec: data.initialSync?.commentaryStartSec ?? params.initialOffsetSec,
                cuePhrase: data.initialSync?.cuePhrase ?? f.initialSync.cuePhrase,
              },
              pauseEvents: mappedPauses.length > 0 ? mappedPauses : f.pauseEvents,
              anchorPoints: mappedAnchors.length > 0 ? mappedAnchors : f.anchorPoints,
            });
          });
          return syncMultiFilmProjectSummary(prev, updatedFilms);
        }

        return recomputeProjectMetrics({
          ...prev,
          title: params.filmTitle,
          frameRate: params.frameRate,
          initialSync: {
            ...prev.initialSync,
            commentaryStartSec: data.initialSync?.commentaryStartSec ?? params.initialOffsetSec,
            cuePhrase: data.initialSync?.cuePhrase ?? prev.initialSync.cuePhrase,
          },
          pauseEvents: mappedPauses.length > 0 ? mappedPauses : prev.pauseEvents,
          anchorPoints: mappedAnchors.length > 0 ? mappedAnchors : prev.anchorPoints,
        });
      });

      setIsAnalyzeOpen(false);
      showToast('Cloud AI sync analysis completed successfully.', 'success');
    } catch (err: any) {
      console.warn('Cloud API issue, fallback to 100% Offline Local Engine:', err);
      const localFallback = runLocalSyncAnalysis({
        commentaryTranscript: activeFilm?.commentaryTranscript || project.commentaryTranscript,
        filmDialogueOrCues: activeFilm?.filmDialogueOrCues || project.filmDialogueOrCues,
        filmTitle: params.filmTitle,
        frameRate: params.frameRate,
        initialOffsetSec: params.initialOffsetSec,
        filmDurationSec: activeFilm ? activeFilm.filmDurationSec : project.filmDurationSec,
        rawStartSec: activeFilm ? activeFilm.rawRange.startSec : 0,
        rawEndSec: activeFilm ? activeFilm.rawRange.endSec : project.summary.totalRawDurationSec,
      });

      setProject((prev) => {
        if (activeFilm && prev.films) {
          const updatedFilms = prev.films.map((f) => {
            if (f.id !== activeFilm.id) return f;
            return recomputeFilmMetrics({
              ...f,
              title: params.filmTitle,
              frameRate: params.frameRate,
              initialSync: localFallback.initialSync,
              pauseEvents: localFallback.pauseEvents,
              anchorPoints: localFallback.anchorPoints,
              summary: localFallback.summary,
            });
          });
          return syncMultiFilmProjectSummary(prev, updatedFilms);
        }

        return recomputeProjectMetrics({
          ...prev,
          title: params.filmTitle,
          frameRate: params.frameRate,
          initialSync: localFallback.initialSync,
          pauseEvents: localFallback.pauseEvents,
          anchorPoints: localFallback.anchorPoints,
          summary: localFallback.summary,
        });
      });

      setIsAnalyzeOpen(false);
      showToast(
        `Engaged 100% Offline Local Engine (${localFallback.pauseEvents.length} pauses detected with zero network).`,
        'success'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Export Synced WAV Audio (single film)
  const handleExportWavAudio = async (targetFilmId?: string) => {
    if (!rawAudioBufferRef.current) return;
    setIsExportingAudio(true);
    try {
      const filmToExport = project.films?.find((f) => f.id === (targetFilmId || activeFilmId)) || activeFilm;
      const segsToKeep = filmToExport ? filmToExport.segmentsToKeep : computedSegments;
      const activeCrossfade = (filmToExport?.pauseEvents || project.pauseEvents).find((p) => p.enabled)?.crossfadeMs ?? 20;

      const renderedBuffer = renderSyncedAudioBuffer(
        rawAudioBufferRef.current,
        segsToKeep,
        activeCrossfade
      );

      const wavBlob = audioBufferToWavBlob(renderedBuffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      const safeTitle = (filmToExport ? filmToExport.title : project.title).toLowerCase().replace(/[^a-z0-9]/g, '_');
      a.download = `${safeTitle}_synced_48khz.wav`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Conformed 48kHz WAV audio exported for ${filmToExport ? filmToExport.title : 'master'}!`, 'success');
    } catch (e) {
      console.error('Audio render failed:', e);
      showToast('Audio render failed. Check audio tracks.', 'error');
    } finally {
      setIsExportingAudio(false);
    }
  };

  // Batch Export All Sequential Films in the master audio file
  const handleBatchExportAllWavs = async () => {
    if (!project.films || project.films.length === 0 || !rawAudioBufferRef.current) return;
    setIsExportingAudio(true);
    try {
      const buffer = rawAudioBufferRef.current;
      for (let i = 0; i < project.films.length; i++) {
        const film = project.films[i];
        const segs = film.segmentsToKeep;
        const xfade = film.pauseEvents.find((p) => p.enabled)?.crossfadeMs ?? 20;
        const rendered = renderSyncedAudioBuffer(buffer, segs, xfade);
        const wavBlob = audioBufferToWavBlob(rendered);
        const url = URL.createObjectURL(wavBlob);
        const a = document.createElement('a');
        a.href = url;
        const safeTitle = film.title.toLowerCase().replace(/[^a-z0-9]/g, '_');
        a.download = `disc${film.sequenceIndex}_${safeTitle}_synced_48khz.wav`;
        a.click();
        URL.revokeObjectURL(url);
        // Brief pause between sequential downloads
        await new Promise((r) => setTimeout(r, 600));
      }
      showToast(`Successfully batch rendered and downloaded all ${project.films.length} film tracks!`, 'success');
    } catch (e) {
      console.error('Batch audio render failed:', e);
      showToast('Batch audio render failed.', 'error');
    } finally {
      setIsExportingAudio(false);
    }
  };

  // Upload user's real video (MP4/MOV/WebM) or audio file (WAV/MP3/M4A)
  const handleUploadAudioFile = async (file: File) => {
    try {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm|mkv)$/i.test(file.name);
      const ctx = getAudioContext();
      const arrayBuffer = await file.arrayBuffer();

      // Web Audio API automatically demuxes and extracts embedded audio from MP4/MOV/WebM containers!
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      hasCustomAudioRef.current = true;
      rawAudioBufferRef.current = decoded;
      setPeaks(extractPeaks(decoded, 1200));

      let videoUrl: string | undefined = undefined;
      if (isVideo) {
        if (videoObjectUrlRef.current) {
          URL.revokeObjectURL(videoObjectUrlRef.current);
        }
        videoUrl = URL.createObjectURL(file);
        videoObjectUrlRef.current = videoUrl;
        setIsVideoMonitorOpen(true);
      }

      setProject((prev) =>
        recomputeProjectMetrics({
          ...prev,
          audioFileName: file.name,
          videoSource: isVideo
            ? {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type || 'video/mp4',
                url: videoUrl,
                width: 1280,
                height: 720,
                fps: 25, // Intended Zoom default
                isZoomWebcam: true,
                isSimulated: false,
              }
            : prev.videoSource,
          summary: {
            ...prev.summary,
            totalRawDurationSec: decoded.duration,
          },
        })
      );

      if (isVideo) {
        showToast(
          `Extracted audio from Zoom video: ${file.name} (${decoded.duration.toFixed(1)}s). Conformed passively to audio master (zero video AI).`,
          'success'
        );
      } else {
        showToast(`Loaded audio file: ${file.name} (${decoded.duration.toFixed(1)}s)`, 'success');
      }
    } catch (e) {
      console.error('Error decoding media file:', e);
      showToast('Could not decode audio from file. Please ensure it is a valid MP4, MOV, WebM, WAV, or MP3 file.', 'error');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }

      // Shift + Left/Right Arrow: Fine-tune selected pause start time by 100ms
      if (e.shiftKey && (e.code === 'ArrowLeft' || e.code === 'ArrowRight')) {
        e.preventDefault();
        if (selectedPauseId) {
          const pause = currentPauses.find((p) => p.id === selectedPauseId);
          if (pause) {
            const deltaSec = e.code === 'ArrowLeft' ? -0.1 : 0.1;
            const newStart = Math.max(
              0,
              Math.min(pause.commentaryResumeSec - 0.2, pause.commentaryPauseStartSec + deltaSec)
            );
            const roundedStart = Math.round(newStart * 1000) / 1000;
            const newDuration = Math.round((pause.commentaryResumeSec - roundedStart) * 1000) / 1000;

            handleUpdatePause(pause.id, {
              commentaryPauseStartSec: roundedStart,
              durationCutSec: newDuration,
            });

            handleSeek(roundedStart);
            showToast(
              `Nudged cut start to ${formatSMPTE(roundedStart, currentFrameRate)} (${deltaSec > 0 ? '+100ms' : '-100ms'})`,
              'info'
            );
          }
        } else {
          showToast('Select a pause cut to fine-tune with Shift + Arrows', 'info');
        }
        return;
      }

      // Shift + ? or / (Question mark): Toggle Keyboard Shortcuts modal
      if (e.key === '?' || (e.shiftKey && e.code === 'Slash')) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setIsShortcutsOpen(false);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(currentCommentarySec - 5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(currentCommentarySec + 5);
      } else if (e.code === 'KeyK') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'KeyJ') {
        e.preventDefault();
        handleSeek(currentCommentarySec - 10);
      } else if (e.code === 'KeyL') {
        e.preventDefault();
        handleSeek(currentCommentarySec + 10);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    currentCommentarySec,
    selectedPauseId,
    currentPauses,
    currentFrameRate,
    handleSeek,
    showToast,
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans">
      {/* Top Navigation */}
      <TopNav
        currentView={currentView}
        onSelectView={setCurrentView}
        onOpenAnalyze={() => setIsAnalyzeOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenProjectSelect={() => setIsProjectSelectOpen(true)}
        projectTitle={project.title}
        isAnalyzing={isAnalyzing}
        pauseCount={currentPauses.length}
        anchorCount={currentAnchors.length}
        frameRate={currentFrameRate}
        unverifiedCutCount={unverifiedCutCount}
        isVideoMonitorOpen={isVideoMonitorOpen}
        onToggleVideoMonitor={() => setIsVideoMonitorOpen(!isVideoMonitorOpen)}
        isMultiFilm={project.isMultiFilm}
        filmCount={project.films?.length}
        activeFilmTitle={activeFilm?.title}
        activeProject={project}
        activeFilmId={activeFilmId}
        onSelectProjectAndFilm={(selectedProj, targetFilmId) => {
          const isSameProject = selectedProj.id === project.id;
          if (!isSameProject) {
            stopAudio(false);
            hasCustomAudioRef.current = false;
            setProject(selectedProj);
          }

          if (targetFilmId && selectedProj.films) {
            const targetFilm = selectedProj.films.find((f) => f.id === targetFilmId) || selectedProj.films[0];
            setActiveFilmId(targetFilm.id);
            setSelectedPauseId(targetFilm.pauseEvents[0]?.id || null);
            if (isSameProject) {
              handleSeek(targetFilm.initialSync.commentaryStartSec);
            } else {
              offsetRef.current = targetFilm.initialSync.commentaryStartSec;
              setCurrentCommentarySec(targetFilm.initialSync.commentaryStartSec);
            }
            showToast(
              `Loaded "${targetFilm.title}" (Dir. ${targetFilm.director || selectedProj.director || 'Unknown'})`,
              'info'
            );
          } else {
            setActiveFilmId(selectedProj.films?.[0]?.id || 'film-1');
            setSelectedPauseId(selectedProj.pauseEvents[0]?.id || null);
            showToast(
              `Loaded "${selectedProj.title}" (Dir. ${selectedProj.director || 'Unknown'})`,
              'info'
            );
          }
        }}
      />

      {/* Persistent SMPTE Timecode & Transport Bar */}
      <TimecodeBar
        currentFilmSec={currentFilmSec}
        currentCommentarySec={currentCommentarySec}
        isPlaying={isPlaying}
        onTogglePlay={togglePlay}
        onRewind={() => handleSeek(currentInitialSync.commentaryStartSec)}
        onJumpPrevPause={handleJumpPrevPause}
        onJumpNextPause={handleJumpNextPause}
        playbackMode={playbackMode}
        onTogglePlaybackMode={setPlaybackMode}
        frameRate={currentFrameRate}
        summary={activeFilm ? activeFilm.summary : project.summary}
        volume={volume}
        onChangeVolume={setVolume}
        isMuted={isMuted}
        onToggleMute={() => setIsMuted(!isMuted)}
        activePauseNotice={activePauseNotice}
        activeFilmTitle={activeFilm?.title}
        activeDiscLabel={activeFilm?.discLabel}
        isIntermission={isIntermission}
      />

      {/* Zoom Webcam Video Monitor (Conformed follower track) */}
      <ZoomWebcamMonitor
        currentCommentarySec={currentCommentarySec}
        isPlaying={isPlaying}
        playbackMode={playbackMode}
        currentPauses={currentPauses}
        frameRate={currentFrameRate}
        videoSource={project.videoSource}
        onUploadVideoFile={handleUploadAudioFile}
        onSeek={handleSeek}
        isOpen={isVideoMonitorOpen}
        onToggleOpen={() => setIsVideoMonitorOpen(!isVideoMonitorOpen)}
        activeFilmTitle={activeFilm?.title || project.title}
      />

      {/* Red Pending Inspection Callout (Positioned between Video Monitor and Sequential Films) */}
      {unverifiedCutCount > 0 && (
        <aside
          role="alert"
          aria-label="Pending Cut Inspection Callout"
          className="bg-rose-950/90 border-b border-rose-800/90 px-6 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs shadow-md transition-all"
        >
          <div className="flex items-center gap-2.5 text-rose-200">
            <span className="flex h-2 w-2 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="font-bold text-white text-[11px] px-1.5 py-0.2 rounded bg-rose-600 shadow-sm">
              Review
            </span>
            <span className="text-rose-100 font-medium">
              {unverifiedCutCount} {unverifiedCutCount === 1 ? 'cut requires' : 'cuts require'} review (ambiguous speech boundaries or false starts).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {currentView !== 'review' ? (
              <button
                onClick={() => setCurrentView('review')}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded text-xs transition-colors flex items-center gap-1 shadow-sm"
              >
                <span>Review Cuts</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <span className="px-2 py-0.5 rounded bg-rose-900/60 text-rose-200 border border-rose-700/60 text-[11px] font-mono font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                Active in Queue
              </span>
            )}
          </div>
        </aside>
      )}

      {/* Sequential Multi-Film Segment Bar (shown when project has multiple films) */}
      {project.isMultiFilm && project.films && project.films.length > 0 && (
        <FilmSegmentBar
          films={project.films}
          activeFilmId={activeFilmId}
          onSelectFilm={handleSelectFilm}
          onAddFilmSegment={() => {}}
          onUpdateFilmSegment={handleUpdateFilmSegment}
          onSplitFilmAtPlayhead={handleSplitFilmAtPlayhead}
          currentPlayheadSec={currentCommentarySec}
          masterDurationSec={project.summary.totalRawDurationSec}
          masterFrameRate={project.frameRate}
          onJumpToFilmStart={handleJumpToFilmStart}
        />
      )}

      {/* Dual Waveform & Cut Zones Interactive Timeline */}
      <WaveformTimeline
        durationSec={project.summary.totalRawDurationSec}
        currentPlayheadSec={currentCommentarySec}
        onSeek={handleSeek}
        pauseEvents={currentPauses}
        anchorPoints={currentAnchors}
        peaks={peaks}
        frameRate={currentFrameRate}
        onSelectPause={(id) => {
          setSelectedPauseId(id);
          const p = currentPauses.find((x) => x.id === id);
          if (p) handleSeek(p.commentaryPauseStartSec);
        }}
        selectedPauseId={selectedPauseId}
        onAddManualPause={handleAddManualPause}
        initialSyncOffsetSec={currentInitialSync.commentaryStartSec}
        films={project.films}
        activeFilmId={activeFilmId}
        onSelectFilm={handleSelectFilm}
        computedSegments={computedSegments}
        currentFilmSec={currentFilmSec}
        playbackMode={playbackMode}
        onPreviewSplice={handlePreviewSplice}
        onTogglePause={handleTogglePause}
        isFineTuning={currentView === 'review'}
      />

      {/* Main Workspace Body */}
      <main className="flex-1 px-6 py-8 sm:px-8 max-w-7xl w-full mx-auto space-y-8">
        {currentView === 'pauses' && (
          <PauseEventList
            pauses={currentPauses}
            frameRate={currentFrameRate}
            selectedPauseId={selectedPauseId}
            onSelectPause={setSelectedPauseId}
            onTogglePause={handleTogglePause}
            onUpdatePause={handleUpdatePause}
            onDeletePause={handleDeletePause}
            onPreviewSplice={handlePreviewSplice}
            onJumpToPause={handleSeek}
            onAddManualPause={handleAddManualPause}
            onOpenReviewQueue={() => setCurrentView('review')}
          />
        )}

        {currentView === 'review' && (
          <ContextualReviewSection
            pauses={currentPauses}
            frameRate={currentFrameRate}
            selectedPauseId={selectedPauseId}
            onSelectPause={(id) => {
              setSelectedPauseId(id);
              const p = currentPauses.find((x) => x.id === id);
              if (p) handleSeek(p.commentaryPauseStartSec);
            }}
            onUpdatePause={handleUpdatePause}
            onTogglePause={handleTogglePause}
            onPreviewSplice={handlePreviewSplice}
            onJumpToTime={handleSeek}
            filmTitle={activeFilm?.title || project.title}
          />
        )}

        {currentView === 'anchors' && (
          <AnchorPointsList
            anchors={currentAnchors}
            frameRate={currentFrameRate}
            onJumpToTime={handleSeek}
            onAddAnchor={handleAddAnchor}
            onUpdateAnchorDrift={handleUpdateAnchorDrift}
            onDeleteAnchor={handleDeleteAnchor}
            onAuditionAnchor={handleAuditionAnchor}
            currentFilmSec={currentFilmSec}
            currentCommentarySec={currentCommentarySec}
          />
        )}

        {currentView === 'transcript' && (
          <TranscriptView
            commentaryTranscript={activeFilm?.commentaryTranscript || project.commentaryTranscript}
            onChangeCommentaryTranscript={(text) => {
              if (activeFilm && project.films) {
                setProject((p) => ({
                  ...p,
                  films: p.films?.map((f) => (f.id === activeFilm.id ? { ...f, commentaryTranscript: text } : f)),
                }));
              } else {
                setProject((p) => ({ ...p, commentaryTranscript: text }));
              }
            }}
            filmDialogueOrCues={activeFilm?.filmDialogueOrCues || project.filmDialogueOrCues}
            onChangeFilmDialogueOrCues={(text) => {
              if (activeFilm && project.films) {
                setProject((p) => ({
                  ...p,
                  films: p.films?.map((f) => (f.id === activeFilm.id ? { ...f, filmDialogueOrCues: text } : f)),
                }));
              } else {
                setProject((p) => ({ ...p, filmDialogueOrCues: text }));
              }
            }}
            onRunAIAnalysis={() => setIsAnalyzeOpen(true)}
            isAnalyzing={isAnalyzing}
            onUploadAudioFile={handleUploadAudioFile}
            audioFileName={project.audioFileName}
            onNotify={showToast}
          />
        )}
      </main>

      {/* Modals */}
      <AnalyzeModal
        isOpen={isAnalyzeOpen}
        onClose={() => setIsAnalyzeOpen(false)}
        onStartAnalysis={executeAISyncAnalysis}
        isAnalyzing={isAnalyzing}
        currentTitle={activeFilm ? activeFilm.title : project.title}
        currentFrameRate={currentFrameRate}
        currentInitialOffsetSec={currentInitialSync.commentaryStartSec}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        project={project}
        activeFilmId={activeFilmId}
        onExportWavAudio={handleExportWavAudio}
        onBatchExportAllWavs={handleBatchExportAllWavs}
        isExportingAudio={isExportingAudio}
      />

      <ProjectSelectModal
        isOpen={isProjectSelectOpen}
        onClose={() => setIsProjectSelectOpen(false)}
        currentProjectId={project.id}
        onSelectProject={(selected) => {
          stopAudio(false);
          hasCustomAudioRef.current = false;
          setProject(selected);
          if (selected.films && selected.films.length > 0) {
            setActiveFilmId(selected.films[0].id);
            setSelectedPauseId(selected.films[0].pauseEvents[0]?.id || null);
          } else {
            setActiveFilmId('film-1');
            setSelectedPauseId(selected.pauseEvents[0]?.id || null);
          }
        }}
        onNewBlankProject={() => {
          stopAudio(false);
          hasCustomAudioRef.current = false;
          const blank: ProjectData = recomputeProjectMetrics({
            id: `proj-${Date.now()}`,
            title: 'New Blu-ray Commentary Session',
            filmDurationSec: 600,
            frameRate: 23.976,
            isMultiFilm: false,
            initialSync: {
              commentaryStartSec: 0,
              filmStartSec: 0,
              cuePhrase: 'Play disc',
              preRollAction: 'Lock to 00:00:00:00',
            },
            pauseEvents: [],
            anchorPoints: [],
            segmentsToKeep: [],
            summary: {
              totalRawDurationSec: 600,
              totalCutSec: 0,
              finalSyncedDurationSec: 600,
              pauseCount: 0,
              conformityStatus: 'in-sync',
              engineerNotes: 'Blank project initialized.',
            },
            commentaryTranscript: '',
            filmDialogueOrCues: '',
          });
          setProject(blank);
          setActiveFilmId('film-1');
          setSelectedPauseId(null);
        }}
      />

      <ProjectSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        project={project}
        activeFilm={activeFilm}
        onUpdateSettings={(updates) =>
          setProject((p) => {
            if (activeFilm && p.films) {
              const updatedFilms = p.films.map((f) =>
                f.id === activeFilm.id
                  ? recomputeFilmMetrics({
                      ...f,
                      director: updates.director !== undefined ? updates.director : f.director,
                      genres: updates.genres !== undefined ? updates.genres : f.genres,
                      frameRate: updates.frameRate ?? f.frameRate,
                      initialSync: updates.initialSync ?? f.initialSync,
                    })
                  : f
              );
              return syncMultiFilmProjectSummary(
                {
                  ...p,
                  title: updates.title ?? p.title,
                  frameRate: updates.frameRate ?? p.frameRate,
                },
                updatedFilms
              );
            }
            return recomputeProjectMetrics({ ...p, ...updates });
          })
        }
      />

      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Offline Connectivity Indicator Banner */}
      <OfflineIndicator />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg border text-xs shadow-xl flex items-center gap-2.5 transition-all ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
              : 'bg-neutral-900 border-neutral-700 text-neutral-200'
          }`}
        >
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="text-neutral-400 hover:text-white text-sm leading-none ml-1"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
