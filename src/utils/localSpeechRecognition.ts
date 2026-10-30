export interface SpeechRecognitionResultItem {
  timecode: string;
  transcript: string;
  timestampSec: number;
  isFinal: boolean;
}

export interface LocalSpeechRecognizerOptions {
  onResult: (item: SpeechRecognitionResultItem) => void;
  onError?: (err: any) => void;
  lang?: string;
}

export function isLocalSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
}

function formatTimecodeBracket(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `[${pad(hrs)}:${pad(mins)}:${pad(secs)}]`;
}

export class LocalSpeechRecognizer {
  private recognition: any = null;
  private options: LocalSpeechRecognizerOptions;
  private startTimeMs = 0;
  private initialOffsetSec = 0;
  private isActive = false;

  constructor(options: LocalSpeechRecognizerOptions) {
    this.options = options;
  }

  public start(initialOffsetSec = 0): void {
    if (!isLocalSpeechRecognitionSupported()) {
      this.options.onError?.(new Error('Web Speech API is not supported in this browser.'));
      return;
    }

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    this.initialOffsetSec = initialOffsetSec;
    this.startTimeMs = Date.now();
    this.isActive = true;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = this.options.lang || 'en-US';

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const transcript = String(result[0]?.transcript || '').trim();
          if (transcript) {
            const elapsedSec = (Date.now() - this.startTimeMs) / 1000 + this.initialOffsetSec;
            this.options.onResult({
              timecode: formatTimecodeBracket(elapsedSec),
              transcript,
              timestampSec: elapsedSec,
              isFinal: true,
            });
          }
        }
      }
    };

    recognition.onerror = (event: any) => {
      this.options.onError?.(event);
    };

    recognition.onend = () => {
      if (this.isActive) {
        try {
          recognition.start();
        } catch {
          // Ignore restart race errors
        }
      }
    };

    this.recognition = recognition;
    try {
      recognition.start();
    } catch (err) {
      this.options.onError?.(err);
    }
  }

  public stop(): void {
    this.isActive = false;
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {
        // Ignore stop errors
      }
      this.recognition = null;
    }
  }
}
