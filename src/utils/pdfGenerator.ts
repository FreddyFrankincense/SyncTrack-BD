import { jsPDF } from 'jspdf';
import { FilmSegment, ProjectData } from '../types';
import { formatSMPTE } from './timecode';

interface DocumentationData {
  title: string;
  filmTitle?: string;
  frameRate: number;
  totalRawDurationSec: number;
  totalCutSec: number;
  finalSyncedDurationSec: number;
  segmentCount: number;
  pauseCount: number;
  conformityStatus: string;
  engineerNotes: string;
  cuePhrase: string;
  commentaryStartSec: number;
  audioFileName?: string;
  videoFileName?: string;
  segments: {
    index: number;
    startSec: number;
    endSec: number;
    filmStartSec: number;
    filmEndSec: number;
    durationSec: number;
    notes?: string;
  }[];
  pauses: {
    index: number;
    startSec: number;
    resumeSec: number;
    durationCutSec: number;
    triggerPhrase: string;
    reason: string;
    confidence: string;
    enabled: boolean;
  }[];
}

export function extractDocumentationData(
  project: ProjectData,
  activeFilm?: FilmSegment,
  scope: 'active' | 'batch' = 'active'
): DocumentationData {
  const targetFilm = scope === 'active' ? activeFilm : undefined;

  const title = project.title;
  const filmTitle = targetFilm ? targetFilm.title : undefined;
  const frameRate = targetFilm ? targetFilm.frameRate : project.frameRate;

  const summary = targetFilm ? targetFilm.summary : project.summary;
  const totalRawDurationSec = targetFilm
    ? targetFilm.rawRange.endSec - targetFilm.rawRange.startSec
    : summary.totalRawDurationSec;
  const totalCutSec = summary.totalCutSec;
  const finalSyncedDurationSec = summary.finalSyncedDurationSec;

  const isMultiFilmBatch = scope === 'batch' && project.films && project.films.length > 0;
  const targetSegments = targetFilm
    ? targetFilm.segmentsToKeep
    : isMultiFilmBatch
    ? project.films!.flatMap((f) => f.segmentsToKeep)
    : project.segmentsToKeep;
  const targetPauses = targetFilm
    ? targetFilm.pauseEvents
    : isMultiFilmBatch
    ? project.films!.flatMap((f) => f.pauseEvents)
    : project.pauseEvents;
  const initialSync = targetFilm ? targetFilm.initialSync : project.initialSync;

  return {
    title,
    filmTitle,
    frameRate,
    totalRawDurationSec,
    totalCutSec,
    finalSyncedDurationSec,
    segmentCount: targetSegments.length,
    pauseCount: targetPauses.length,
    conformityStatus: summary.conformityStatus,
    engineerNotes: summary.engineerNotes || 'No specific engineer notes recorded.',
    cuePhrase: initialSync.cuePhrase,
    commentaryStartSec: initialSync.commentaryStartSec,
    audioFileName: project.audioFileName || 'commentary_raw.wav',
    videoFileName: project.videoSource?.fileName,
    segments: targetSegments.map((s, idx) => ({
      index: s.segmentIndex || idx + 1,
      startSec: s.rawCommentaryStartSec,
      endSec: s.rawCommentaryEndSec,
      filmStartSec: s.targetFilmStartSec,
      filmEndSec: s.targetFilmEndSec,
      durationSec: s.durationSec,
      notes: s.notes,
    })),
    pauses: targetPauses.map((p, idx) => ({
      index: idx + 1,
      startSec: p.commentaryPauseStartSec,
      resumeSec: p.commentaryResumeSec,
      durationCutSec: p.durationCutSec,
      triggerPhrase: p.triggerPhrase,
      reason: p.reason,
      confidence: p.confidence,
      enabled: p.enabled,
    })),
  };
}

/**
 * Generates a clean, comprehensive plain-text documentation summary
 */
export function generateDocumentationText(
  project: ProjectData,
  activeFilm?: FilmSegment,
  scope: 'active' | 'batch' = 'active'
): string {
  const data = extractDocumentationData(project, activeFilm, scope);
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  const lines: string[] = [
    '================================================================================',
    'SYNCTRACK BD - COMMENTARY CONFORM & SYNC PROJECT DOCUMENTATION',
    '================================================================================',
    `Project Master:    ${data.title}`,
    ...(data.filmTitle ? [`Film Target:       ${data.filmTitle}`] : []),
    `Generated At:      ${now}`,
    `Conformance Mode:  Audio Master Single Source of Truth (Zero Video AI)`,
    `Master Frame Rate: ${data.frameRate} fps (SMPTE Non-Drop Frame)`,
    `Audio Deliverable: 48,000 Hz, 24-bit LPCM / Dolby Digital Broadcast Standard`,
    ...(data.videoFileName ? [`Conformed Video:   ${data.videoFileName} (Matched to Audio Edit)`] : []),
    '================================================================================',
    '',
    '1. EXECUTIVE METRICS & AUDIT SUMMARY',
    '--------------------------------------------------------------------------------',
    `Total Cut Time:          ${data.totalCutSec.toFixed(2)} seconds (-${formatSMPTE(data.totalCutSec, data.frameRate as any)})`,
    `Number of Kept Segments: ${data.segmentCount} segments`,
    `Number of Pause Cuts:    ${data.pauseCount} pause events detected`,
    `Raw Duration:            ${formatSMPTE(data.totalRawDurationSec, data.frameRate as any)} (${data.totalRawDurationSec.toFixed(1)}s)`,
    `Final Synced BD Length:  ${formatSMPTE(data.finalSyncedDurationSec, data.frameRate as any)} (${data.finalSyncedDurationSec.toFixed(1)}s)`,
    `Conformity Status:       ${data.conformityStatus.toUpperCase()}`,
    `Initial Sync Cue:        "${data.cuePhrase}" at ${formatSMPTE(data.commentaryStartSec, data.frameRate as any)}`,
    '',
    '2. ENGINEER DOCUMENTATION & QUALITY AUDIT NOTES',
    '--------------------------------------------------------------------------------',
    `Engineer Notes:`,
    `  ${data.engineerNotes}`,
    '',
    `Pre-Roll & Splice Strategy:`,
    `  * Pre-Roll Delay: 0 ms (Exact SMPTE frame lock to target film 00:00:00:00).`,
    `  * Micro-Crossfades: 15-25 ms linear ramp applied to eliminate clicks and phase bumps.`,
    `  * Video Conform: Follower track conformed strictly to audio master splice map.`,
    '',
    '3. CONFORMED AUDIO / VIDEO SEGMENTS LIST',
    '--------------------------------------------------------------------------------',
    '#   | RAW COMM IN   | RAW COMM OUT  | TARGET BD IN  | TARGET BD OUT | DURATION | NOTES',
    '----+---------------+---------------+---------------+---------------+----------+---------------------------------',
  ];

  data.segments.forEach((s) => {
    const num = s.index.toString().padStart(2, '0');
    const rIn = formatSMPTE(s.startSec, data.frameRate as any);
    const rOut = formatSMPTE(s.endSec, data.frameRate as any);
    const fIn = formatSMPTE(s.filmStartSec, data.frameRate as any);
    const fOut = formatSMPTE(s.filmEndSec, data.frameRate as any);
    const dur = `${s.durationSec.toFixed(1)}s`.padStart(8, ' ');
    lines.push(`${num}  | ${rIn} | ${rOut} | ${fIn} | ${fOut} | ${dur} | ${s.notes || 'Normal dialogue'}`);
  });

  lines.push('');
  lines.push('4. EXCISED PAUSE CUT AUDIT');
  lines.push('--------------------------------------------------------------------------------');
  lines.push('#   | PAUSE START   | RESUME TIME   | CUT DURATION | CONFIDENCE | TRIGGER & REASON');
  lines.push('----+---------------+---------------+--------------+------------+-----------------------------------');

  data.pauses.forEach((p) => {
    const num = p.index.toString().padStart(2, '0');
    const pStart = formatSMPTE(p.startSec, data.frameRate as any);
    const pResume = formatSMPTE(p.resumeSec, data.frameRate as any);
    const cutDur = `-${p.durationCutSec.toFixed(1)}s`.padStart(12, ' ');
    const conf = p.confidence.toUpperCase().padEnd(10, ' ');
    const flag = p.enabled ? '' : '[BYPASSED] ';
    lines.push(`${num}  | ${pStart} | ${pResume} | ${cutDur} | ${conf} | ${flag}"${p.triggerPhrase}" -> ${p.reason}`);
  });

  lines.push('');
  lines.push('================================================================================');
  lines.push('END OF SYNCTRACK BD CONFORM DOCUMENTATION REPORT');
  lines.push('================================================================================');

  return lines.join('\n');
}

/**
 * Generates an executive-ready, professional multi-page PDF document
 */
export function generateDocumentationPDF(
  project: ProjectData,
  activeFilm?: FilmSegment,
  scope: 'active' | 'batch' = 'active'
): jsPDF {
  const data = extractDocumentationData(project, activeFilm, scope);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 10) {
      doc.addPage();
      y = margin;
      drawPageHeader();
    }
  };

  const drawPageHeader = () => {
    // Subtle top running header on pages 2+
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 140);
    doc.text(`SyncTrack BD Conform Documentation · ${data.title}${data.filmTitle ? ` (${data.filmTitle})` : ''}`, margin, 9);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, 11, pageWidth - margin, 11);
  };

  // Header Banner Block
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, y, contentWidth, 24, 'F');

  doc.setTextColor(245, 158, 11); // amber-500
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SYNCTRACK BD', margin + 6, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('BLU-RAY COMMENTARY CONFORM & SYNC AUDIT SPECIFICATION', margin + 6, y + 15);
  doc.text(`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`, margin + 6, y + 19.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`STATUS: ${data.conformityStatus.toUpperCase()}`, pageWidth - margin - 6, y + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(`${data.frameRate} FPS SMPTE NDF`, pageWidth - margin - 6, y + 15, { align: 'right' });

  y += 28;

  // Project Info Card
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(data.filmTitle ? `${data.title} — ${data.filmTitle}` : data.title, margin, y);
  y += 6;

  // 4 KPI Summary Metric Cards (Total Cut Time, Number of Segments, Excised Pauses, Synced BD Duration)
  const cardWidth = (contentWidth - 6) / 4;
  const cardHeight = 16;
  const cards = [
    { label: 'TOTAL CUT TIME', value: `${data.totalCutSec.toFixed(1)}s`, sub: `-${formatSMPTE(data.totalCutSec, data.frameRate as any)}` },
    { label: 'NUMBER OF SEGMENTS', value: `${data.segmentCount}`, sub: 'Conformed Spans' },
    { label: 'EXCISED PAUSES', value: `${data.pauseCount}`, sub: 'Detected Cuts' },
    { label: 'SYNCED RUNTIME', value: formatSMPTE(data.finalSyncedDurationSec, data.frameRate as any), sub: `${data.finalSyncedDurationSec.toFixed(1)}s total` },
  ];

  cards.forEach((card, idx) => {
    const cx = margin + idx * (cardWidth + 2);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(cx, y, cardWidth, cardHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(card.label, cx + 3, y + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, cx + 3, y + 9.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text(card.sub, cx + 3, y + 13.5);
  });

  y += cardHeight + 6;

  // Section: Engineer Notes for Documentation
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. Engineer Notes & Conform Specifications', margin, y);
  y += 4;

  doc.setFillColor(254, 243, 199); // warm amber background
  doc.setDrawColor(245, 158, 11);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, y, contentWidth, 22, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(146, 64, 14); // amber-800
  doc.text('ENGINEER AUDIT LOG:', margin + 4, y + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(69, 26, 3);
  const splitNotes = doc.splitTextToSize(data.engineerNotes, contentWidth - 8);
  doc.text(splitNotes, margin + 4, y + 9.5);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(120, 53, 15);
  doc.text(
    `Initial Sync: "${data.cuePhrase}" at ${formatSMPTE(data.commentaryStartSec, data.frameRate as any)} · Audio Master Source of Truth (Video conformed passively)`,
    margin + 4,
    y + 18.5
  );

  y += 26;

  // Section: Conformed Segments Table
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`2. Conformed Segments Breakdown (${data.segmentCount} Segments Kept)`, margin, y);
  y += 4;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('#', margin + 2, y + 4);
  doc.text('Raw Comm In', margin + 10, y + 4);
  doc.text('Raw Comm Out', margin + 35, y + 4);
  doc.text('Target Film In', margin + 60, y + 4);
  doc.text('Target Film Out', margin + 85, y + 4);
  doc.text('Duration', margin + 112, y + 4);
  doc.text('Segment Description / Notes', margin + 130, y + 4);
  y += 6.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  data.segments.forEach((seg, idx) => {
    checkPageBreak(6);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 0.5, contentWidth, 5.5, 'F');
    }
    doc.setTextColor(51, 65, 85);
    doc.text(seg.index.toString().padStart(2, '0'), margin + 2, y + 3);
    doc.text(formatSMPTE(seg.startSec, data.frameRate as any), margin + 10, y + 3);
    doc.text(formatSMPTE(seg.endSec, data.frameRate as any), margin + 35, y + 3);
    doc.text(formatSMPTE(seg.filmStartSec, data.frameRate as any), margin + 60, y + 3);
    doc.text(formatSMPTE(seg.filmEndSec, data.frameRate as any), margin + 85, y + 3);
    doc.text(`${seg.durationSec.toFixed(1)}s`, margin + 112, y + 3);
    const truncatedNote = (seg.notes || 'Conformed commentary audio').slice(0, 42);
    doc.text(truncatedNote, margin + 130, y + 3);
    y += 5.5;
  });

  y += 4;

  // Section: Excised Pause Cuts Audit
  checkPageBreak(30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`3. Excised Pause Cuts Audit (${data.pauseCount} Events, -${data.totalCutSec.toFixed(1)}s Total)`, margin, y);
  y += 4;

  // Table Header
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, contentWidth, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('#', margin + 2, y + 4);
  doc.text('Cut Start', margin + 10, y + 4);
  doc.text('Cut Resume', margin + 35, y + 4);
  doc.text('Excised Cut', margin + 60, y + 4);
  doc.text('Confidence', margin + 85, y + 4);
  doc.text('Trigger Phrase & Justification', margin + 110, y + 4);
  y += 6.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);

  data.pauses.forEach((p, idx) => {
    checkPageBreak(6);
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, y - 0.5, contentWidth, 5.5, 'F');
    }
    doc.setTextColor(51, 65, 85);
    doc.text(p.index.toString().padStart(2, '0'), margin + 2, y + 3);
    doc.text(formatSMPTE(p.startSec, data.frameRate as any), margin + 10, y + 3);
    doc.text(formatSMPTE(p.resumeSec, data.frameRate as any), margin + 35, y + 3);

    // Color cut time in dark red/rose
    doc.setTextColor(190, 18, 60);
    doc.text(`-${p.durationCutSec.toFixed(1)}s`, margin + 60, y + 3);

    doc.setTextColor(51, 65, 85);
    doc.text(p.confidence.toUpperCase(), margin + 85, y + 3);

    const desc = `${p.enabled ? '' : '[BYPASSED] '}"${p.triggerPhrase}" · ${p.reason}`.slice(0, 52);
    doc.text(desc, margin + 110, y + 3);
    y += 5.5;
  });

  // Footer page numbers across all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `Page ${i} of ${totalPages} · SyncTrack BD Blu-ray Conforming Suite`,
      pageWidth / 2,
      pageHeight - 6,
      { align: 'center' }
    );
  }

  return doc;
}
