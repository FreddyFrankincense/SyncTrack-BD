import JSZip from 'jszip';
import { DriveGiftConfig, MovieItem } from '../types/movie';
import { DownloadedCover } from './tmdbService';

/**
 * Generates an entirely self-contained, 100% offline single-file HTML5 GUI
 * that can be double-clicked directly on the external hard drive without internet or any server.
 */
export function generateStandaloneHtml(
  movies: MovieItem[],
  config: DriveGiftConfig,
  coversMap?: Record<string, DownloadedCover>
): string {
  // Ensure movies reference the local Covers/ directory if downloaded
  const preparedMovies = movies.map((m) => {
    if (coversMap && coversMap[m.id]) {
      return { ...m, posterUrl: `Covers/${coversMap[m.id].fileName}` };
    }
    return m;
  });

  const serializedMovies = JSON.stringify(preparedMovies, null, 2);
  const serializedConfig = JSON.stringify(config, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(config.driveTitle)} - Movie Menu</title>
  <style>
    :root {
      --bg-dark: #0a0a0c;
      --card-bg: #141418;
      --card-border: #23232b;
      --text-main: #f3f4f6;
      --text-muted: #9ca3af;
      --accent: #f59e0b;
      --accent-hover: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    header {
      background: linear-gradient(180deg, rgba(20,20,24,0.95) 0%, rgba(10,10,12,0.85) 100%);
      border-bottom: 1px solid var(--card-border);
      padding: 1.25rem 2rem;
      position: sticky;
      top: 0;
      z-index: 40;
      backdrop-filter: blur(12px);
    }
    .header-inner {
      max-width: 1400px;
      margin: 0 auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
    }
    .logo-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .cinema-icon {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #f59e0b, #ef4444);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
    }
    h1 {
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }
    .subhead {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
    }
    .search-input {
      background: #18181f;
      border: 1px solid #2d2d38;
      color: #fff;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.875rem;
      width: 240px;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--accent);
    }
    .gift-letter-btn {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
      padding: 0.5rem 1rem;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      transition: all 0.2s;
    }
    .gift-letter-btn:hover {
      background: rgba(245, 158, 11, 0.2);
    }
    .hero-banner {
      max-width: 1400px;
      margin: 1.5rem auto 0;
      padding: 0 2rem;
      width: 100%;
    }
    .hero-card {
      background: linear-gradient(90deg, #18181f 0%, #111116 100%);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 2rem;
      display: flex;
      gap: 2rem;
      align-items: center;
      box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .hero-poster {
      width: 180px;
      height: 260px;
      border-radius: 8px;
      object-fit: cover;
      flex-shrink: 0;
      box-shadow: 0 10px 25px rgba(0,0,0,0.7);
    }
    .hero-details {
      flex: 1;
    }
    .hero-title {
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      color: #9ca3af;
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }
    .hero-synopsis {
      font-size: 1rem;
      line-height: 1.6;
      color: #d1d5db;
      margin-bottom: 1.25rem;
      max-width: 800px;
    }
    .curator-box {
      background: rgba(245, 158, 11, 0.08);
      border-left: 3px solid #f59e0b;
      padding: 0.75rem 1rem;
      border-radius: 0 6px 6px 0;
      font-size: 0.875rem;
      color: #fef3c7;
      margin-bottom: 1.25rem;
      max-width: 800px;
    }
    .btn-play {
      background: #f59e0b;
      color: #000;
      font-weight: 700;
      padding: 0.65rem 1.5rem;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 0.95rem;
      transition: background 0.2s;
    }
    .btn-play:hover { background: #d97706; }
    .filter-bar {
      max-width: 1400px;
      margin: 2rem auto 1rem;
      padding: 0 2rem;
      display: flex;
      gap: 0.5rem;
      overflow-x: auto;
      width: 100%;
    }
    .filter-chip {
      background: #18181f;
      border: 1px solid #2d2d38;
      color: #9ca3af;
      padding: 0.4rem 0.85rem;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }
    .filter-chip.active, .filter-chip:hover {
      background: #272732;
      color: #fff;
      border-color: #4b5563;
    }
    .movie-grid {
      max-width: 1400px;
      margin: 0 auto;
      padding: 1rem 2rem 4rem;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1.5rem;
      width: 100%;
    }
    .movie-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
      display: flex;
      flex-direction: column;
    }
    .movie-card:hover {
      transform: translateY(-4px);
      border-color: #3b3b48;
      box-shadow: 0 12px 24px rgba(0,0,0,0.5);
    }
    .card-thumb-wrap {
      position: relative;
      width: 100%;
      height: 310px;
      background: #1e1e24;
      overflow: hidden;
    }
    .card-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .format-pill {
      position: absolute;
      top: 8px;
      left: 8px;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255,255,255,0.15);
      color: #f3f4f6;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .card-body {
      padding: 1rem;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .card-title {
      font-weight: 700;
      font-size: 1rem;
      line-height: 1.3;
      margin-bottom: 0.35rem;
      color: #f9fafb;
    }
    .card-meta {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-bottom: 0.6rem;
      display: flex;
      align-items: center;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .card-synopsis {
      font-size: 0.8rem;
      color: #d1d5db;
      line-height: 1.4;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      margin-bottom: 0.75rem;
      flex: 1;
    }
    .card-footer {
      border-top: 1px solid #1f1f26;
      padding-top: 0.65rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
    }
    .btn-quick-play {
      background: transparent;
      border: 1px solid #374151;
      color: #e5e7eb;
      padding: 0.3rem 0.6rem;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.75rem;
    }
    .btn-quick-play:hover {
      background: var(--accent);
      color: #000;
      border-color: var(--accent);
    }
    /* Modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1rem;
    }
    .modal-content {
      background: #141418;
      border: 1px solid #2d2d38;
      border-radius: 12px;
      max-width: 800px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      box-shadow: 0 25px 50px rgba(0,0,0,0.8);
    }
    .modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: #1f1f26;
      border: none;
      color: #9ca3af;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 1.1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
    }
    .modal-close:hover { color: #fff; background: #374151; }
    .video-player-box {
      width: 100%;
      background: #000;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      overflow: hidden;
    }
    video {
      width: 100%;
      max-height: 450px;
      display: block;
    }
    .launch-help-box {
      background: #1a1a24;
      border: 1px solid #2c2c3e;
      border-radius: 8px;
      padding: 1rem;
      margin-top: 1rem;
      font-size: 0.85rem;
    }
    .launch-help-box code {
      background: #0f0f14;
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      color: #fbbf24;
      font-family: monospace;
    }
  </style>
</head>
<body>

  <header>
    <div class="header-inner">
      <div class="logo-group">
        <div class="cinema-icon">🎬</div>
        <div>
          <h1>${escapeHtml(config.driveTitle)}</h1>
          <div class="subhead">Curated with love by ${escapeHtml(config.curatorName)} for ${escapeHtml(config.nieceName)}</div>
        </div>
      </div>
      <div class="controls">
        <input type="text" id="searchInput" class="search-input" placeholder="Search by title, genre, year...">
        <button id="giftLetterBtn" class="gift-letter-btn">
          <span>💌</span> Read Gift Letter
        </button>
      </div>
    </div>
  </header>

  <div class="hero-banner" id="heroBanner"></div>

  <div class="filter-bar" id="filterBar"></div>

  <main class="movie-grid" id="movieGrid"></main>

  <!-- Detail / Play Modal -->
  <div class="modal-backdrop" id="movieModal">
    <div class="modal-content" id="modalContent" style="padding: 2rem;"></div>
  </div>

  <!-- Gift Letter Modal -->
  <div class="modal-backdrop" id="letterModal">
    <div class="modal-content" style="padding: 2.5rem; max-width: 650px;">
      <button class="modal-close" onclick="closeLetterModal()">&times;</button>
      <div style="font-size: 2.5rem; margin-bottom: 0.5rem; text-align: center;">🎁</div>
      <h2 style="font-size: 1.6rem; text-align: center; margin-bottom: 0.25rem;">For ${escapeHtml(config.nieceName)}</h2>
      <div style="text-align: center; color: #9ca3af; font-size: 0.85rem; margin-bottom: 1.5rem;">${escapeHtml(config.giftOccasion)}</div>
      <div style="background: #181820; border: 1px solid #2d2d38; padding: 1.5rem; border-radius: 8px; line-height: 1.7; font-size: 0.95rem; color: #e5e7eb; white-space: pre-line; margin-bottom: 1.5rem;">
${escapeHtml(config.welcomeMessage)}
      </div>
      <div style="text-align: center;">
        <button class="btn-play" onclick="closeLetterModal()">Start Watching Movies 🍿</button>
      </div>
    </div>
  </div>

  <script>
    const MOVIES = ${serializedMovies};
    const CONFIG = ${serializedConfig};

    let selectedFilter = 'All';
    let searchQuery = '';
    let currentHeroIndex = 0;

    function renderHero(movie) {
      if (!movie) return;
      const heroEl = document.getElementById('heroBanner');
      heroEl.innerHTML = \`
        <div class="hero-card">
          <img src="\${movie.posterUrl}" class="hero-poster" alt="\${movie.title}">
          <div class="hero-details">
            <div class="card-meta">
              <span style="color: #fbbf24; font-weight: 600;">\${movie.rating}</span>
              <span>·</span>
              <span>\${movie.durationFormatted}</span>
              <span>·</span>
              <span>\${movie.year}</span>
              <span>·</span>
              <span>\${movie.genres.join(', ')}</span>
              <span>·</span>
              <span style="text-transform: uppercase; background: #262633; padding: 1px 6px; border-radius: 4px;">\${movie.fileFormat}</span>
            </div>
            <h2 class="hero-title">\${movie.title}</h2>
            <p class="hero-synopsis">\${movie.synopsis}</p>
            \${movie.curatorNote ? \`
              <div class="curator-box">
                <strong>Why \${CONFIG.curatorName} chose this for you:</strong>
                <p style="margin-top: 0.25rem;">\${movie.curatorNote}</p>
              </div>
            \` : ''}
            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <button class="btn-play" onclick="openMovieModal('\${movie.id}')">▶ Watch / Open Info</button>
              <span style="color: #6b7280; font-size: 0.8rem;">Path: <code>\${movie.relativeFilePath}</code></span>
            </div>
          </div>
        </div>
      \`;
    }

    function renderFilters() {
      const allGenres = new Set();
      MOVIES.forEach(m => m.genres.forEach(g => allGenres.add(g)));
      const filterBar = document.getElementById('filterBar');
      
      const filters = ['All', 'Favorites', ...Array.from(allGenres).slice(0, 8)];
      filterBar.innerHTML = filters.map(f => \`
        <button class="filter-chip \${selectedFilter === f ? 'active' : ''}" onclick="setFilter('\${f}')">\${f}</button>
      \`).join('');
    }

    function setFilter(filter) {
      selectedFilter = filter;
      renderFilters();
      renderGrid();
    }

    function renderGrid() {
      const grid = document.getElementById('movieGrid');
      const q = searchQuery.toLowerCase().trim();

      const filtered = MOVIES.filter(m => {
        const matchesQuery = !q || m.title.toLowerCase().includes(q) || m.genres.some(g => g.toLowerCase().includes(q)) || String(m.year).includes(q);
        const matchesFilter = selectedFilter === 'All' ? true : (selectedFilter === 'Favorites' ? m.isFavorite : m.genres.includes(selectedFilter));
        return matchesQuery && matchesFilter;
      });

      if (filtered.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 4rem; color: #9ca3af;">No movies match your search. Try adjusting filters!</div>';
        return;
      }

      grid.innerHTML = filtered.map(m => \`
        <div class="movie-card" onclick="openMovieModal('\${m.id}')">
          <div class="card-thumb-wrap">
            <img src="\${m.posterUrl}" class="card-thumb" alt="\${m.title}">
            <div class="format-pill">.\${m.fileFormat}</div>
          </div>
          <div class="card-body">
            <h3 class="card-title">\${m.title}</h3>
            <div class="card-meta">
              <span>\${m.year}</span>
              <span>·</span>
              <span>\${m.durationFormatted}</span>
              <span>·</span>
              <span>\${m.rating}</span>
            </div>
            <p class="card-synopsis">\${m.synopsis}</p>
            <div class="card-footer">
              <span style="color: #9ca3af; font-size: 0.7rem;">\${m.genres[0] || 'Film'}</span>
              <button class="btn-quick-play" onclick="event.stopPropagation(); openMovieModal('\${m.id}')">View Details & Play</button>
            </div>
          </div>
        </div>
      \`).join('');
    }

    function openMovieModal(id) {
      const movie = MOVIES.find(m => m.id === id);
      if (!movie) return;
      const modal = document.getElementById('movieModal');
      const content = document.getElementById('modalContent');

      content.innerHTML = \`
        <button class="modal-close" onclick="closeMovieModal()">&times;</button>
        <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
          <img src="\${movie.posterUrl}" style="width: 140px; height: 200px; object-fit: cover; border-radius: 8px;" alt="\${movie.title}">
          <div style="flex: 1; min-width: 250px;">
            <div class="card-meta" style="margin-bottom: 0.25rem;">
              <span style="color: #fbbf24; font-weight: 600;">\${movie.rating}</span>
              <span>·</span>
              <span>\${movie.year}</span>
              <span>·</span>
              <span>\${movie.durationFormatted}</span>
              <span>·</span>
              <span style="text-transform: uppercase;">\${movie.fileFormat}</span>
            </div>
            <h2 style="font-size: 1.8rem; font-weight: 800; margin-bottom: 0.5rem;">\${movie.title}</h2>
            <div style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 0.75rem;">
              Director: \${movie.director || 'N/A'} · Cast: \${(movie.cast || []).slice(0, 3).join(', ')}
            </div>
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              \${movie.genres.map(g => \`<span style="background: #1f1f26; border: 1px solid #2d2d38; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: #d1d5db;">\${g}</span>\`).join('')}
            </div>
          </div>
        </div>

        <div style="background: #181820; border: 1px solid #282834; padding: 1rem 1.25rem; border-radius: 8px; margin-bottom: 1.25rem;">
          <h4 style="color: #f3f4f6; font-size: 0.9rem; margin-bottom: 0.35rem; font-weight: 600;">Synopsis</h4>
          <p style="color: #d1d5db; font-size: 0.9rem; line-height: 1.6;">\${movie.synopsis}</p>
        </div>

        \${movie.curatorNote ? \`
          <div class="curator-box" style="margin-bottom: 1.5rem;">
            <strong>💌 A note from \${CONFIG.curatorName}:</strong>
            <p style="margin-top: 0.35rem; font-size: 0.9rem; line-height: 1.5;">\${movie.curatorNote}</p>
          </div>
        \` : ''}

        <!-- Playback / File Launch section -->
        <div style="background: #101015; border: 1px solid #272733; border-radius: 8px; padding: 1.25rem;">
          <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>▶️</span> Movie Playback Options
          </h4>
          <p style="color: #9ca3af; font-size: 0.85rem; margin-bottom: 1rem;">
            File on this drive: <code>\${movie.relativeFilePath}</code> (\${movie.fileSizeFormatted || 'Full HD'})
          </p>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            \${movie.sampleVideoUrl ? \`
              <button class="btn-play" onclick="document.getElementById('videoSection').style.display = 'block';">
                Preview In-Browser Player
              </button>
            \` : ''}
            <a href="\${movie.relativeFilePath}" class="btn-play" style="text-decoration: none; display: inline-block;" download>
              Open Direct File
            </a>
          </div>

          <div id="videoSection" class="video-player-box" style="display: none; margin-top: 1rem;">
            <video controls src="\${movie.sampleVideoUrl || movie.relativeFilePath}"></video>
          </div>

          <div class="launch-help-box">
            <strong>💡 How to watch this .\${movie.fileFormat} movie on your computer:</strong>
            <ul style="margin-top: 0.5rem; margin-left: 1.25rem; line-height: 1.6; color: #cbd5e1;">
              <li><strong>Easiest:</strong> Open your hard drive folder and double click the movie file directly in <code>\${movie.relativeFilePath}</code>.</li>
              <li><strong>Recommended Player:</strong> VLC Media Player plays every .mkv and .mp4 flawlessly with surround sound and subtitle toggles!</li>
              <li><strong>Windows Shortcut:</strong> Use the <code>Start_Movie_Menu.bat</code> or <code>Open_Movie_Menu.hta</code> launcher included in this drive's main folder.</li>
            </ul>
          </div>
        </div>
      \`;

      modal.style.display = 'flex';
    }

    function closeMovieModal() {
      document.getElementById('movieModal').style.display = 'none';
      const video = document.querySelector('#movieModal video');
      if (video) video.pause();
    }

    function openLetterModal() {
      document.getElementById('letterModal').style.display = 'flex';
    }

    function closeLetterModal() {
      document.getElementById('letterModal').style.display = 'none';
    }

    document.getElementById('searchInput').addEventListener('input', e => {
      searchQuery = e.target.value;
      renderGrid();
    });

    document.getElementById('giftLetterBtn').addEventListener('click', openLetterModal);

    // Initial render
    renderHero(MOVIES[0]);
    renderFilters();
    renderGrid();
  </script>
</body>
</html>`;
}

/**
 * Windows HTA (HTML Application) Native Desktop Executable
 * Running .hta on Windows executes as a native desktop application with window borders and shell execution.
 */
export function generateWindowsHta(
  movies: MovieItem[],
  config: DriveGiftConfig,
  coversMap?: Record<string, DownloadedCover>
): string {
  const preparedMovies = movies.map((m) => {
    if (coversMap && coversMap[m.id]) {
      return { ...m, posterUrl: `Covers/${coversMap[m.id].fileName}` };
    }
    return m;
  });

  const jsonCatalog = JSON.stringify(preparedMovies).replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${config.driveTitle} - Executable Menu</title>
  <HTA:APPLICATION 
    ID="CineDriveLauncher"
    APPLICATIONNAME="${config.driveTitle}"
    BORDER="thin"
    BORDERSTYLE="normal"
    CAPTION="yes"
    ICON="movie.ico"
    MAXIMIZEBUTTON="yes"
    MINIMIZEBUTTON="yes"
    SHOWINTASKBAR="yes"
    SINGLEINSTANCE="yes"
    SYSMENU="yes"
    WINDOWSTATE="maximize"
    NAVIGABLE="yes"
  />
  <style>
    body {
      background-color: #0b0c10;
      color: #c5c6c7;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 20px;
    }
    .header {
      background: #1f2833;
      padding: 15px 25px;
      border-radius: 8px;
      margin-bottom: 25px;
      border-bottom: 2px solid #66fcf1;
    }
    h1 { color: #66fcf1; margin: 0 0 5px 0; font-size: 24px; }
    p { margin: 0; color: #8892b0; font-size: 13px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 20px;
    }
    .card {
      background: #1f2833;
      border: 1px solid #2b394a;
      border-radius: 8px;
      padding: 15px;
    }
    .title { color: #ffffff; font-size: 16px; font-weight: bold; margin-bottom: 5px; }
    .meta { font-size: 12px; color: #45a29e; margin-bottom: 8px; }
    .synopsis { font-size: 12px; line-height: 1.4; color: #c5c6c7; margin-bottom: 12px; height: 50px; overflow: hidden; }
    .btn-launch {
      background: #45a29e;
      color: #0b0c10;
      font-weight: bold;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      width: 100%;
    }
    .btn-launch:hover { background: #66fcf1; }
  </style>
  <script type="text/javascript">
    function launchMovie(relativePath) {
      try {
        var shell = new ActiveXObject("WScript.Shell");
        // Try launching via default player or explorer
        shell.Run('"' + relativePath + '"');
      } catch(e) {
        alert("Launching via default player. File path: " + relativePath + "\\nError: " + e.message);
      }
    }
    function openWebMenu() {
      try {
        var shell = new ActiveXObject("WScript.Shell");
        shell.Run("index.html");
      } catch(e) {
        window.location.href = "index.html";
      }
    }
  </script>
</head>
<body>
  <div class="header">
    <h1>🎬 ${config.driveTitle}</h1>
    <p>A gift for ${config.nieceName} from ${config.curatorName} · Windows Native Executable Menu</p>
    <div style="margin-top: 10px;">
      <button onclick="openWebMenu()" style="background:#66fcf1; color:#0b0c10; border:none; padding:6px 14px; border-radius:4px; font-weight:bold; cursor:pointer;">
        Open Interactive Web Menu
      </button>
    </div>
  </div>

  <div class="grid">
    ${movies
      .map(
        (m) => `
      <div class="card">
        <div class="title">${escapeHtml(m.title)} (${m.year})</div>
        <div class="meta">${escapeHtml(m.genres.join(', '))} · ${escapeHtml(m.durationFormatted)} · ${m.rating}</div>
        <div class="synopsis">${escapeHtml(m.synopsis)}</div>
        <button class="btn-launch" onclick="launchMovie('${m.relativeFilePath.replace(/'/g, "\\'")}')">
          ▶ Play Movie (${m.fileFormat.toUpperCase()})
        </button>
      </div>
    `
      )
      .join('\n')}
  </div>
</body>
</html>`;
}

/**
 * Windows 1-Click Batch Launcher (.bat)
 */
export function generateWindowsBatch(config: DriveGiftConfig): string {
  return `@echo off
chcp 65001 >nul
title ${config.driveTitle} - Launcher
color 0E
cls
echo =========================================================================
echo   ${config.driveTitle}
echo   Curated for ${config.nieceName} with love by ${config.curatorName}
echo =========================================================================
echo.
echo   [1] Launch Full Interactive Movie Menu (Recommended - Any Browser)
echo   [2] Launch Windows Native Menu (Open_Movie_Menu.hta)
echo   [3] Open Movies Folder in File Explorer
echo   [4] Read Uncle's Gift Letter
echo   [5] Exit
echo.
echo =========================================================================

set /p choice="Enter your choice [1-5] (default is 1): "
if "%choice%"=="" set choice=1
if "%choice%"=="1" goto launch_web
if "%choice%"=="2" goto launch_hta
if "%choice%"=="3" goto open_folder
if "%choice%"=="4" goto read_letter
if "%choice%"=="5" goto exit

:launch_web
echo.
echo Opening Movie Menu in your default web browser...
start "" "index.html"
goto end

:launch_hta
echo.
echo Opening Windows Native Executable Menu...
if exist "Open_Movie_Menu.hta" (
  start "" "Open_Movie_Menu.hta"
) else (
  start "" "index.html"
)
goto end

:open_folder
echo.
echo Opening Movies folder...
if exist "Movies" (
  explorer "Movies"
) else (
  explorer .
)
goto end

:read_letter
cls
type "README_FOR_NIECE.txt"
echo.
pause
goto end

:end
echo.
echo Enjoy the movies! 🍿
timeout /t 3 >nul
:exit
`;
}

/**
 * macOS 1-Click Command Launcher (.command)
 */
export function generateMacCommand(config: DriveGiftConfig): string {
  return `#!/bin/bash
# Move to the directory containing this launcher (hard drive root)
cd "$(dirname "$0")"

clear
echo "========================================================="
echo "  ${config.driveTitle}"
echo "  Curated for ${config.nieceName} by ${config.curatorName}"
echo "========================================================="
echo ""
echo "Opening your movie menu in Safari/Chrome..."

# Open the standalone offline movie menu
open "index.html"

echo "Done! Have fun with movie night! 🍿"
`;
}

/**
 * Linux Launcher (.sh)
 */
export function generateLinuxScript(config: DriveGiftConfig): string {
  return `#!/usr/bin/env bash
SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
cd "$SCRIPT_DIR"

if command -v xdg-open > /dev/null; then
  xdg-open "index.html"
elif command -v gnome-open > /dev/null; then
  gnome-open "index.html"
else
  echo "Please open index.html in your web browser."
fi
`;
}

/**
 * autorun.inf (for Windows autoplay & custom drive icon)
 */
export function generateAutorunInf(config: DriveGiftConfig): string {
  return `[AutoRun]
open=Start_Movie_Menu.bat
icon=movie.ico,0
label=${config.driveTitle.replace(/[^\w\s-]/gi, '').trim().slice(0, 32)}
action=Open ${config.nieceName}'s Movie Menu
`;
}

/**
 * README_FOR_NIECE.txt
 */
export function generateNieceReadme(movies: MovieItem[], config: DriveGiftConfig): string {
  const movieListStr = movies
    .map(
      (m, i) =>
        `${i + 1}. ${m.title} (${m.year}) [${m.durationFormatted} | ${m.rating} | .${m.fileFormat.toUpperCase()}]\n   Genres: ${m.genres.join(', ')}\n   File: ${m.relativeFilePath}\n   Note: "${m.curatorNote}"\n`
    )
    .join('\n');

  return `================================================================================
  🎬 ${config.driveTitle} 🎬
  A Special Gift for: ${config.nieceName}
  From: ${config.curatorName}
  Occasion: ${config.giftOccasion}
================================================================================

${config.welcomeMessage}

--------------------------------------------------------------------------------
HOW TO START THE MOVIE MENU:
--------------------------------------------------------------------------------
This hard drive contains an offline GUI menu with artwork, duration, genres,
dates, and synopses for every movie!

★ ON WINDOWS:
  1. Double-click "Start_Movie_Menu.bat" OR "Open_Movie_Menu.hta"
  2. Or double-click "index.html" (works in Chrome, Edge, Firefox, Brave)

★ ON MAC (APPLE):
  1. Double-click "Start_Movie_Menu.command"
  2. Or double-click "index.html" to open in Safari or Chrome

★ ON LINUX / CHROMEBOOK:
  1. Run "./Start_Movie_Menu.sh" or double-click "index.html"

--------------------------------------------------------------------------------
PLAYING .MKV AND .MP4 MOVIES:
--------------------------------------------------------------------------------
All movie files are located in the "Movies/" folder on this drive.
- .MP4 files play smoothly in any browser and media player.
- .MKV files (Matroska) are high-definition video containers that support
  multiple audio tracks (English / Japanese original) and subtitles!
  If your computer asks which app to play .mkv files with, we recommend VLC:
  https://www.videolan.org/vlc/ (Free, open-source, plays everything!).

--------------------------------------------------------------------------------
YOUR MOVIE COLLECTION LIST:
--------------------------------------------------------------------------------
${movieListStr}

Enjoy the movies! Grab some popcorn and have a blast! 🍿🍿🍿
`;
}

/**
 * Generate a complete downloadable ZIP containing the full Hard Drive starter kit!
 */
export async function generateHardDriveZip(
  movies: MovieItem[],
  config: DriveGiftConfig,
  coversMap?: Record<string, DownloadedCover>
): Promise<Blob> {
  const zip = new JSZip();

  // If coversMap has files, ensure movies point to local Covers/
  const finalMovies = movies.map((m) => {
    if (coversMap && coversMap[m.id]) {
      return { ...m, posterUrl: `Covers/${coversMap[m.id].fileName}` };
    }
    return m;
  });

  // 1. Standalone zero-server offline HTML5 GUI
  const standaloneHtml = generateStandaloneHtml(finalMovies, config, coversMap);
  zip.file('index.html', standaloneHtml);

  // 2. Windows Native Executable HTA
  const htaContent = generateWindowsHta(finalMovies, config, coversMap);
  zip.file('Open_Movie_Menu.hta', htaContent);

  // 3. Windows 1-Click Batch file
  const batContent = generateWindowsBatch(config);
  zip.file('Start_Movie_Menu.bat', batContent);

  // 4. macOS 1-Click Command file
  const macCommand = generateMacCommand(config);
  zip.file('Start_Movie_Menu.command', macCommand);

  // 5. Linux 1-Click Shell script
  const linuxScript = generateLinuxScript(config);
  zip.file('Start_Movie_Menu.sh', linuxScript);

  // 6. Windows autorun.inf
  const autorunInf = generateAutorunInf(config);
  zip.file('autorun.inf', autorunInf);

  // 7. Loving README and instructions
  const readme = generateNieceReadme(finalMovies, config);
  zip.file('README_FOR_NIECE.txt', readme);

  // 8. Raw JSON catalog for portability and backup
  zip.file('movies_catalog.json', JSON.stringify({ config, movies: finalMovies }, null, 2));

  // 9. Root Covers/ directory: save all real downloaded TMDB image binaries!
  const rootCoversFolder = zip.folder('Covers');
  if (coversMap && rootCoversFolder) {
    for (const cover of Object.values(coversMap)) {
      if (cover.base64) {
        rootCoversFolder.file(cover.fileName, cover.base64, { base64: true });
      }
    }
  }

  // 10. Movies directory placeholder & subfolder
  const moviesFolder = zip.folder(config.moviesDirectoryName || 'Movies');
  if (moviesFolder) {
    moviesFolder.file(
      'PLACE_MOVIE_FILES_HERE.txt',
      `Place your movie video files (.mkv, .mp4, etc.) in this folder!\n\nExpected relative file paths:\n${movies.map((m) => '- ' + m.relativeFilePath).join('\n')}\n`
    );

    // Also mirror into Movies/Covers for convenience
    const moviesCoversFolder = moviesFolder.folder('Covers');
    if (moviesCoversFolder) {
      if (coversMap) {
        for (const cover of Object.values(coversMap)) {
          if (cover.base64) {
            moviesCoversFolder.file(cover.fileName, cover.base64, { base64: true });
          }
        }
      }
      moviesCoversFolder.file(
        'README_COVERS.txt',
        `This folder contains all downloaded movie poster artwork.\nFiles can also be placed in the root /Covers folder.\n`
      );
    }
  }

  // Generate ZIP blob
  return await zip.generateAsync({ type: 'blob' });
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
