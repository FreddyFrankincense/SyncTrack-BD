import http from 'http';
import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Shared Gemini AI instance
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Contextual AI commentary pause & sync analyzer
app.post('/api/analyze-sync', async (req, res) => {
  try {
    const {
      commentaryTranscript,
      filmDialogueOrCues,
      filmTitle = 'Feature Film',
      frameRate = 23.976,
      filmDurationSec = 7200,
      initialOffsetSec = 0,
      confidenceThreshold = 0.6,
    } = req.body;

    if (!commentaryTranscript || typeof commentaryTranscript !== 'string') {
      return res.status(400).json({ error: 'Commentary transcript is required.' });
    }

    const systemPrompt = `You are a world-class Blu-ray authoring audio engineer and context sync specialist.
When commentary tracks (by directors, actors, or fans) are recorded, participants often chat before pressing play, or they pause the video disc during recording (e.g. "Wait, hit pause!", "Let me grab a water", "Look at that background stuntman, hold on pause it", followed later by "Okay, ready? 3, 2, 1, resume!").
Because the recording device kept running while the movie was paused, the commentary track will permanently drift out of sync with the Blu-ray video unless every pause interval is identified and surgically removed.

Your job is to analyze the commentary transcript (and any matching film dialogue/cues/subtitles provided) to:
1. Detect initial sync point (e.g., countdowns "3, 2, 1, play", studio logo fanfares, opening title callouts).
2. Detect every pause event:
   - Identify the exact commentary timestamp where the film was paused.
   - Identify the resume cue / unpause timestamp.
   - Calculate the dead time / frozen film time (duration cut in seconds).
   - Determine the exact film timecode where this freeze took place.
   - Extract trigger phrases and resume phrases.
3. Cross-reference commentary mentions with film dialogue/subtitles to establish anchor verification points (e.g. when a speaker says "Listen to his line here..." or comments on a specific visual).
4. Generate a surgical EDL (Edit Decision List) / cut list specifying the exact commentary segments to KEEP and what to CUT so the edited audio will play back in 100% frame-accurate sync with the Blu-ray movie.
5. Provide Blu-ray authoring statistics (timecode SMPTE format HH:MM:SS:FF at ${frameRate} fps, total trimmed pause time, resulting sync duration).

Return your response strictly in the specified JSON format.`;

    const userPrompt = `Project: ${filmTitle}
Frame Rate: ${frameRate} fps
Film Duration: ${filmDurationSec} seconds
Provided Initial Offset: ${initialOffsetSec} seconds

COMMENTARY TRANSCRIPT:
"""
${commentaryTranscript}
"""

FILM DIALOGUE / SUBTITLES / SCENE CUES:
"""
${filmDialogueOrCues || 'No separate film dialogue provided. Rely on commentary verbal cues, timestamps, and contextual references.'}
"""

Analyze all pause/stop/resume cues, verify against film cues, and output the structured sync profile and cut list.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            initialSync: {
              type: Type.OBJECT,
              properties: {
                commentaryStartSec: { type: Type.NUMBER, description: 'Seconds into commentary where film playback starts' },
                filmStartSec: { type: Type.NUMBER, description: 'Target seconds into film (usually 0.0 or logo marker)' },
                cuePhrase: { type: Type.STRING, description: 'Verbal start cue e.g. "3, 2, 1, play"' },
                preRollAction: { type: Type.STRING, description: 'Action for audio before play (e.g. cut, fade in, or pad)' },
              },
              required: ['commentaryStartSec', 'filmStartSec', 'cuePhrase'],
            },
            pauseEvents: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  commentaryPauseStartSec: { type: Type.NUMBER, description: 'Start time of pause in commentary' },
                  commentaryResumeSec: { type: Type.NUMBER, description: 'End time of pause / resume in commentary' },
                  durationCutSec: { type: Type.NUMBER, description: 'Seconds of paused delay to remove' },
                  filmTimestampSec: { type: Type.NUMBER, description: 'Film timecode where the pause happened' },
                  triggerPhrase: { type: Type.STRING, description: 'Verbal phrase where pause begins' },
                  resumePhrase: { type: Type.STRING, description: 'Verbal phrase where film unpauses' },
                  confidence: { type: Type.STRING, description: 'high, medium, or low' },
                  reason: { type: Type.STRING, description: 'Contextual reason e.g. Trivia discussion, bathroom break, playback glitch' },
                },
                required: ['id', 'commentaryPauseStartSec', 'commentaryResumeSec', 'durationCutSec', 'filmTimestampSec', 'triggerPhrase', 'resumePhrase', 'reason'],
              },
            },
            anchorPoints: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  commentarySec: { type: Type.NUMBER },
                  filmSec: { type: Type.NUMBER },
                  label: { type: Type.STRING },
                  type: { type: Type.STRING, description: 'dialogue_match, visual_cue, chapter_marker, or title_card' },
                },
                required: ['commentarySec', 'filmSec', 'label'],
              },
            },
            segmentsToKeep: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  segmentIndex: { type: Type.INTEGER },
                  rawCommentaryStartSec: { type: Type.NUMBER },
                  rawCommentaryEndSec: { type: Type.NUMBER },
                  targetFilmStartSec: { type: Type.NUMBER },
                  targetFilmEndSec: { type: Type.NUMBER },
                  durationSec: { type: Type.NUMBER },
                  notes: { type: Type.STRING },
                },
                required: ['segmentIndex', 'rawCommentaryStartSec', 'rawCommentaryEndSec', 'targetFilmStartSec', 'targetFilmEndSec', 'durationSec'],
              },
            },
            summary: {
              type: Type.OBJECT,
              properties: {
                totalRawDurationSec: { type: Type.NUMBER },
                totalCutSec: { type: Type.NUMBER },
                finalSyncedDurationSec: { type: Type.NUMBER },
                pauseCount: { type: Type.INTEGER },
                conformityStatus: { type: Type.STRING, description: 'in-sync, minor-drift, or needs-manual-review' },
                engineerNotes: { type: Type.STRING, description: 'Technical commentary notes and Blu-ray authoring recommendation' },
              },
              required: ['totalRawDurationSec', 'totalCutSec', 'finalSyncedDurationSec', 'pauseCount', 'conformityStatus', 'engineerNotes'],
            },
          },
          required: ['initialSync', 'pauseEvents', 'anchorPoints', 'segmentsToKeep', 'summary'],
        },
      },
    });

    const rawText = (response.text || '{}').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(rawText);
    return res.json(parsed);
  } catch (error: any) {
    console.error('Sync analysis error:', error);
    return res.status(500).json({
      error: 'Failed to analyze sync context',
      message: error?.message || 'Unknown server error',
    });
  }
});

// Transcribe audio using gemini-3.5-transcribe
app.post('/api/transcribe-audio', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/mp3' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    };

    const promptText = `Transcribe this audio track with precise timestamps in [HH:MM:SS] format for every speaker utterance. Pay special attention to verbal sync cues like countdowns ("3, 2, 1, play", "mark"), mentions of pausing the movie ("wait pause it", "hold on hit pause"), discussion during pauses, and resume cues ("3, 2, 1 unpause", "let's hit play again").`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: { parts: [audioPart, { text: promptText }] },
    });

    return res.json({ transcript: response.text });
  } catch (error: any) {
    console.error('Audio transcription error:', error);
    return res.status(500).json({
      error: 'Audio transcription failed',
      message: error?.message || 'Unknown error',
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'SyncTrack BD' });
});

async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(port, () => {
    console.log(`SyncTrack BD server running on http://localhost:${port}`);
  });
}

startServer();
