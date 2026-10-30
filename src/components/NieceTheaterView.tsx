import React, { useState, useMemo } from 'react';
import {
  Play,
  Heart,
  CheckCircle2,
  Sparkles,
  Search,
  Filter,
  Film,
  Info,
  Clock,
  Calendar,
  Layers,
  Dices,
  Volume2,
} from 'lucide-react';
import { DriveGiftConfig, MovieItem } from '../types/movie';
import { generateFallbackPosterSvg } from '../utils/posterHelper';

interface NieceTheaterViewProps {
  movies: MovieItem[];
  config: DriveGiftConfig;
  onSelectMovie: (movie: MovieItem) => void;
  onToggleFavorite: (movieId: string) => void;
  onToggleWatched: (movieId: string) => void;
  onOpenGiftLetter: () => void;
  onDeleteAndReplaceCover?: (movieId: string) => Promise<any> | void;
  isReplacingCoverId?: string | null;
}

export const NieceTheaterView: React.FC<NieceTheaterViewProps> = ({
  movies,
  config,
  onSelectMovie,
  onToggleFavorite,
  onToggleWatched,
  onOpenGiftLetter,
  onDeleteAndReplaceCover,
  isReplacingCoverId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'curator' | 'year-desc' | 'year-asc' | 'duration-asc' | 'title'>('curator');
  const [featuredMovieId, setFeaturedMovieId] = useState<string>(movies[0]?.id || '');
  const [isRollingDice, setIsRollingDice] = useState(false);

  // Extract all unique genres
  const allGenres = useMemo(() => {
    const set = new Set<string>();
    movies.forEach((m) => m.genres.forEach((g) => set.add(g)));
    return Array.from(set).sort();
  }, [movies]);

  // Featured Movie object
  const featuredMovie = useMemo(() => {
    return movies.find((m) => m.id === featuredMovieId) || movies[0];
  }, [movies, featuredMovieId]);

  // Filtered & Sorted movies
  const filteredMovies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    const list = movies.filter((movie) => {
      const matchesSearch =
        !q ||
        movie.title.toLowerCase().includes(q) ||
        movie.synopsis.toLowerCase().includes(q) ||
        movie.genres.some((g) => g.toLowerCase().includes(q)) ||
        String(movie.year).includes(q) ||
        movie.director.toLowerCase().includes(q) ||
        (movie.curatorNote && movie.curatorNote.toLowerCase().includes(q));

      const matchesGenre =
        selectedGenre === 'All'
          ? true
          : selectedGenre === 'Favorites'
          ? movie.isFavorite
          : selectedGenre === 'CC Eng Subs'
          ? movie.hasEnglishSubtitles
          : selectedGenre === 'Under 2h'
          ? movie.durationMin < 120
          : selectedGenre === 'Watched'
          ? movie.isWatched
          : movie.genres.includes(selectedGenre);

      return matchesSearch && matchesGenre;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'year-desc') return b.year - a.year;
      if (sortBy === 'year-asc') return a.year - b.year;
      if (sortBy === 'duration-asc') return a.durationMin - b.durationMin;
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      return 0; // default curator order
    });
  }, [movies, searchQuery, selectedGenre, sortBy]);

  // Pick random movie
  const handleSurpriseMe = () => {
    if (movies.length === 0) return;
    setIsRollingDice(true);
    let counter = 0;
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * movies.length);
      setFeaturedMovieId(movies[randomIndex].id);
      counter++;
      if (counter > 8) {
        clearInterval(interval);
        setIsRollingDice(false);
      }
    }, 80);
  };

  const watchedCount = movies.filter((m) => m.isWatched).length;

  return (
    <div className="space-y-8 pb-16">
      {/* Personalized Welcome Ribbon */}
      <div className="bg-gradient-to-r from-amber-950/40 via-neutral-900 to-neutral-950 border-y border-amber-900/30 px-4 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 text-neutral-300">
            <span className="text-amber-400 font-semibold">🍿 Niece's Movie Night:</span>
            <span>Welcome, {config.nieceName}! All movies are on this drive ready to play anytime.</span>
          </div>
          <div className="flex items-center gap-4 text-neutral-400">
            <span>
              Watched: <strong className="text-neutral-200">{watchedCount}</strong> of {movies.length}
            </span>
            <button
              onClick={onOpenGiftLetter}
              className="text-amber-400 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 font-medium"
            >
              Read {config.curatorName}'s Gift Letter
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-8">
        {/* Hero Spotlight Banner */}
        {featuredMovie && (
          <div className="relative rounded-2xl overflow-hidden border border-neutral-800 bg-neutral-900 shadow-2xl">
            {/* Backdrop Image with gradient overlay */}
            <div className="absolute inset-0">
              <img
                src={featuredMovie.backdropUrl || featuredMovie.posterUrl}
                alt={featuredMovie.title}
                className="w-full h-full object-cover object-center opacity-30 filter blur-xs scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/80 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/85 to-transparent" />
            </div>

            <div className="relative z-10 p-6 md:p-10 flex flex-col lg:flex-row gap-8 items-start lg:items-center justify-between">
              <div className="space-y-4 max-w-3xl">
                {/* Clean unboxed metadata header */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                  <span className="font-semibold text-amber-400">{featuredMovie.rating}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span>{featuredMovie.durationFormatted}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span>{featuredMovie.year}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span>{featuredMovie.genres.join(', ')}</span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span className={featuredMovie.hasEnglishSubtitles ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}>
                    {featuredMovie.hasEnglishSubtitles ? 'CC Eng Subs' : 'No Eng Subs'}
                  </span>
                  <span aria-hidden="true" className="text-neutral-600">·</span>
                  <span className="font-mono text-[11px] text-neutral-300 uppercase tracking-wider bg-neutral-800/80 px-1.5 py-0.5 rounded border border-neutral-700/50">
                    .{featuredMovie.fileFormat}
                  </span>
                  {featuredMovie.resolution && (
                    <>
                      <span aria-hidden="true" className="text-neutral-600">·</span>
                      <span className="text-neutral-300">{featuredMovie.resolution}</span>
                    </>
                  )}
                </div>

                <h1 className="text-3xl md:text-5xl font-serif font-black tracking-tight text-neutral-100">
                  {featuredMovie.title}
                </h1>

                <p className="text-sm md:text-base text-neutral-300 leading-relaxed max-w-2xl">
                  {featuredMovie.synopsis}
                </p>

                {/* Curator Personal Note Callout */}
                {featuredMovie.curatorNote && (
                  <div className="bg-amber-500/10 border-l-2 border-amber-500 rounded-r-lg px-4 py-3 max-w-2xl text-xs md:text-sm text-amber-200/90 leading-relaxed">
                    <span className="font-semibold text-amber-400 block mb-0.5">
                      💌 Why {config.curatorName} picked this for you:
                    </span>
                    "{featuredMovie.curatorNote}"
                  </div>
                )}

                {/* File Location on Drive */}
                <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
                  <Film className="w-3.5 h-3.5 text-neutral-500" />
                  <span>File path on drive:</span>
                  <span className="text-neutral-300 bg-neutral-900/90 px-2 py-0.5 rounded border border-neutral-800">
                    {featuredMovie.relativeFilePath}
                  </span>
                  {featuredMovie.fileSizeFormatted && (
                    <span className="text-neutral-500">({featuredMovie.fileSizeFormatted})</span>
                  )}
                </div>

                {/* Hero Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={() => onSelectMovie(featuredMovie)}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg bg-amber-500 text-neutral-950 font-bold text-sm hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Play className="w-4 h-4 fill-neutral-950" />
                    <span>Watch Movie / Player</span>
                  </button>

                  <button
                    onClick={() => onSelectMovie(featuredMovie)}
                    className="flex items-center gap-2 px-4 py-3 rounded-lg bg-neutral-800/80 hover:bg-neutral-800 text-neutral-200 border border-neutral-700/60 font-medium text-xs transition-colors"
                  >
                    <Info className="w-4 h-4 text-neutral-400" />
                    <span>Full Synopsis & Specs</span>
                  </button>

                  <button
                    onClick={() => onToggleFavorite(featuredMovie.id)}
                    className={`p-3 rounded-lg border transition-colors ${
                      featuredMovie.isFavorite
                        ? 'bg-rose-950/40 border-rose-800/60 text-rose-400'
                        : 'bg-neutral-800/60 border-neutral-700/50 text-neutral-400 hover:text-rose-400'
                    }`}
                    title={featuredMovie.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart className={`w-4 h-4 ${featuredMovie.isFavorite ? 'fill-rose-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Poster Card in Hero */}
              <div
                className="hidden lg:block relative group cursor-pointer flex-shrink-0"
                onClick={() => onSelectMovie(featuredMovie)}
              >
                <div className="w-48 h-72 rounded-xl overflow-hidden shadow-2xl border border-neutral-700/60 bg-neutral-900 group-hover:scale-102 transition-transform duration-300">
                  <img
                    src={featuredMovie.posterUrl}
                    alt={featuredMovie.title}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = generateFallbackPosterSvg(
                        featuredMovie.title,
                        featuredMovie.year,
                        featuredMovie.genres[0],
                        featuredMovie.rating
                      );
                    }}
                  />
                </div>
                <div className="absolute top-2.5 right-2.5 bg-neutral-950/80 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-bold text-neutral-200 border border-white/10 uppercase">
                  .{featuredMovie.fileFormat}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search, Filter Bar & Controls */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, genre, year, actor, synopsis..."
                className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 text-xs"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Surprise Me & Sort */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSurpriseMe}
                disabled={isRollingDice}
                className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-lg text-xs font-medium text-amber-300 hover:border-amber-500/40 transition-all active:scale-95"
                title="Randomly pick a movie for movie night"
              >
                <Dices className={`w-3.5 h-3.5 text-amber-400 ${isRollingDice ? 'animate-spin' : ''}`} />
                <span>Surprise Me!</span>
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort movies by"
                className="px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-xs text-neutral-300 focus:outline-none focus:border-amber-500/60"
              >
                <option value="curator">Curator's Pick Order</option>
                <option value="year-desc">Release Date (Newest first)</option>
                <option value="year-asc">Release Date (Oldest first)</option>
                <option value="duration-asc">Duration (Shortest first)</option>
                <option value="title">Title (A to Z)</option>
              </select>
            </div>
          </div>

          {/* Genre & Category Segmented Buttons */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {['All', 'Favorites', 'CC Eng Subs', 'Under 2h', 'Watched', ...allGenres].map((genre) => {
              const isActive = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-neutral-200 text-neutral-950 font-semibold shadow-sm'
                      : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850 border border-neutral-800'
                  }`}
                >
                  {genre === 'Favorites'
                    ? '❤️ Favorites'
                    : genre === 'Watched'
                    ? '✅ Watched'
                    : genre === 'CC Eng Subs'
                    ? '💬 CC Eng Subs'
                    : genre}
                </button>
              );
            })}
          </div>
        </div>

        {/* Movie Grid */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
              {selectedGenre === 'All' ? 'All Movies' : `${selectedGenre} Collection`}
              <span className="text-neutral-500 font-normal ml-2">({filteredMovies.length})</span>
            </h2>
            <div className="text-xs text-neutral-500">
              Double click on external drive to play or click card below
            </div>
          </div>

          {filteredMovies.length === 0 ? (
            <div className="text-center py-16 px-4 border border-dashed border-neutral-800 rounded-xl bg-neutral-900/50">
              <Film className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
              <p className="text-neutral-300 text-sm font-medium">No movies found matching "{searchQuery}"</p>
              <p className="text-neutral-500 text-xs mt-1">Try clearing filters or search terms</p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedGenre('All');
                }}
                className="mt-4 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs rounded-md"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
              {filteredMovies.map((movie) => {
                const isCurrentFeatured = featuredMovie?.id === movie.id;

                return (
                  <div
                    key={movie.id}
                    onClick={() => onSelectMovie(movie)}
                    className="group flex flex-col bg-neutral-900 border border-neutral-800/90 rounded-xl overflow-hidden hover:border-neutral-700 transition-all duration-200 hover:shadow-xl hover:shadow-black/50 cursor-pointer"
                  >
                    {/* Poster with overlays */}
                    <div className="relative aspect-[2/3] w-full bg-neutral-950 overflow-hidden">
                      <img
                        src={movie.posterUrl}
                        alt={movie.title}
                        className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = generateFallbackPosterSvg(
                            movie.title,
                            movie.year,
                            movie.genres[0],
                            movie.rating
                          );
                        }}
                      />

                      {/* File format indicator badge */}
                      <div className="absolute top-2.5 left-2.5 bg-neutral-950/85 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider text-neutral-200 border border-white/10 uppercase">
                        .{movie.fileFormat}
                      </div>

                      {/* Favorite & Watched quick action toggles */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleWatched(movie.id);
                          }}
                          className={`p-1.5 rounded-md backdrop-blur-md transition-colors ${
                            movie.isWatched
                              ? 'bg-emerald-500/80 text-white'
                              : 'bg-neutral-950/60 text-neutral-400 hover:text-white'
                          }`}
                          title={movie.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(movie.id);
                          }}
                          className={`p-1.5 rounded-md backdrop-blur-md transition-colors ${
                            movie.isFavorite
                              ? 'bg-rose-500/80 text-white'
                              : 'bg-neutral-950/60 text-neutral-400 hover:text-rose-400'
                          }`}
                          title={movie.isFavorite ? 'Remove favorite' : 'Add to favorites'}
                        >
                          <Heart className={`w-3.5 h-3.5 ${movie.isFavorite ? 'fill-white' : ''}`} />
                        </button>
                      </div>

                      {/* Quick Play Hover Button */}
                      <div className="absolute inset-0 bg-neutral-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-amber-500 text-neutral-950 flex items-center justify-center shadow-lg transform group-hover:scale-105 transition-transform">
                          <Play className="w-5 h-5 fill-neutral-950 ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Card Content with Zero-Pill Typography Discipline */}
                    <div className="p-4 flex flex-col flex-1">
                      {/* Unboxed Metadata: Duration · Year · Rating · Format · Subtitles */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-400 mb-1 flex-wrap">
                        <span>{movie.year}</span>
                        <span aria-hidden="true" className="text-neutral-600">·</span>
                        <span>{movie.durationFormatted}</span>
                        <span aria-hidden="true" className="text-neutral-600">·</span>
                        <span className="text-neutral-300 font-medium">{movie.rating}</span>
                        <span aria-hidden="true" className="text-neutral-600">·</span>
                        <span className={movie.hasEnglishSubtitles ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}>
                          {movie.hasEnglishSubtitles ? 'CC Eng Subs' : 'No Eng Subs'}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-semibold text-sm text-neutral-100 line-clamp-1 group-hover:text-amber-400 transition-colors">
                        {movie.title}
                      </h3>

                      {/* Genres separated by interpunct */}
                      <div className="text-xs text-neutral-500 mt-0.5 mb-2 line-clamp-1">
                        {movie.genres.join(' · ')}
                      </div>

                      {/* Synopsis (3 lines max) */}
                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed flex-1">
                        {movie.synopsis}
                      </p>

                      {/* Card Footer: Curator Note Snippet or File Path */}
                      <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-500">
                        <span className="truncate max-w-[170px]" title={movie.relativeFilePath}>
                          {movie.relativeFilePath.split('/').pop()}
                        </span>
                        <span className="text-amber-400/90 hover:text-amber-300 font-medium">
                          Details →
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
