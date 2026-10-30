import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Upload,
  Sparkles,
  Film,
  Copy,
  Check,
  Mic,
  Square,
  Radio,
  Loader2,
  Volume2,
  Cpu,
  Cloud,
} from 'lucide-react';
import { isLocalSpeechRecognitionSupported, LocalSpeechRecognizer } from '../utils/localSpeechRecognition';

interface TranscriptViewProps {
  commentaryTranscript: string;
  onChangeCommentaryTranscript: (text: string) => void;
  filmDialogueOrCues: string;
  onChangeFilmDialogueOrCues: (text: string) => void;
  onRunAIAnalysis: () => void;
  isAnalyzing: boolean;
  onUploadAudioFile: (file: File) => void;
  audioFileName?: string;
  onNotify?: (msg: string, type: 'info' | 'error' | 'success') => void;
}

export const TranscriptView: React.FC<TranscriptViewProps> = ({
  commentaryTranscript,
  onChangeCommentaryTranscript,
  filmDialogueOrCues,
  onChangeFilmDialogueOrCues,
  onRunAIAnalysis,
  isAnalyzing,
  onUploadAudioFile,
  audioFileName,
  onNotify,
}) => {
  const [copied, setCopied] = useState(false);

  // Dictation mode: 'local' (offline Web Speech API) vs 'cloud' (gemini-3.5-transcribe)
  const [micEngine, setMicEngine] = useState<'local' | 'cloud'>('local');
  const [isRecordingMic, setIsRecordingMic] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [liveSpeechBuffer, setLiveSpeechBuffer] = useState<string>('');

  const localRecognizerRef = useRef<LocalSpeechRecognizer | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<number | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const micCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const latestTranscriptRef = useRef<string>(commentaryTranscript);

  useEffect(() => {
    latestTranscriptRef.current = commentaryTranscript;
  }, [commentaryTranscript]);

  const handleCopyTranscript = () => {
    navigator.clipboard.writeText(commentaryTranscript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAudioFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadAudioFile(e.target.files[0]);
    }
  };

  // Start microphone recording / dictation
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      setRecordingSeconds(0);
      setLiveSpeechBuffer('');

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      // Setup audio analyzer for live VU meter
      if (micAudioCtxRef.current) {
        micAudioCtxRef.current.close().catch(() => {});
      }
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      micAudioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      micAnalyserRef.current = analyser;

      // Draw live mic frequency level
      const drawVisualizer = () => {
        if (!micCanvasRef.current || !micAnalyserRef.current) return;
        const canvas = micCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const bufferLength = micAnalyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        micAnalyserRef.current.getByteFrequencyData(dataArray);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = micEngine === 'local' ? '#10b981' : dataArray[i] > 180 ? '#f59e0b' : '#38bdf8';
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }

        animationFrameRef.current = requestAnimationFrame(drawVisualizer);
      };

      animationFrameRef.current = requestAnimationFrame(drawVisualizer);

      // Local 100% Offline Speech Recognition
      if (micEngine === 'local' && isLocalSpeechRecognitionSupported()) {
        const recognizer = new LocalSpeechRecognizer({
          onResult: (item) => {
            const formatted = `${item.timecode} Commentator: ${item.transcript}`;
            setLiveSpeechBuffer((prev) => (prev ? `${prev}\n${formatted}` : formatted));
            const current = latestTranscriptRef.current.trim();
            const updated = current ? `${current}\n${formatted}` : formatted;
            latestTranscriptRef.current = updated;
            onChangeCommentaryTranscript(updated);
          },
          onError: (err) => {
            console.warn('Local speech recognizer error:', err);
          },
        });
        localRecognizerRef.current = recognizer;
        recognizer.start(0);
      }

      // Also record audio chunks so audio can be uploaded to player buffer
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = '';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        if (micAudioCtxRef.current) {
          micAudioCtxRef.current.close().catch(() => {});
          micAudioCtxRef.current = null;
        }

        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });

        const audioFile = new File([audioBlob], `mic_recording_${Date.now()}.webm`, {
          type: audioBlob.type,
        });
        onUploadAudioFile(audioFile);

        // If Cloud Gemini model was selected, send to backend
        if (micEngine === 'cloud') {
          await transcribeWithGeminiCloud(audioBlob, recorder.mimeType || 'audio/webm');
        } else {
          onNotify?.('100% Offline Local dictation captured successfully.', 'success');
        }
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setIsRecordingMic(true);

      timerIntervalRef.current = window.setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      onNotify?.(
        'Could not access microphone. Please grant browser microphone permission.',
        'error'
      );
    }
  };

  // Stop microphone recording
  const stopRecording = () => {
    if (localRecognizerRef.current) {
      localRecognizerRef.current.stop();
      localRecognizerRef.current = null;
    }
    if (mediaRecorderRef.current && isRecordingMic) {
      mediaRecorderRef.current.stop();
      setIsRecordingMic(false);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }
  };

  // Transcribe using Gemini 3.5 Transcribe (Cloud option)
  const transcribeWithGeminiCloud = async (blob: Blob, mimeType: string) => {
    setIsTranscribing(true);
    onNotify?.('Transcribing recorded audio with Gemini 3.5 Transcribe...', 'info');

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(blob);

      const audioBase64 = await base64Promise;

      const response = await fetch('/api/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64,
          mimeType,
        }),
      });

      if (!response.ok) {
        throw new Error(`Transcription failed with status ${response.status}`);
      }

      const data = await response.json();
      const resultText = data.transcript || '';

      const current = latestTranscriptRef.current.trim();
      const updated = current ? `${current}\n\n${resultText}` : resultText;
      latestTranscriptRef.current = updated;
      onChangeCommentaryTranscript(updated);

      onNotify?.('Cloud audio transcription complete! Added to commentary transcript.', 'success');
    } catch (err: any) {
      console.error('Transcription error:', err);
      onNotify?.('Cloud audio transcription failed. Local audio track is loaded.', 'error');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (localRecognizerRef.current) localRecognizerRef.current.stop();
      if (micAudioCtxRef.current) {
        micAudioCtxRef.current.close().catch(() => {});
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${('0' + mins).slice(-2)}:${('0' + secs).slice(-2)}`;
  };

  return (
    <div className="bg-neutral-900/60 border border-neutral-800 rounded-xl p-6 sm:p-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-neutral-100">
              Commentary Transcript & Film Dialogue Context
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
            <span className="text-emerald-400 font-medium">100% Offline Local Engine</span>
            <span aria-hidden="true">·</span>
            <span>Microphone dictation</span>
            <span aria-hidden="true">·</span>
            <span>Dual Text Ingest</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Zoom video / audio file upload affordance */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md cursor-pointer transition-colors" title="Load Zoom Video recording (.mp4/.mov) or master audio (.wav/.mp3)">
            <Upload className="w-3.5 h-3.5 text-amber-400" />
            <span className="truncate max-w-[190px]">{audioFileName ? audioFileName : 'Upload Zoom MP4 / Audio'}</span>
            <input
              type="file"
              accept="audio/*,video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv,.wav,.mp3,.m4a,.aac,.flac"
              onChange={handleAudioFileInput}
              className="hidden"
            />
          </label>

          <button
            onClick={onRunAIAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-md transition-colors whitespace-nowrap"
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>{isAnalyzing ? 'Analyzing...' : 'Parse & Align Sync'}</span>
          </button>
        </div>
      </div>

      {/* Microphone Audio Input & Speech Recognition Console */}
      <div className="p-5 sm:p-6 bg-neutral-950/80 border border-neutral-800 rounded-xl flex flex-wrap items-center justify-between gap-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Radio className={`w-4 h-4 ${isRecordingMic ? 'text-rose-500 animate-pulse' : 'text-emerald-400'}`} />
            <span className="text-xs font-semibold text-neutral-200">
              Microphone Dictation & Audio Ingestion
            </span>
            {/* Engine switcher pill-less button */}
            <div className="flex items-center gap-1 bg-neutral-900 p-0.5 rounded border border-neutral-800 text-[10px]">
              <button
                type="button"
                onClick={() => setMicEngine('local')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  micEngine === 'local' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Offline Web Speech
              </button>
              <button
                type="button"
                onClick={() => setMicEngine('cloud')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  micEngine === 'cloud' ? 'bg-amber-950 text-amber-300 border border-amber-800/60' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Gemini 3.5 Cloud
              </button>
            </div>
          </div>
          <p className="text-[11px] text-neutral-400 max-w-lg">
            {micEngine === 'local'
              ? 'Dictate sync markers directly into browser memory (100% offline, zero network data). Timestamps generated in real time.'
              : 'Records high-quality audio and transcribes with Gemini 3.5 Transcribe model via backend API.'}
          </p>
        </div>

        {/* Recording transport and VU visualizer */}
        <div className="flex items-center gap-3">
          {/* Live audio frequency canvas */}
          {isRecordingMic && (
            <div className="flex items-center gap-2 bg-neutral-900 px-2.5 py-1.5 rounded border border-neutral-800">
              <canvas
                ref={micCanvasRef}
                width={70}
                height={20}
                className="rounded"
              />
              <span className="font-mono text-xs text-rose-400 tabular-nums font-semibold">
                {formatTimer(recordingSeconds)}
              </span>
            </div>
          )}

          {isTranscribing && (
            <div className="flex items-center gap-2 text-xs text-sky-400 font-medium bg-sky-950/40 px-3 py-1.5 rounded border border-sky-800/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Transcribing with Gemini 3.5...</span>
            </div>
          )}

          {!isRecordingMic ? (
            <button
              onClick={startRecording}
              disabled={isTranscribing}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 rounded-lg transition-colors shadow-sm"
              title="Start recording your microphone to transcribe"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{micEngine === 'local' ? 'Start Local Dictation' : 'Record via Cloud Mic'}</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition-colors shadow-sm animate-pulse"
              title="Stop recording"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Recording ({formatTimer(recordingSeconds)})</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Dual Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-2">
        {/* Left Column: Commentary Transcript */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Commentary Track Speech & Timecodes</span>
            </div>
            <button
              onClick={handleCopyTranscript}
              className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-200"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          <textarea
            value={commentaryTranscript}
            onChange={(e) => onChangeCommentaryTranscript(e.target.value)}
            rows={14}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-amber-400/80 leading-relaxed resize-y"
            placeholder="[00:00:10] Speaker 1: Three, two, one, press play!&#10;[00:04:12] Speaker 2: Wait, pause it right here! Look at that background prop...&#10;[00:04:45] Speaker 1: Okay, let's unpause in 3, 2, 1, resume!"
          />
          <p className="text-[11px] text-neutral-500">
            Tip: Include timestamps (e.g. [HH:MM:SS]) and verbal cues like "hit pause", "stop it", "3-2-1 unpause". The 100% offline engine parses these directly.
          </p>
        </div>

        {/* Right Column: Film Dialogue & Scene Cues */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
              <Film className="w-3.5 h-3.5 text-sky-400" />
              <span>Film Subtitles / Scene Dialogue (SRT / VTT)</span>
            </div>
          </div>

          <textarea
            value={filmDialogueOrCues}
            onChange={(e) => onChangeFilmDialogueOrCues(e.target.value)}
            rows={14}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs font-mono text-neutral-200 placeholder-neutral-600 focus:outline-none focus:border-sky-400/80 leading-relaxed resize-y"
            placeholder="00:01:46.000 --> 00:01:52.000&#10;Detective: 'Where were you on the 14th?'&#10;&#10;00:02:58.000 --> 00:03:08.000&#10;[Police Spinner car lifts off into rain]"
          />
          <p className="text-[11px] text-neutral-500">
            Paste film subtitles or script cues. The engine cross-references commentary remarks against these lines to eliminate cumulative sync drift locally.
          </p>
        </div>
      </div>
    </div>
  );
};
