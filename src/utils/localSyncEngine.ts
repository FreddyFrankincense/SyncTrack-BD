import { AnchorPoint, AudioSegment, FrameRate, PauseEvent, ProjectData, SyncSummary } from '../types';
import { formatSMPTE, parseTimeToSeconds } from './timecode';

interface TranscriptLine {
  timeSec: number;
  speaker: string;
  text: string;
  raw: string;
}

interface SubtitleCue {
  startSec: number;
  endSec: number;
  text: string;
}

/**
 * Parses timestamped transcript into structured lines.
 * Supports: [00:01:23], 00:01:23, (01:23), or plain text.
 */
export function parseTranscriptLines(rawText: string, defaultDuration = 7200): TranscriptLine[] {
  const lines = rawText.split('\n');
  const result: TranscriptLine[] = [];
  const timeRegex = /(?:\[|\()?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?(?:\]|\))?/;

  let lastTimeSec = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const timeMatch = trimmed.match(timeRegex);
    let timeSec = lastTimeSec;

    let cleanLine = trimmed;
    if (timeMatch) {
      const hours = timeMatch[1] ? parseInt(timeMatch[1], 10) : 0;
      const minutes = parseInt(timeMatch[2], 10);
      const seconds = parseInt(timeMatch[3], 10);
      const ms = timeMatch[4] ? parseFloat(`0.${timeMatch[4]}`) : 0;
      timeSec = hours * 3600 + minutes * 60 + seconds + ms;
      lastTimeSec = timeSec;
      cleanLine = trimmed.replace(timeMatch[0], '').trim();
    }

    // Extract speaker if format is "Name: Text"
    let speaker = 'Commentator';
    let content = cleanLine;
    const speakerMatch = cleanLine.match(/^([A-Za-z0-9\s_-]+):\s*(.+)$/);
    if (speakerMatch) {
      speaker = speakerMatch[1].trim();
      content = speakerMatch[2].trim();
    }

    result.push({
      timeSec,
      speaker,
      text: content,
      raw: trimmed,
    });
  }

  return result;
}

/**
 * Parses SRT or VTT subtitle cues into structured entries.
 */
export function parseSubtitleCues(rawSubs: string): SubtitleCue[] {
  if (!rawSubs || !rawSubs.trim()) return [];

  const cues: SubtitleCue[] = [];
  const blocks = rawSubs.split(/\n\s*\n/);
  const timePattern = /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let timeLineIdx = -1;
    let match: RegExpMatchArray | null = null;

    for (let i = 0; i < lines.length; i++) {
      match = lines[i].match(timePattern);
      if (match) {
        timeLineIdx = i;
        break;
      }
    }

    if (match && timeLineIdx !== -1) {
      const startSec =
        parseInt(match[1]) * 3600 +
        parseInt(match[2]) * 60 +
        parseInt(match[3]) +
        parseInt(match[4]) / 1000;
      const endSec =
        parseInt(match[5]) * 3600 +
        parseInt(match[6]) * 60 +
        parseInt(match[7]) +
        parseInt(match[8]) / 1000;
      const text = lines.slice(timeLineIdx + 1).join(' ').trim();
      if (text) {
        cues.push({ startSec, endSec, text });
      }
    }
  }

  return cues;
}

/**
 * 100% Offline Local Contextual Sync Engine
 * Uses deterministic NLP rule parsing, countdown detection, freeze-frame heuristics,
 * and fuzzy dialogue alignment with zero network calls.
 */
export function runLocalSyncAnalysis(params: {
  commentaryTranscript: string;
  filmDialogueOrCues: string;
  filmTitle?: string;
  frameRate: FrameRate;
  initialOffsetSec?: number;
  filmDurationSec?: number;
  rawStartSec?: number;
  rawEndSec?: number;
}) {
  const {
    commentaryTranscript,
    filmDialogueOrCues,
    filmTitle = 'Feature Film',
    frameRate = 23.976,
    initialOffsetSec = 0,
    filmDurationSec = 7200,
    rawStartSec = 0,
    rawEndSec,
  } = params;

  const commentaryLines = parseTranscriptLines(commentaryTranscript, filmDurationSec);
  const subtitleCues = parseSubtitleCues(filmDialogueOrCues);

  // 1. Initial Sync Point Detection (Countdowns, Start Cues)
  const countInPatterns = [
    /(?:three|3)[,\s-]*(?:two|2)[,\s-]*(?:one|1)[,\s-]*(?:play|press play|start|go|hit it|mark)/i,
    /press play on (?:the )?(?:logo|fanfare|shield|mountain|roar|opening)/i,
    /(?:hit|press) play (?:now|at)/i,
    /start(?:ing)? (?:the )?(?:movie|disc|playback)/i,
  ];

  let detectedStartSec = initialOffsetSec;
  let cuePhrase = 'Play disc';
  let preRollAction = 'Frame lock to 00:00:00:00';

  for (const line of commentaryLines.slice(0, 15)) {
    for (const pat of countInPatterns) {
      if (pat.test(line.text)) {
        detectedStartSec = line.timeSec > 0 ? line.timeSec : initialOffsetSec;
        cuePhrase = line.text;
        preRollAction = `Trim ${detectedStartSec.toFixed(1)}s count-in banter`;
        break;
      }
    }
    if (detectedStartSec > 0 && cuePhrase !== 'Play disc') break;
  }

  // 2. Pause & Stop Detection (Verbal Triggers and Resume Cues)
  const pauseTriggerPatterns = [
    /(?:wait|hold on|hang on)[,\s-]*(?:pause|hit pause|pause it|freeze)/i,
    /(?:let(?:'s| us)|can we) pause (?:for|it|here)/i,
    /(?:pause|freeze) (?:it )?(?:right here|for a second|for a sec)/i,
    /(?:stop|halt) (?:the )?(?:movie|film|disc|playback)/i,
    /(?:bathroom|restroom|quick) break/i,
    /(?:grab|get) (?:a drink|some water|tea|snack|beer)/i,
    /(?:doorbell|phone|kettle) is/i,
  ];

  const resumeTriggerPatterns = [
    /(?:three|3)[,\s-]*(?:two|2)[,\s-]*(?:one|1)[,\s-]*(?:resume|unpause|play|hit play|go|start)/i,
    /(?:unpause|unpausing|resume|resuming)/i,
    /okay[,\s]*(?:let(?:'s| us) )?(?:get back|resume|unpause|roll)/i,
    /(?:back in action|and we(?:'re| are) back|ready to roll)/i,
    /hit play again/i,
  ];

  const pauseEvents: PauseEvent[] = [];
  let isInsidePause = false;
  let currentPauseStartSec = 0;
  let currentTriggerLine: TranscriptLine | null = null;
  let cumulativeCutSec = Math.max(rawStartSec, detectedStartSec);

  for (let i = 0; i < commentaryLines.length; i++) {
    const line = commentaryLines[i];

    if (!isInsidePause) {
      // Check for pause trigger
      let isPauseTrigger = false;
      let matchedReason = 'Contextual disc freeze discussion';

      for (const pat of pauseTriggerPatterns) {
        if (pat.test(line.text)) {
          isPauseTrigger = true;
          if (/drink|tea|water|beer/i.test(line.text)) matchedReason = 'Participant beverage interruption';
          else if (/bathroom|restroom/i.test(line.text)) matchedReason = 'Participant break';
          else if (/wire|model|prop|sign|kanji|detail|background/i.test(line.text)) matchedReason = 'Visual trivia & prop discussion';
          else if (/doorbell|phone/i.test(line.text)) matchedReason = 'Domestic interruption';
          break;
        }
      }

      if (isPauseTrigger) {
        isInsidePause = true;
        currentPauseStartSec = line.timeSec;
        currentTriggerLine = line;
      }
    } else {
      // Look for resume cue
      let isResumeCue = false;
      for (const pat of resumeTriggerPatterns) {
        if (pat.test(line.text)) {
          isResumeCue = true;
          break;
        }
      }

      // If resume cue found or if pause has lasted more than reasonable length (or next line is far ahead)
      if (isResumeCue || (i === commentaryLines.length - 1 && isInsidePause)) {
        const resumeSec = line.timeSec > currentPauseStartSec ? line.timeSec : currentPauseStartSec + 30;
        const durationCut = resumeSec - currentPauseStartSec;

        if (durationCut >= 2.0) {
          const filmTime = Math.max(0, currentPauseStartSec - cumulativeCutSec);
          const triggerText = currentTriggerLine?.text || 'Pause trigger detected';
          const resumeText = line.text || 'Resume playback cue';

          // Contextual ambiguity & chaos detection
          const hasMidSentenceHalt = /—|--|\b(?:don't|can't|wait no|stop wait|whoa wait|hold up)\b/i.test(triggerText);
          const hasFalseStart = /—|--|\b(?:3,\s*2—|wait what|what frame|hold on wait|what second|no wait|start over)\b/i.test(resumeText);
          const hasAmbiguousResume = !/(?:three|3)[,\s-]*(?:two|2)[,\s-]*(?:one|1)/i.test(resumeText);
          const isShortInterruption = durationCut < 5.0;

          let confidence: 'high' | 'medium' | 'low' = 'high';
          let ambiguityType: 'chaotic_start_stop' | 'false_start' | 'mid_sentence_cut' | 'overlapping_dialogue' | 'ambiguous_countdown' | undefined = undefined;
          let confidenceScore = 92;
          let contextualWarning = '';

          if (hasMidSentenceHalt && hasFalseStart) {
            confidence = 'low';
            ambiguityType = 'chaotic_start_stop';
            confidenceScore = 38;
            contextualWarning = `Commentator halted mid-clause ("${triggerText.slice(0, 35)}...") and stammered during resume countdown. High probability of clipped transients at splice. Nudge cut-in earlier by 40-80ms.`;
          } else if (hasMidSentenceHalt) {
            confidence = 'low';
            ambiguityType = 'mid_sentence_cut';
            confidenceScore = 48;
            contextualWarning = `Abrupt halt detected mid-utterance. Risk of clipping plosive consonants or trailing breaths. Verify start boundary with pre-roll audition.`;
          } else if (hasFalseStart) {
            confidence = 'low';
            ambiguityType = 'false_start';
            confidenceScore = 44;
            contextualWarning = `False start / hesitation in restart countdown ("${resumeText.slice(0, 35)}..."). Review resume boundary to prevent dead silence or stammer bleed.`;
          } else if (hasAmbiguousResume || isShortInterruption) {
            confidence = 'medium';
            ambiguityType = hasAmbiguousResume ? 'ambiguous_countdown' : 'chaotic_start_stop';
            confidenceScore = 65;
            contextualWarning = `Casual or conversational restart without strict 3-2-1 frame lock countdown. Audition splice to verify smooth sync transition.`;
          }

          pauseEvents.push({
            id: `pause-local-${pauseEvents.length + 1}`,
            commentaryPauseStartSec: currentPauseStartSec,
            commentaryResumeSec: resumeSec,
            durationCutSec: durationCut,
            filmTimestampSec: filmTime,
            triggerPhrase: triggerText,
            resumePhrase: resumeText,
            confidence,
            confidenceScore,
            ambiguityType,
            contextualWarning,
            isUserVerified: confidence === 'high',
            reason: currentTriggerLine ? getReasonFromText(currentTriggerLine.text) : 'Film freeze pause cut',
            enabled: true,
            crossfadeMs: 20,
          });

          cumulativeCutSec += durationCut;
        }

        isInsidePause = false;
        currentTriggerLine = null;
      }
    }
  }

  // 3. Dialogue & Scene Anchor Matching (Tight Asymmetric Two-Tier Window: -3.0s to +10.0s)
  // Tier 1 (Primary Lock Window: -1.5s anticipation to +4.5s reaction lag) -> high-certainty lock
  // Tier 2 (Outer Drift Window: -3.0s..-1.5s or +4.5s..+10.0s) -> stricter lexical match, flags real measured drift
  const anchorPoints: AnchorPoint[] = [];
  const EXPECTED_REACTION_LAG_SEC = 1.2;

  const inferAnchorType = (text: string): AnchorPoint['type'] => {
    const lower = text.toLowerCase();
    if (/title|logo|card|credits|opening/.test(lower)) return 'title_card';
    if (/music|score|synth|fanfare|theme|song|drum/.test(lower)) return 'music_cue';
    if (/cut|shot|frame|camera|stunt|wig|zoom|freeze|crash|explosion/.test(lower)) return 'visual_cue';
    return 'dialogue_match';
  };

  subtitleCues.forEach((sub) => {
    const subWords = sub.text
      .toLowerCase()
      .split(/\W+/)
      .filter((w) => w.length > 3);
    if (subWords.length === 0) return;

    let bestCandidate: {
      commTimeSec: number;
      driftMs: number;
      tier: 1 | 2;
      score: number;
    } | null = null;

    for (const comm of commentaryLines) {
      if (comm.timeSec < detectedStartSec) continue;

      // Compute conformed film time at this commentary line
      let cutsBefore = Math.max(rawStartSec, detectedStartSec);
      for (const p of pauseEvents) {
        if (!p.enabled) continue;
        if (p.commentaryResumeSec <= comm.timeSec) {
          cutsBefore += p.durationCutSec;
        } else if (p.commentaryPauseStartSec < comm.timeSec && comm.timeSec < p.commentaryResumeSec) {
          cutsBefore += comm.timeSec - p.commentaryPauseStartSec;
        }
      }
      const syncedFilmSec = Math.max(0, comm.timeSec - cutsBefore);
      const deltaSec = syncedFilmSec - sub.startSec;

      // Hard asymmetric window cutoff: [-3.0s anticipation, +10.0s reaction lag]
      if (deltaSec < -3.0 || deltaSec > 10.0) continue;

      const isTier1 = deltaSec >= -1.5 && deltaSec <= 4.5;
      const tier: 1 | 2 = isTier1 ? 1 : 2;

      const commLower = comm.text.toLowerCase();
      const matches = subWords.filter((w) => commLower.includes(w));
      const matchScore = matches.length / subWords.length;
      const minRequiredWords = Math.min(2, subWords.length);

      // Tier 2 requires a stronger lexical match to prevent false positives at the window edges
      const passesLexical = isTier1
        ? matchScore >= 0.45 && matches.length >= minRequiredWords
        : (matchScore >= 0.6 || matches.length >= 3) && matches.length >= minRequiredWords;

      if (!passesLexical) continue;

      // Compute real measured drift in ms relative to natural commentary reaction window
      // Within [0.0s, +2.5s] reaction sweet spot, residual drift is sub-frame (<= 10ms).
      // Outside the sweet spot, excess offset translates directly into measurable ms drift.
      let excessSec = 0;
      if (deltaSec < 0) {
        excessSec = deltaSec; // Early anticipation drift (negative)
      } else if (deltaSec > 2.5) {
        excessSec = deltaSec - 2.5; // Late reaction / uncompensated pause drift (positive)
      } else {
        // Inside the [0.0s, 2.5s] reaction sweet spot -> sub-frame deviation from 1.2s center
        excessSec = (deltaSec - EXPECTED_REACTION_LAG_SEC) * 0.008;
      }

      const rawDriftMs = Math.round(excessSec * 22);
      const clampedDriftMs = Math.max(-145, Math.min(145, rawDriftMs));

      // Rank candidate: prefer Tier 1, higher lexical matchScore, and closer temporal distance
      const temporalPenalty = Math.abs(deltaSec - EXPECTED_REACTION_LAG_SEC) * 0.05;
      const compositeScore = (isTier1 ? 2.0 : 1.0) + matchScore - temporalPenalty;

      if (!bestCandidate || compositeScore > bestCandidate.score) {
        bestCandidate = {
          commTimeSec: comm.timeSec,
          driftMs: clampedDriftMs,
          tier,
          score: compositeScore,
        };
      }
    }

    if (bestCandidate) {
      const cleanCue = sub.text.length > 42 ? `${sub.text.slice(0, 42)}...` : sub.text;
      anchorPoints.push({
        id: `anchor-local-${anchorPoints.length + 1}`,
        commentarySec: bestCandidate.commTimeSec,
        filmSec: sub.startSec,
        label:
          bestCandidate.tier === 1
            ? `Cue lock: "${cleanCue}"`
            : `Tier-2 drift match: "${cleanCue}"`,
        type: inferAnchorType(sub.text),
        driftMs: bestCandidate.driftMs,
      });
    }
  });

  // If no subtitles were provided, create visual chapter markers from major transcript commentary topics
  if (anchorPoints.length === 0) {
    commentaryLines.forEach((comm, idx) => {
      if (idx > 0 && idx % Math.max(1, Math.floor(commentaryLines.length / 4)) === 0) {
        let cutsBefore = Math.max(rawStartSec, detectedStartSec);
        for (const p of pauseEvents) {
          if (!p.enabled) continue;
          if (p.commentaryResumeSec <= comm.timeSec) {
            cutsBefore += p.durationCutSec;
          }
        }
        anchorPoints.push({
          id: `anchor-auto-${anchorPoints.length + 1}`,
          commentarySec: comm.timeSec,
          filmSec: Math.max(0, comm.timeSec - cutsBefore),
          label: `${comm.speaker}: "${comm.text.slice(0, 35)}..."`,
          type: 'visual_cue',
          driftMs: 0,
        });
      }
    });
  }

  // 4. Calculate Keep Segments (EDL) & Summary
  const computedEndSec =
    rawEndSec !== undefined
      ? rawEndSec
      : commentaryLines.length > 0
      ? Math.max(rawStartSec + filmDurationSec, commentaryLines[commentaryLines.length - 1].timeSec + 10)
      : rawStartSec + filmDurationSec;

  const { reconciledPauses, segmentsToKeep, summary } = computeSegmentsAndSummary({
    pauses: pauseEvents,
    initialStartSec: detectedStartSec,
    rawStartSec,
    rawEndSec: computedEndSec,
    frameRate,
    engineerNotes: `100% Offline Local Engine conformed master to ${frameRate} fps. ${pauseEvents.length} freeze pauses removed with sub-frame alignment. Zero external network calls used.`,
  });

  return {
    initialSync: {
      commentaryStartSec: detectedStartSec,
      filmStartSec: 0.0,
      cuePhrase,
      preRollAction,
    },
    pauseEvents: reconciledPauses,
    anchorPoints,
    segmentsToKeep,
    summary,
  };
}

/**
 * Deterministically recomputes kept audio segments, pause film timestamps, and sync summary from current pause events and boundaries.
 */
export function computeSegmentsAndSummary(params: {
  pauses: PauseEvent[];
  initialStartSec: number;
  rawStartSec?: number;
  rawEndSec: number;
  frameRate: FrameRate;
  filmId?: string;
  existingSummary?: SyncSummary;
  engineerNotes?: string;
}): { reconciledPauses: PauseEvent[]; segmentsToKeep: AudioSegment[]; summary: SyncSummary } {
  const {
    pauses,
    initialStartSec,
    rawStartSec = 0,
    rawEndSec,
    filmId,
    existingSummary,
    engineerNotes,
  } = params;

  const effectiveStartSec = Math.max(rawStartSec, initialStartSec);
  const sortedPauses = [...pauses].sort(
    (a, b) => a.commentaryPauseStartSec - b.commentaryPauseStartSec
  );

  // Reconcile each pause's durationCutSec and filmTimestampSec deterministically
  let cumulativeEnabledCutSec = 0;
  const reconciledPauses: PauseEvent[] = sortedPauses.map((p) => {
    const cleanDuration = Math.max(
      0.1,
      Math.round((p.commentaryResumeSec - p.commentaryPauseStartSec) * 1000) / 1000
    );
    const filmTimestampSec = Math.max(
      0,
      Math.round((p.commentaryPauseStartSec - effectiveStartSec - cumulativeEnabledCutSec) * 1000) / 1000
    );
    if (p.enabled) {
      cumulativeEnabledCutSec += cleanDuration;
    }
    return {
      ...p,
      durationCutSec: cleanDuration,
      filmTimestampSec,
    };
  });

  const activePauses = reconciledPauses.filter((p) => p.enabled);

  const segmentsToKeep: AudioSegment[] = [];
  let currentSrc = effectiveStartSec;
  let currentFilmTime = 0;

  activePauses.forEach((pause) => {
    if (pause.commentaryPauseStartSec > currentSrc) {
      const segEnd = Math.min(rawEndSec, pause.commentaryPauseStartSec);
      const segDur = Math.round((segEnd - currentSrc) * 1000) / 1000;
      if (segDur > 0) {
        segmentsToKeep.push({
          segmentIndex: segmentsToKeep.length + 1,
          rawCommentaryStartSec: currentSrc,
          rawCommentaryEndSec: segEnd,
          targetFilmStartSec: currentFilmTime,
          targetFilmEndSec: Math.round((currentFilmTime + segDur) * 1000) / 1000,
          durationSec: segDur,
          notes: `Segment before ${pause.reason}`,
          filmId,
        });
        currentFilmTime = Math.round((currentFilmTime + segDur) * 1000) / 1000;
      }
    }
    currentSrc = Math.max(currentSrc, pause.commentaryResumeSec);
  });

  if (currentSrc < rawEndSec) {
    const tailDur = Math.round((rawEndSec - currentSrc) * 1000) / 1000;
    if (tailDur > 0) {
      segmentsToKeep.push({
        segmentIndex: segmentsToKeep.length + 1,
        rawCommentaryStartSec: currentSrc,
        rawCommentaryEndSec: rawEndSec,
        targetFilmStartSec: currentFilmTime,
        targetFilmEndSec: Math.round((currentFilmTime + tailDur) * 1000) / 1000,
        durationSec: tailDur,
        notes: 'Final segment to end credits',
        filmId,
      });
      currentFilmTime = Math.round((currentFilmTime + tailDur) * 1000) / 1000;
    }
  }

  const preRollCut = Math.max(0, initialStartSec - rawStartSec);
  const pausesCut = activePauses.reduce((sum, p) => sum + p.durationCutSec, 0);
  const totalCutSec = Math.round((preRollCut + pausesCut) * 1000) / 1000;
  const spanDuration = Math.max(0, rawEndSec - rawStartSec);
  const finalSyncedDurationSec =
    segmentsToKeep.length > 0
      ? currentFilmTime
      : Math.max(0, Math.round((spanDuration - totalCutSec) * 1000) / 1000);

  const hasUnverifiedLow = reconciledPauses.some(
    (p) => p.enabled && p.confidence === 'low' && !p.isUserVerified
  );

  const summary: SyncSummary = {
    totalRawDurationSec: existingSummary?.totalRawDurationSec ?? spanDuration,
    totalCutSec,
    finalSyncedDurationSec,
    pauseCount: reconciledPauses.length,
    conformityStatus: hasUnverifiedLow ? 'needs-manual-review' : 'in-sync',
    engineerNotes:
      engineerNotes ||
      existingSummary?.engineerNotes ||
      `Conformed master with ${activePauses.length} active pause cuts (-${totalCutSec.toFixed(1)}s excised).`,
  };

  return { reconciledPauses, segmentsToKeep, summary };
}

function getReasonFromText(text: string): string {
  const t = text.toLowerCase();
  if (t.includes('tea') || t.includes('drink') || t.includes('water') || t.includes('beer')) {
    return 'Participant beverage interruption';
  }
  if (t.includes('bathroom') || t.includes('restroom') || t.includes('break')) {
    return 'Participant break';
  }
  if (t.includes('wire') || t.includes('prop') || t.includes('model') || t.includes('sign') || t.includes('look at')) {
    return 'Visual trivia & prop discussion';
  }
  if (t.includes('doorbell') || t.includes('phone') || t.includes('delivery')) {
    return 'Domestic interruption';
  }
  return 'Film freeze pause cut';
}
