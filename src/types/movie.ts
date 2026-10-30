export type VideoFormat = 'mkv' | 'mp4' | 'avi' | 'mov' | 'webm' | 'm4v';

export interface MovieItem {
  id: string;
  title: string;
  year: number;
  durationMin: number;
  durationFormatted: string; // e.g. "2h 5m"
  genres: string[];
  rating: string; // "G", "PG", "PG-13", "R", "TV-PG"
  synopsis: string;
  curatorNote: string; // Personal note from uncle/aunt to niece
  director: string;
  cast: string[];
  relativeFilePath: string; // e.g. "Movies/Spirited_Away_2001.mkv"
  fileFormat: VideoFormat;
  fileSizeFormatted?: string; // e.g. "4.8 GB"
  resolution?: string; // e.g. "1080p Blu-ray"
  audioTracks?: string; // e.g. "English 5.1 / Japanese Original"
  subtitles?: string; // e.g. "English (SDH), English"
  hasEnglishSubtitles?: boolean; // Tag for whether the video has English subtitles
  posterUrl: string;
  backdropUrl: string;
  mood?: string;
  isFavorite?: boolean;
  isWatched?: boolean;
  userRating?: number; // 1-5 stars if niece wants to rate it
  sampleVideoUrl?: string; // optional fallback/trailer video
}

export interface DriveGiftConfig {
  nieceName: string;
  curatorName: string;
  driveTitle: string;
  welcomeMessage: string;
  giftOccasion: string; // e.g. "Birthday Gift", "Christmas / Holiday", "College Care Package", "Just for You"
  themeColor: 'amber' | 'emerald' | 'cyan' | 'rose' | 'violet';
  moviesDirectoryName: string; // default "Movies"
  includePortableVlcGuide: boolean;
  createdDate: string;
}

export type ViewMode = 'theater' | 'curator' | 'export';
