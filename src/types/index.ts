export * from './movie';

export type FrameRate = 23.976 | 24 | 25 | 29.97;

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export type AmbiguityType =
  | 'false_start'
  | 'chaotic_start_stop'
  | 'mid_sentence_cut'
  | 'overlapping_dialogue'
  | 'ambiguous_countdown'
  | 'none';

export interface PauseEvent {
  id: string;
  commentaryPauseStartSec: number;
  commentaryResumeSec: number;
  durationCutSec: number;
  filmTimestampSec: number;
  triggerPhrase: string;
  resumePhrase: string;
  confidence: ConfidenceLevel;
  confidenceScore?: number;
  ambiguityType?: AmbiguityType;
  contextualWarning?: string;
  isUserVerified?: boolean;
  reason: string;
  enabled: boolean;
  crossfadeMs: number;
  filmId?: string;
}

export interface AnchorPoint {
  id: string;
  commentarySec: number;
  filmSec: number;
  label: string;
  type: 'title_card' | 'dialogue_match' | 'scene_cut' | 'music_cue' | 'manual_sync' | 'visual_cue';
  driftMs: number;
  filmId?: string;
}

export interface AudioSegment {
  segmentIndex: number;
  rawCommentaryStartSec: number;
  rawCommentaryEndSec: number;
  targetFilmStartSec: number;
  targetFilmEndSec: number;
  durationSec: number;
  notes?: string;
  filmId?: string;
}

export interface InitialSyncInfo {
  commentaryStartSec: number;
  filmStartSec: number;
  cuePhrase: string;
  preRollAction: string;
}

export interface SyncSummary {
  totalRawDurationSec: number;
  totalCutSec: number;
  finalSyncedDurationSec: number;
  pauseCount: number;
  conformityStatus: 'in-sync' | 'minor-drift' | 'needs-review' | 'needs-manual-review';
  engineerNotes: string;
}

export interface VideoSourceInfo {
  fileName: string;
  fileSize?: number;
  fileType: string;
  url?: string;
  width: number;
  height: number;
  fps: number;
  isZoomWebcam: boolean;
  isSimulated?: boolean;
}

export interface FilmSegment {
  id: string;
  sequenceIndex: number;
  title: string;
  director?: string;
  genres?: string[];
  releaseYear?: number;
  discLabel?: string;
  filmDurationSec: number;
  frameRate: FrameRate;
  rawRange: {
    startSec: number;
    endSec: number;
  };
  intermissionBeforeSec?: number;
  intermissionNote?: string;
  initialSync: InitialSyncInfo;
  pauseEvents: PauseEvent[];
  anchorPoints: AnchorPoint[];
  segmentsToKeep: AudioSegment[];
  summary: SyncSummary;
  commentaryTranscript?: string;
  filmDialogueOrCues?: string;
}

export interface ProjectData {
  id: string;
  title: string;
  director?: string;
  genres?: string[];
  releaseYear?: number;
  audioFileName?: string;
  videoSource?: VideoSourceInfo;
  filmDurationSec: number;
  frameRate: FrameRate;
  isMultiFilm?: boolean;
  activeFilmId?: string;
  films?: FilmSegment[];
  initialSync: InitialSyncInfo;
  pauseEvents: PauseEvent[];
  anchorPoints: AnchorPoint[];
  segmentsToKeep: AudioSegment[];
  summary: SyncSummary;
  commentaryTranscript: string;
  filmDialogueOrCues: string;
}


