import { AudioSegment, PauseEvent } from '../types';

let audioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass({ sampleRate: 48000 });
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Extracts normalized peak data (min/max pairs) from an AudioBuffer for fast waveform rendering
 */
export function extractPeaks(buffer: AudioBuffer, numBuckets = 1200): Float32Array {
  const channelData = buffer.getChannelData(0);
  const totalSamples = channelData.length;
  if (totalSamples === 0 || numBuckets <= 0) return new Float32Array(0);
  const blockSize = Math.max(1, Math.floor(totalSamples / numBuckets));
  const peaks = new Float32Array(numBuckets);
  // Sample with a stride inside large blocks to keep peak extraction O(1) fast (< 2ms)
  const stride = Math.max(1, Math.floor(blockSize / 64));

  for (let i = 0; i < numBuckets; i++) {
    const start = i * blockSize;
    const end = Math.min(totalSamples, start + blockSize);
    let max = 0;
    for (let j = start; j < end; j += stride) {
      const val = Math.abs(channelData[j]);
      if (val > max) max = val;
    }
    peaks[i] = max;
  }
  return peaks;
}

/**
 * Generates an edited AudioBuffer by excising the enabled pause cut zones and stitching with crossfades.
 */
export function renderSyncedAudioBuffer(
  rawBuffer: AudioBuffer,
  segments: AudioSegment[],
  crossfadeMs = 15
): AudioBuffer {
  const ctx = getAudioContext();
  const sampleRate = rawBuffer.sampleRate;
  const numChannels = rawBuffer.numberOfChannels;
  const crossfadeSamples = Math.floor((crossfadeMs / 1000) * sampleRate);

  // Calculate total samples required
  let totalOutputSamples = 0;
  let validSegCount = 0;
  segments.forEach((seg) => {
    const startSample = Math.max(0, Math.floor(seg.rawCommentaryStartSec * sampleRate));
    const endSample = Math.min(rawBuffer.length, Math.floor(seg.rawCommentaryEndSec * sampleRate));
    const segSamples = Math.max(0, endSample - startSample);
    if (segSamples > 0) {
      totalOutputSamples += segSamples;
      if (validSegCount > 0) {
        totalOutputSamples -= Math.min(crossfadeSamples, Math.floor(segSamples / 2));
      }
      validSegCount++;
    }
  });

  if (totalOutputSamples <= 0) totalOutputSamples = sampleRate;

  const outBuffer = ctx.createBuffer(numChannels, totalOutputSamples, sampleRate);

  for (let c = 0; c < numChannels; c++) {
    const srcData = rawBuffer.getChannelData(c);
    const dstData = outBuffer.getChannelData(c);
    let writePos = 0;

    segments.forEach((seg, idx) => {
      const startSample = Math.max(0, Math.floor(seg.rawCommentaryStartSec * sampleRate));
      const endSample = Math.min(srcData.length, Math.floor(seg.rawCommentaryEndSec * sampleRate));
      const len = Math.max(0, endSample - startSample);

      if (len === 0) return;

      if (idx === 0 || writePos === 0) {
        const copyLen = Math.min(len, dstData.length - writePos);
        if (copyLen > 0) {
          dstData.set(srcData.subarray(startSample, startSample + copyLen), writePos);
          writePos += copyLen;
        }
      } else {
        // Subsequent segments: clamp crossfade so it never exceeds segment or write position
        const safeCrossfade = Math.max(0, Math.min(crossfadeSamples, Math.floor(len / 2), writePos));
        writePos -= safeCrossfade;

        for (let i = 0; i < safeCrossfade; i++) {
          const fadeOut = (safeCrossfade - i) / safeCrossfade;
          const fadeIn = i / safeCrossfade;
          if (writePos + i < dstData.length) {
            const existing = dstData[writePos + i];
            const incoming = srcData[startSample + i] || 0;
            dstData[writePos + i] = existing * fadeOut + incoming * fadeIn;
          }
        }
        // Fast typed-array copy for remaining non-overlapped samples
        const remLen = Math.min(len - safeCrossfade, dstData.length - (writePos + safeCrossfade));
        if (remLen > 0) {
          dstData.set(
            srcData.subarray(startSample + safeCrossfade, startSample + safeCrossfade + remLen),
            writePos + safeCrossfade
          );
        }
        writePos += safeCrossfade + Math.max(0, remLen);
      }
    });
  }

  return outBuffer;
}

// Precomputed 4096-point sine lookup table for fast synthetic vocal synthesis
const SINE_TABLE_SIZE = 4096;
const SINE_TABLE_MASK = SINE_TABLE_SIZE - 1;
const SINE_LUT = new Float32Array(SINE_TABLE_SIZE);
for (let i = 0; i < SINE_TABLE_SIZE; i++) {
  SINE_LUT[i] = Math.sin((i / SINE_TABLE_SIZE) * 2 * Math.PI);
}

/**
 * Creates a synthetic multi-speaker realistic commentary AudioBuffer for interactive demonstration
 */
export function generateSyntheticCommentary(
  durationSec: number,
  pauses: PauseEvent[],
  initialCountInSec = 14
): AudioBuffer {
  const ctx = getAudioContext();
  // Use 24kHz for synthetic preview buffers to cut memory usage in half while maintaining full vocal clarity
  const sampleRate = 24000;
  // Cap synthetic buffer duration to 1800s (30 mins) to prevent excessive RAM usage
  const safeDurationSec = Math.max(10, Math.min(1800, durationSec));
  const numSamples = Math.floor(safeDurationSec * sampleRate);
  const buffer = ctx.createBuffer(2, numSamples, sampleRate);

  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);

  // Deterministic PRNG
  let seed = 42;
  const pseudoRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  // Pre-fill a small 1-second noise tile and tile it across the buffer (100x faster than per-sample PRNG)
  const noiseTile = new Float32Array(sampleRate);
  for (let i = 0; i < sampleRate; i++) {
    noiseTile[i] = (pseudoRand() - 0.5) * 0.004;
  }
  for (let offset = 0; offset < numSamples; offset += sampleRate) {
    const chunkLen = Math.min(sampleRate, numSamples - offset);
    left.set(noiseTile.subarray(0, chunkLen), offset);
    right.set(noiseTile.subarray(0, chunkLen), offset);
  }

  // Pre-roll countdown banter (first N seconds)
  addSpeechBurst(left, right, sampleRate, 2, 4, 180, 0.45, noiseTile);
  addSpeechBurst(left, right, sampleRate, 5, 8, 220, 0.5, noiseTile);
  addSpeechBurst(left, right, sampleRate, 10, 13.8, 190, 0.65, noiseTile);

  // Generate continuous talk tracks with pauses
  let currentTime = initialCountInSec;

  while (currentTime < safeDurationSec) {
    const activePause = pauses.find(
      (p) => currentTime >= p.commentaryPauseStartSec && currentTime <= p.commentaryResumeSec
    );

    if (activePause) {
      addSpeechBurst(
        left,
        right,
        sampleRate,
        activePause.commentaryPauseStartSec,
        activePause.commentaryPauseStartSec + 2.5,
        230,
        0.7,
        noiseTile
      );
      addSpeechBurst(
        left,
        right,
        sampleRate,
        activePause.commentaryPauseStartSec + 4,
        Math.min(activePause.commentaryResumeSec - 3.2, activePause.commentaryPauseStartSec + 8),
        160,
        0.4,
        noiseTile
      );
      addSpeechBurst(
        left,
        right,
        sampleRate,
        Math.max(activePause.commentaryPauseStartSec + 2.6, activePause.commentaryResumeSec - 3),
        activePause.commentaryResumeSec - 0.2,
        210,
        0.65,
        noiseTile
      );

      currentTime = activePause.commentaryResumeSec + 0.5;
    } else {
      const talkDur = 3 + pseudoRand() * 6;
      const pitch = 140 + pseudoRand() * 120;
      const vol = 0.4 + pseudoRand() * 0.35;
      addSpeechBurst(left, right, sampleRate, currentTime, currentTime + talkDur, pitch, vol, noiseTile);

      const gap = 1 + pseudoRand() * 4;
      currentTime += talkDur + gap;
    }
  }

  return buffer;
}

function addSpeechBurst(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  startSec: number,
  endSec: number,
  fundamentalHz: number,
  amplitude: number,
  noiseTile: Float32Array
) {
  const start = Math.max(0, Math.floor(startSec * sampleRate));
  const end = Math.min(left.length, Math.floor(endSec * sampleRate));
  const len = end - start;
  if (len <= 0) return;

  const phaseStep1 = (fundamentalHz * SINE_TABLE_SIZE) / sampleRate;
  const phaseStep2 = (fundamentalHz * 2.2 * SINE_TABLE_SIZE) / sampleRate;
  const phaseStep3 = (fundamentalHz * 3.5 * SINE_TABLE_SIZE) / sampleRate;
  const envStep = (SINE_TABLE_SIZE / 2) / len;

  let p1 = 0;
  let p2 = 0;
  let p3 = 0;
  let pEnv = 0;

  for (let i = 0; i < len; i++) {
    const env = SINE_LUT[pEnv & SINE_TABLE_MASK];
    const h1 = SINE_LUT[p1 & SINE_TABLE_MASK];
    const h2 = 0.5 * SINE_LUT[p2 & SINE_TABLE_MASK];
    const h3 = 0.25 * SINE_LUT[p3 & SINE_TABLE_MASK];
    const breath = noiseTile[i % sampleRate] * 25;

    const sample = (h1 + h2 + h3 + breath) * env * amplitude;
    left[start + i] += sample * 0.9;
    right[start + i] += sample * 0.95;

    p1 += phaseStep1;
    p2 += phaseStep2;
    p3 += phaseStep3;
    pEnv += envStep;
  }
}
