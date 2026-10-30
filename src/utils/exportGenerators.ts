import { AudioSegment, FilmSegment, FrameRate, PauseEvent, ProjectData } from '../types';
import { formatDuration, formatSMPTE } from './timecode';

/**
 * Generates an FFmpeg filter_complex script for splicing a single commentary audio track.
 */
export function generateFFmpegScript(
  segments: AudioSegment[],
  inputFileName = 'commentary_raw.wav',
  outputFormat: 'ac3' | 'wav' | 'flac' = 'ac3',
  frameRate: FrameRate = 23.976
): string {
  const safeSegments = segments.length > 0 ? segments : [];
  const baseName = inputFileName.replace(/\.[^/.]+$/, '');
  const outExt = outputFormat;
  const codecFlags =
    outputFormat === 'ac3'
      ? '-c:a ac3 -b:a 448k -ar 48000'
      : outputFormat === 'flac'
      ? '-c:a flac -ar 48000'
      : '-c:a pcm_s24le -ar 48000';

  const lines: string[] = [
    '#!/usr/bin/env bash',
    '# ==============================================================================',
    '# SyncTrack BD - Frame-Accurate Blu-ray Commentary Conform Script (FFmpeg)',
    `# Source Audio : "${inputFileName}"`,
    `# Target Rate  : ${frameRate} fps | 48kHz Blu-ray Authoring Standard`,
    `# Active Keeps : ${safeSegments.length} segments`,
    '# ==============================================================================',
    'set -euo pipefail',
    '',
    `INPUT_FILE="${inputFileName}"`,
    `OUTPUT_FILE="${baseName}_synced_bluray.${outExt}"`,
    '',
  ];

  if (safeSegments.length === 0) {
    lines.push('# No segments defined; copying master directly');
    lines.push(`ffmpeg -y -i "$INPUT_FILE" ${codecFlags} "$OUTPUT_FILE"`);
    return lines.join('\n');
  }

  lines.push('ffmpeg -y -i "$INPUT_FILE" -filter_complex "\\');
  const filterParts: string[] = [];
  const concatLabels: string[] = [];

  safeSegments.forEach((seg, idx) => {
    const start = seg.rawCommentaryStartSec.toFixed(3);
    const end = seg.rawCommentaryEndSec.toFixed(3);
    const label = `[a${idx}]`;
    filterParts.push(
      `  [0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.015${label}`
    );
    concatLabels.push(label);
  });

  lines.push(filterParts.join('; \\\n') + '; \\');
  lines.push(`  ${concatLabels.join('')}concat=n=${safeSegments.length}:v=0:a=1[outa]" \\`);
  lines.push(`  -map "[outa]" ${codecFlags} "$OUTPUT_FILE"`);
  lines.push('');
  lines.push('echo "Conformed Blu-ray master written to: $OUTPUT_FILE"');

  return lines.join('\n');
}

/**
 * Generates an FFmpeg script for a specific FilmSegment inside a multi-film recording.
 */
export function generateFilmFFmpegScript(
  film: FilmSegment,
  inputFileName = 'master_recording.wav',
  outputFormat: 'ac3' | 'wav' | 'flac' = 'ac3'
): string {
  const slug = film.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const header = [
    `# Film #${film.sequenceIndex}: ${film.title} (${film.discLabel || 'Blu-ray Master'})`,
    `# Raw Slice Range: ${formatSMPTE(film.rawRange.startSec, film.frameRate)} -> ${formatSMPTE(film.rawRange.endSec, film.frameRate)}`,
    '',
  ].join('\n');

  const script = generateFFmpegScript(
    film.segmentsToKeep,
    inputFileName,
    outputFormat,
    film.frameRate
  ).replace(
    /OUTPUT_FILE="[^"]+"/,
    `OUTPUT_FILE="disc${film.sequenceIndex}_${slug}_synced.${outputFormat}"`
  );

  return header + script;
}

/**
 * Generates a batch FFmpeg shell script that extracts and conforms every film in a multi-film project.
 */
export function generateBatchFFmpegScript(
  project: ProjectData,
  outputFormat: 'ac3' | 'wav' | 'flac' = 'ac3'
): string {
  const films = project.films || [];
  if (films.length === 0) {
    return generateFFmpegScript(
      project.segmentsToKeep,
      project.audioFileName || 'commentary_raw.wav',
      outputFormat,
      project.frameRate
    );
  }

  const sections: string[] = [
    '#!/usr/bin/env bash',
    '# ==============================================================================',
    `# SyncTrack BD - Multi-Film Batch Blu-ray Conform Suite`,
    `# Project      : ${project.title}`,
    `# Total Films  : ${films.length}`,
    `# Master Input : ${project.audioFileName || 'master_recording.wav'}`,
    '# ==============================================================================',
    'set -euo pipefail',
    '',
  ];

  films.forEach((film) => {
    sections.push(
      generateFilmFFmpegScript(
        film,
        project.audioFileName || 'master_recording.wav',
        outputFormat
      )
        .replace('#!/usr/bin/env bash\n', '')
        .replace('set -euo pipefail\n', '')
    );
    sections.push('');
  });

  return sections.join('\n');
}

/**
 * Generates a standard CMX 3600 Edit Decision List (EDL) for DaVinci Resolve / Premiere / Avid.
 */
export function generateCMX3600EDL(project: ProjectData, reelName = 'AX'): string {
  const fcm =
    project.frameRate === 29.97 ? 'DROP FRAME' : 'NON-DROP FRAME';
  const lines: string[] = [
    `TITLE: ${project.title.toUpperCase()}`,
    `FCM: ${fcm}`,
    '',
  ];

  project.segmentsToKeep.forEach((seg, idx) => {
    const eventNum = String(idx + 1).padStart(3, '0');
    const srcIn = formatSMPTE(seg.rawCommentaryStartSec, project.frameRate);
    const srcOut = formatSMPTE(seg.rawCommentaryEndSec, project.frameRate);
    const recIn = formatSMPTE(seg.targetFilmStartSec, project.frameRate);
    const recOut = formatSMPTE(seg.targetFilmEndSec, project.frameRate);

    lines.push(
      `${eventNum}  ${reelName.padEnd(8, ' ')} AA/V  C        ${srcIn} ${srcOut} ${recIn} ${recOut}`
    );
    lines.push(`* FROM CLIP NAME: ${project.audioFileName || 'COMMENTARY_MASTER.WAV'}`);
    if (seg.notes) {
      lines.push(`* COMMENT: ${seg.notes}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Generates a unified CMX 3600 Master EDL across all films in a multi-film project.
 */
export function generateMultiFilmMasterEDL(project: ProjectData): string {
  const films = project.films || [];
  if (films.length === 0) {
    return generateCMX3600EDL(project);
  }

  return films
    .map((film) =>
      generateCMX3600EDL(
        {
          ...project,
          title: `${project.title} - ${film.title}`,
          segmentsToKeep: film.segmentsToKeep,
          frameRate: film.frameRate,
        },
        `REEL0${film.sequenceIndex}`
      )
    )
    .join('\n\n');
}

/**
 * Generates a Blu-ray Authoring Cue & Conform Sheet.
 */
export function generateAuthoringSheet(
  project: ProjectData,
  film?: FilmSegment
): string {
  const targetTitle = film ? `${project.title} — ${film.title}` : project.title;
  const fps = film ? film.frameRate : project.frameRate;
  const initialSync = film ? film.initialSync : project.initialSync;
  const pauses = film ? film.pauseEvents : project.pauseEvents;
  const segments = film ? film.segmentsToKeep : project.segmentsToKeep;
  const summary = film ? film.summary : project.summary;

  const lines: string[] = [
    '================================================================================',
    'SYNCTRACK BD - BLU-RAY AUDIO COMMENTARY AUTHORING SPECIFICATION',
    '================================================================================',
    `PROJECT TITLE       : ${targetTitle}`,
    `SOURCE FILE         : ${project.audioFileName || 'commentary_raw.wav'}`,
    `FRAME RATE          : ${fps} fps (SMPTE Non-Drop)`,
    `INITIAL PLAY CUE    : ${formatSMPTE(initialSync.commentaryStartSec, fps)} ("${initialSync.cuePhrase}")`,
    `RAW DURATION        : ${formatDuration(summary.totalRawDurationSec)} (${formatSMPTE(summary.totalRawDurationSec, fps)})`,
    `TOTAL PAUSE CUT     : ${formatDuration(summary.totalCutSec)} (${pauses.filter((p) => p.enabled).length} active cuts)`,
    `CONFORMED DURATION  : ${formatDuration(summary.finalSyncedDurationSec)} (${formatSMPTE(summary.finalSyncedDurationSec, fps)})`,
    `CONFORMITY STATUS   : ${summary.conformityStatus.toUpperCase()}`,
    '--------------------------------------------------------------------------------',
    'SURGICAL PAUSE CUT LOG:',
    '--------------------------------------------------------------------------------',
  ];

  pauses.forEach((p, i) => {
    lines.push(
      `  #${String(i + 1).padStart(2, '0')} [${p.enabled ? 'ACTIVE' : 'BYPASS'}] ` +
        `RAW ${formatSMPTE(p.commentaryPauseStartSec, fps)} -> ${formatSMPTE(p.commentaryResumeSec, fps)} ` +
        `(-${p.durationCutSec.toFixed(2)}s) @ FILM ${formatSMPTE(p.filmTimestampSec, fps)}`
    );
    lines.push(`      Trigger: "${p.triggerPhrase}" | Resume: "${p.resumePhrase}"`);
  });

  lines.push('--------------------------------------------------------------------------------');
  lines.push('CONFORMED SEGMENTS TO KEEP:');
  lines.push('--------------------------------------------------------------------------------');

  segments.forEach((s) => {
    lines.push(
      `  SEG ${String(s.segmentIndex).padStart(2, '0')}: ` +
        `SRC [${formatSMPTE(s.rawCommentaryStartSec, fps)} - ${formatSMPTE(s.rawCommentaryEndSec, fps)}] ` +
        `-> BLU-RAY [${formatSMPTE(s.targetFilmStartSec, fps)} - ${formatSMPTE(s.targetFilmEndSec, fps)}] ` +
        `(${s.durationSec.toFixed(2)}s)`
    );
  });

  lines.push('================================================================================');
  return lines.join('\n');
}

/**
 * Generates a combined multi-film authoring specification sheet.
 */
export function generateMultiFilmMasterSheet(project: ProjectData): string {
  const films = project.films || [];
  if (films.length === 0) {
    return generateAuthoringSheet(project);
  }
  return films.map((f) => generateAuthoringSheet(project, f)).join('\n\n');
}

/**
 * Generates Audacity label track (.txt) tab-separated markers for pause cuts.
 */
export function generateAudacityLabels(
  pauses: PauseEvent[],
  frameRate: FrameRate = 23.976
): string {
  if (pauses.length === 0) {
    return '0.000000\t0.000000\tNO_PAUSES_DETECTED';
  }
  return pauses
    .map((p, idx) => {
      const start = p.commentaryPauseStartSec.toFixed(6);
      const end = p.commentaryResumeSec.toFixed(6);
      const status = p.enabled ? 'CUT' : 'BYPASSED';
      const smpte = formatSMPTE(p.filmTimestampSec, frameRate);
      return `${start}\t${end}\t[${status} #${idx + 1} @ Film ${smpte}] ${p.reason} (-${p.durationCutSec.toFixed(2)}s)`;
    })
    .join('\n');
}

/**
 * Generates an FFmpeg script to passively conform a Zoom / Webcam MP4 video recording
 * to match the exact audio splice decision list with zero video AI processing.
 */
export function generateZoomVideoConformScript(
  segments: AudioSegment[],
  videoFileName = 'zoom_webcam_recording.mp4',
  options: {
    fps: number;
    width: number;
    height: number;
    flavor: 'bash' | 'windows_bat';
    filmTitle: string;
  }
): string {
  const { fps, width, height, flavor, filmTitle } = options;
  const safeSlug = filmTitle.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const outputName = `${safeSlug}_zoom_conformed_${width}x${height}_${fps}fps.mp4`;

  const filterGraph: string[] = [];
  const concatPairs: string[] = [];

  segments.forEach((seg, idx) => {
    const start = seg.rawCommentaryStartSec.toFixed(3);
    const end = seg.rawCommentaryEndSec.toFixed(3);
    filterGraph.push(
      `[0:v]trim=start=${start}:end=${end},setpts=PTS-STARTPTS,fps=${fps},scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2[v${idx}]`
    );
    filterGraph.push(
      `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.015[a${idx}]`
    );
    concatPairs.push(`[v${idx}][a${idx}]`);
  });

  const fullFilter =
    segments.length > 0
      ? `${filterGraph.join(';')};${concatPairs.join('')}concat=n=${segments.length}:v=1:a=1[outv][outa]`
      : `[0:v]fps=${fps},scale=${width}:${height}[outv];[0:a]anull[outa]`;

  if (flavor === 'windows_bat') {
    return [
      '@echo off',
      `REM SyncTrack BD - Passive Zoom Video Conform Script (${width}x${height} @ ${fps}fps)`,
      `REM Film: ${filmTitle}`,
      `set INPUT="${videoFileName}"`,
      `set OUTPUT="${outputName}"`,
      '',
      `ffmpeg -y -i %INPUT% -filter_complex "${fullFilter}" -map "[outv]" -map "[outa]" -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 320k -ar 48000 %OUTPUT%`,
      'echo Done! Conformed Zoom video saved to %OUTPUT%',
    ].join('\r\n');
  }

  return [
    '#!/usr/bin/env bash',
    `# SyncTrack BD - Passive Zoom Video Conform Script (${width}x${height} @ ${fps}fps)`,
    `# Film: ${filmTitle}`,
    'set -euo pipefail',
    '',
    `INPUT="${videoFileName}"`,
    `OUTPUT="${outputName}"`,
    '',
    `ffmpeg -y -i "$INPUT" \\`,
    `  -filter_complex "${fullFilter}" \\`,
    `  -map "[outv]" -map "[outa]" \\`,
    `  -c:v libx264 -preset medium -crf 18 -c:a aac -b:a 320k -ar 48000 "$OUTPUT"`,
    '',
    'echo "Done! Conformed Zoom video saved to $OUTPUT"',
  ].join('\n');
}

/**
 * Generates an FCP7 XMEML v4 multi-track timeline XML for Premiere Pro / DaVinci Resolve.
 */
export function generateZoomMultiTrackXML(
  project: ProjectData,
  film: FilmSegment | undefined,
  videoFileName: string,
  fps: number
): string {
  const segments = film ? film.segmentsToKeep : project.segmentsToKeep;
  const title = film ? `${project.title} - ${film.title}` : project.title;
  const timebase = Math.round(fps);

  const clipItems = segments
    .map((seg, i) => {
      const startFrame = Math.round(seg.targetFilmStartSec * fps);
      const endFrame = Math.round(seg.targetFilmEndSec * fps);
      const inFrame = Math.round(seg.rawCommentaryStartSec * fps);
      const outFrame = Math.round(seg.rawCommentaryEndSec * fps);
      return `          <clipitem id="clipitem-${i + 1}">
            <name>${videoFileName} (Segment ${seg.segmentIndex})</name>
            <enabled>TRUE</enabled>
            <start>${startFrame}</start>
            <end>${endFrame}</end>
            <in>${inFrame}</in>
            <out>${outFrame}</out>
            <file id="file-zoom-master"/>
          </clipitem>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="4">
  <sequence>
    <name>${title} (Conformed Zoom Commentary)</name>
    <rate>
      <timebase>${timebase}</timebase>
      <ntsc>FALSE</ntsc>
    </rate>
    <media>
      <video>
        <track>
${clipItems}
        </track>
      </video>
      <audio>
        <track>
${clipItems}
        </track>
      </audio>
    </media>
  </sequence>
</xmeml>`;
}
