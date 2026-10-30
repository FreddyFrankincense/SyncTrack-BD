import { MovieItem } from '../types/movie';

export interface DownloadedCover {
  movieId: string;
  fileName: string; // e.g. "Spirited_Away_2001.jpg"
  localRelativePath: string; // e.g. "Covers/Spirited_Away_2001.jpg"
  base64: string;
  mimeType: string;
  byteLength: number;
  sourceUrl: string;
  sourceType: 'tmdb' | 'theatrical_archive' | 'custom';
  isVerified: boolean; // Confirmed non-blank and non-corrupted
  savedAt: string;
}

/**
 * Validates that an image is genuinely non-blank and non-corrupted.
 * Checks for minimum byte size (> 1KB) and valid image magic bytes.
 */
export function isValidNonCorruptedCover(cover?: Partial<DownloadedCover> | null): boolean {
  if (!cover) return false;
  if (!cover.base64 || typeof cover.base64 !== 'string') return false;

  // Minimum size check (1KB base64 is ~1365 characters; blank/stubs are tiny)
  if (cover.base64.length < 1000) return false;
  if (cover.byteLength && cover.byteLength < 1024) return false;

  // Content type check
  if (cover.mimeType && !cover.mimeType.startsWith('image/')) return false;

  // Check valid image magic byte headers in base64:
  // JPEG starts with '/9j/'
  // PNG starts with 'iVBORw0KGgo'
  // WebP starts with 'UklGR'
  const isJpeg = cover.base64.startsWith('/9j/');
  const isPng = cover.base64.startsWith('iVBORw0KGgo');
  const isWebp = cover.base64.startsWith('UklGR');

  return isJpeg || isPng || isWebp;
}

/**
 * Searches TMDB (with automatic fallback to film archive) for a film's official cover
 */
export async function searchTmdbPoster(
  title: string,
  year?: number,
  apiKey?: string,
  excludeUrls: string[] = []
) {
  const res = await fetch('/api/tmdb/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, year, apiKey, excludeUrls }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Could not find poster for ${title}`);
  }

  return await res.json();
}

/**
 * Downloads poster image binary via server proxy with integrity verification
 */
export async function downloadPosterBinary(imageUrl: string): Promise<{
  base64: string;
  contentType: string;
  byteLength: number;
  isValid: boolean;
  dataUrl: string;
}> {
  const res = await fetch('/api/tmdb/download-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageUrl }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to download image or image is corrupted/blank');
  }

  const data = await res.json();
  if (!data.isValid || !data.base64 || data.byteLength < 1024) {
    throw new Error('Downloaded image failed integrity check (corrupted or blank image)');
  }

  return data;
}

/**
 * Clean a film title for safe filename generation
 */
export function getSafeCoverFileName(
  title: string,
  year?: number,
  ext = 'jpg',
  variant?: number | string
): string {
  const cleanTitle = title
    .replace(/[^\w\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '_');
  const yearSuffix = year ? `_${year}` : '';
  const variantSuffix = variant !== undefined ? `_v${variant}` : '';
  return `${cleanTitle}${yearSuffix}${variantSuffix}.${ext}`;
}

/**
 * Pulls a single movie's cover from TMDB and downloads the image.
 * If existing verified cover already exists, no search is made!
 */
export async function pullMovieCoverFromTmdb(
  movie: MovieItem,
  apiKey?: string,
  existingCover?: DownloadedCover | null
): Promise<DownloadedCover> {
  // RULE: If a non-blank, non-corrupted image is already saved, make NO further search or update attempts!
  if (existingCover && isValidNonCorruptedCover(existingCover)) {
    return existingCover;
  }

  // 1. Search TMDB
  const searchResult = await searchTmdbPoster(movie.title, movie.year, apiKey);
  const posterUrl = searchResult.posterUrl;

  // 2. Download and verify image binary
  const binary = await downloadPosterBinary(posterUrl);
  const ext = binary.contentType.includes('png') ? 'png' : binary.contentType.includes('webp') ? 'webp' : 'jpg';
  const fileName = getSafeCoverFileName(movie.title, movie.year, ext);

  const downloadedCover: DownloadedCover = {
    movieId: movie.id,
    fileName,
    localRelativePath: `Covers/${fileName}`,
    base64: binary.base64,
    mimeType: binary.contentType,
    byteLength: binary.byteLength,
    sourceUrl: posterUrl,
    sourceType: searchResult.source || 'tmdb',
    isVerified: true,
    savedAt: new Date().toISOString(),
  };

  // Final sanity check before saving
  if (!isValidNonCorruptedCover(downloadedCover)) {
    throw new Error('Retrieved image was blank or corrupted; search aborted without saving.');
  }

  return downloadedCover;
}

/**
 * Deletes the currently used cover image and forces the app to query TMDB / archives
 * for a suitable replacement image that is STRICTLY NOT the image just deleted.
 * Once found and verified non-blank/non-corrupted, it saves it and locks it.
 */
export async function deleteAndReplaceMovieCover(
  movie: MovieItem,
  currentCover?: DownloadedCover | null,
  apiKey?: string,
  previousExcludedUrls: string[] = []
): Promise<{
  newCover: DownloadedCover;
  updatedExcludedUrls: string[];
}> {
  // 1. Compile all URLs that must NOT be reused
  const exclusions = new Set<string>(previousExcludedUrls);
  if (currentCover?.sourceUrl) {
    exclusions.add(currentCover.sourceUrl);
  }
  if (movie.posterUrl && movie.posterUrl.startsWith('http')) {
    exclusions.add(movie.posterUrl);
  }

  const excludeList = Array.from(exclusions);

  // 2. Force search TMDB for an alternate poster excluding the deleted URL(s)
  const searchResult = await searchTmdbPoster(movie.title, movie.year, apiKey, excludeList);
  const candidateUrl = searchResult.posterUrl;

  if (!candidateUrl) {
    throw new Error(`No replacement cover could be found on TMDB for "${movie.title}".`);
  }

  // Strict double check: verify candidateUrl is not in the exclusions list
  if (excludeList.some((exc) => exc === candidateUrl || exc.includes(candidateUrl))) {
    throw new Error(`TMDB only returned the previously deleted cover image. No new alternate poster available.`);
  }

  // 3. Download and verify replacement binary
  const binary = await downloadPosterBinary(candidateUrl);
  const ext = binary.contentType.includes('png') ? 'png' : binary.contentType.includes('webp') ? 'webp' : 'jpg';

  // Suffix variant counter so local file path is distinct
  const variantIndex = excludeList.length + 1;
  const fileName = getSafeCoverFileName(movie.title, movie.year, ext, variantIndex);

  const newCover: DownloadedCover = {
    movieId: movie.id,
    fileName,
    localRelativePath: `Covers/${fileName}`,
    base64: binary.base64,
    mimeType: binary.contentType,
    byteLength: binary.byteLength,
    sourceUrl: candidateUrl,
    sourceType: searchResult.source || 'tmdb',
    isVerified: true,
    savedAt: new Date().toISOString(),
  };

  if (!isValidNonCorruptedCover(newCover)) {
    throw new Error('The new replacement image failed integrity checks (blank or corrupted).');
  }

  // Add new image URL to exclusions list for this movie going forward so user can cycle again if desired
  const updatedExcludedUrls = [...excludeList, candidateUrl];

  return { newCover, updatedExcludedUrls };
}

/**
 * Batch pulls covers for movies from TMDB.
 * STRICT RULE: If a movie already has a valid, non-blank, non-corrupted cover,
 * it is permanently locked: NO search or network request is attempted for it!
 */
export async function batchPullAllCovers(
  movies: MovieItem[],
  existingCovers: Record<string, DownloadedCover> = {},
  apiKey?: string,
  onProgress?: (
    index: number,
    total: number,
    currentMovie: MovieItem,
    result?: DownloadedCover,
    err?: string,
    isSkipped?: boolean
  ) => void
): Promise<{
  updatedMovies: MovieItem[];
  coversMap: Record<string, DownloadedCover>;
  successCount: number;
  skippedCount: number;
  failCount: number;
}> {
  const coversMap: Record<string, DownloadedCover> = { ...existingCovers };
  const updatedMovies: MovieItem[] = [];
  let successCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (let i = 0; i < movies.length; i++) {
    const movie = movies[i];
    const existing = existingCovers[movie.id];

    // CHECK IF EXISTING COVER IS VALID, NON-BLANK, AND NON-CORRUPTED
    if (existing && isValidNonCorruptedCover(existing)) {
      // PRESERVE AND MAKE NO FURTHER ATTEMPTS AT SEARCHING OR UPDATING
      coversMap[movie.id] = existing;
      updatedMovies.push({
        ...movie,
        posterUrl: existing.localRelativePath,
      });
      skippedCount++;

      if (onProgress) {
        onProgress(i + 1, movies.length, movie, existing, undefined, true /* isSkipped */);
      }
      continue;
    }

    // Otherwise, movie needs a cover: proceed with search and download
    if (onProgress) onProgress(i, movies.length, movie);

    try {
      const cover = await pullMovieCoverFromTmdb(movie, apiKey, null);
      coversMap[movie.id] = cover;
      successCount++;

      // Update movie's posterUrl to point to local Covers/ path for 100% offline playback
      updatedMovies.push({
        ...movie,
        posterUrl: cover.localRelativePath,
      });

      if (onProgress) onProgress(i + 1, movies.length, movie, cover, undefined, false);
    } catch (err: any) {
      console.warn(`Failed to pull TMDB cover for ${movie.title}:`, err);
      failCount++;
      // Keep existing movie posterUrl
      updatedMovies.push(movie);
      if (onProgress) onProgress(i + 1, movies.length, movie, undefined, err.message, false);
    }
  }

  return { updatedMovies, coversMap, successCount, skippedCount, failCount };
}
