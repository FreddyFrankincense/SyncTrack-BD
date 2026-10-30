import { FrameRate } from '../types';

/**
 * Converts seconds into SMPTE timecode (HH:MM:SS:FF)
 */
export function formatSMPTE(seconds: number, fps: FrameRate = 23.976): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) seconds = 0;

  const framesPerSec = Math.max(1, Math.round(fps));
  const totalFrames = Math.round(seconds * framesPerSec);
  const framesPerMin = framesPerSec * 60;
  const framesPerHour = framesPerMin * 60;

  const hours = Math.floor(totalFrames / framesPerHour);
  const remainingAfterHours = totalFrames % framesPerHour;
  const minutes = Math.floor(remainingAfterHours / framesPerMin);
  const remainingAfterMinutes = remainingAfterHours % framesPerMin;
  const secs = Math.floor(remainingAfterMinutes / framesPerSec);
  const frames = Math.floor(remainingAfterMinutes % framesPerSec);

  const pad = (n: number, z = 2) => ('00' + n).slice(-z);
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)}:${pad(frames)}`;
}

/**
 * Formats seconds into human-readable MM:SS or HH:MM:SS with tenths
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 10);
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m ${secs}.${ms}s`;
  }
  return `${mins}:${('00' + secs).slice(-2)}.${ms}`;
}

/**
 * Parses SMPTE or MM:SS to seconds
 */
export function parseTimeToSeconds(timeStr: string, fps: FrameRate = 23.976): number {
  const parts = timeStr.trim().split(':');
  const nominalFps = Math.max(1, Math.round(fps));
  if (parts.length === 4) {
    // HH:MM:SS:FF
    const [h, m, s, f] = parts.map(Number);
    return (h * 3600) + (m * 60) + s + (f / nominalFps);
  }
  if (parts.length === 3) {
    // HH:MM:SS or MM:SS.ms
    const [h, m, s] = parts.map(Number);
    return (h * 3600) + (m * 60) + s;
  }
  if (parts.length === 2) {
    // MM:SS
    const [m, s] = parts.map(Number);
    return (m * 60) + s;
  }
  const floatVal = parseFloat(timeStr);
  return isNaN(floatVal) ? 0 : floatVal;
}
