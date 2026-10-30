/**
 * Generates an offline-safe, high-resolution SVG poster data URI.
 * Guarantees that even if your niece has NO internet connection and no image file,
 * a clean, cinema-styled typographic poster is displayed.
 */
export function generateFallbackPosterSvg(
  title: string,
  year: number | string,
  genre = 'Cinema',
  rating = 'PG'
): string {
  const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeGenre = genre.replace(/&/g, '&amp;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#141418" />
        <stop offset="50%" stop-color="#1e1e28" />
        <stop offset="100%" stop-color="#0b0b0e" />
      </linearGradient>
      <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="30%" r="50%">
        <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.15" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0" />
      </radialGradient>
    </defs>
    
    <rect width="600" height="900" fill="url(#bg)" />
    <circle cx="300" cy="300" r="300" fill="url(#glow)" />
    
    <!-- Outer film frame border -->
    <rect x="25" y="25" width="550" height="850" fill="none" stroke="#2d2d3c" stroke-width="2" rx="12" />
    <rect x="35" y="35" width="530" height="830" fill="none" stroke="#f59e0b" stroke-opacity="0.2" stroke-width="1" rx="8" />
    
    <!-- Top badge -->
    <text x="300" y="85" text-anchor="middle" fill="#f59e0b" font-family="-apple-system, sans-serif" font-size="14" font-weight="700" letter-spacing="4">
      FEATURE FILM ARCHIVE
    </text>
    
    <!-- Center Cinema Icon -->
    <g transform="translate(260, 220)">
      <circle cx="40" cy="40" r="50" fill="#181822" stroke="#f59e0b" stroke-width="2" />
      <path d="M30 25 L60 40 L30 55 Z" fill="#f59e0b" />
    </g>
    
    <!-- Main Title -->
    <text x="300" y="440" text-anchor="middle" fill="#ffffff" font-family="-apple-system, sans-serif" font-size="34" font-weight="800" letter-spacing="-0.5">
      ${safeTitle}
    </text>
    
    <!-- Metadata -->
    <text x="300" y="490" text-anchor="middle" fill="#9ca3af" font-family="-apple-system, sans-serif" font-size="18" font-weight="500">
      ${year} · ${safeGenre} · ${rating}
    </text>
    
    <!-- Film reel accent line -->
    <line x1="150" y1="540" x2="450" y2="540" stroke="#f59e0b" stroke-opacity="0.3" stroke-width="1.5" />
    
    <!-- Bottom Branding -->
    <text x="300" y="820" text-anchor="middle" fill="#6b7280" font-family="-apple-system, sans-serif" font-size="13" font-weight="600" letter-spacing="2">
      OFFLINE HARD DRIVE EDITION
    </text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Useful quick search URLs to source official theatrical posters.
 */
export function getPosterSearchUrls(movieTitle: string, year?: number) {
  const query = encodeURIComponent(`${movieTitle} ${year || ''} movie poster`);
  return {
    tmdb: `https://www.themoviedb.org/search?query=${encodeURIComponent(movieTitle)}`,
    imdb: `https://www.imdb.com/find/?q=${encodeURIComponent(movieTitle)}`,
    google: `https://www.google.com/search?tbm=isch&q=${query}`,
    tpdb: `https://theposterdb.com/search?term=${encodeURIComponent(movieTitle)}`,
  };
}
