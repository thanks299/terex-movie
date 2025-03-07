"use client"

import { useState, useEffect, useCallback, type ChangeEvent } from "react"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Search, Star } from "lucide-react"
import { MovieCard } from "@/components/movie-card"
import { ReviewForm } from "@/components/review-form"
import { VideoPlayer } from "@/components/video-player"
import { MetadataSources } from "@/components/metadata-sources"
import { metadataService } from "@/lib/metadata/metadata-service"
import type { Movie, Review } from "@/types"
import type { MovieMetadata, VideoInfo, BasicMovieInfo } from "@/types/metadata"
import { ThemeToggle } from "@/components/theme-toggle"
import debounce from "lodash/debounce"

interface MovieWithMetadata extends Movie {
  metadata?: MovieMetadata
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("")
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<MovieWithMetadata | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [metadataStatus, setMetadataStatus] = useState<string>("Initializing metadata services...")

  // Initialize metadata service
  useEffect(() => {
    const initMetadata = async () => {
      try {
        setMetadataStatus("Initializing metadata services...")

        // Start the initialization process
        const initPromise = metadataService.initialize()

        // Poll for status updates during initialization
        const statusInterval = setInterval(() => {
          setMetadataStatus(metadataService.getInitializationStatus())
        }, 500)

        // Wait for initialization to complete
        await initPromise

        // Clear the interval and set the final status
        clearInterval(statusInterval)
        setMetadataStatus(metadataService.getInitializationStatus())
      } catch (error) {
        console.error("Failed to initialize metadata services:", error)
        setMetadataStatus("Some metadata services unavailable. Using fallbacks.")
      }
    }

    initMetadata()
  }, [])

  // Update the debouncedSearch function in the Home component
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 2) {
        setMovies([])
        return
      }
      setIsLoading(true)
      try {
        // Use the enhanced search method that includes upcoming movies
        const results = await metadataService.searchMoviesWithUpcoming(query)
        // Convert to our Movie type
        const movieResults = results.map((result) => ({
          id: Number.parseInt(result.id) || 0,
          title: result.title,
          overview: "",
          poster_path: result.posterUrl?.replace("https://image.tmdb.org/t/p/w500", "") || "",
          release_date: result.releaseDate || "",
          vote_average: result.rating || 0,
        }))
        setMovies(movieResults)
      } catch (error) {
        console.error("Error fetching movies:", error)
      } finally {
        setIsLoading(false)
      }
    }, 300),
    [],
  )

  useEffect(() => {
    debouncedSearch(searchQuery)
    return () => {
      debouncedSearch.cancel()
    }
  }, [searchQuery, debouncedSearch])

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }

  const handleMovieClick = async (movie: Movie) => {
    setIsLoading(true)
    try {
      // Get enhanced metadata
      const metadata = await metadataService.getEnhancedMetadata(movie.id, {
        includeVideos: true,
        includeCast: true,
        includeCrew: true,
        includeSimilar: true,
      })

      setSelectedMovie({ ...movie, metadata })
    } catch (error) {
      console.error("Error fetching movie details:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSimilarMovieClick = async (similarMovie: BasicMovieInfo) => {
    setIsLoading(true)
    try {
      // Convert the BasicMovieInfo to a Movie object
      const movie: Movie = {
        id: Number.parseInt(similarMovie.id) || 0,
        title: similarMovie.title,
        overview: "",
        poster_path: similarMovie.posterUrl?.replace("https://image.tmdb.org/t/p/w500", "") || "",
        release_date: similarMovie.releaseDate || "",
        vote_average: similarMovie.rating || 0,
      }

      // Get enhanced metadata
      const metadata = await metadataService.getEnhancedMetadata(movie.id, {
        includeVideos: true,
        includeCast: true,
        includeCrew: true,
        includeSimilar: true,
      })

      setSelectedMovie({ ...movie, metadata })
    } catch (error) {
      console.error("Error fetching similar movie details:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReviewSubmit = (review: { rating: number; comment: string }) => {
    if (!selectedMovie) return

    const newReview: Review = {
      id: Date.now().toString(),
      movieId: selectedMovie.id,
      rating: review.rating,
      comment: review.comment,
      author: "Anonymous",
      createdAt: new Date().toISOString(),
    }

    setReviews([newReview, ...reviews])
  }

  const getImageUrl = (path: string | null | undefined): string => {
    if (!path) return "/placeholder.svg?height=500&width=333"
    if (path.startsWith("http")) return path
    return `https://image.tmdb.org/t/p/w500${path}`
  }

  return (
    <main className="min-h-screen">
      {/* Header Section */}
      <div className="fixed top-4 right-4 z-50">
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center">
        <h1 className="text-4xl md:text-5xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-purple-400 bg-clip-text text-transparent">
          MOVIE DATABASE
        </h1>

        <h3 className="text-center text-muted-foreground mb-8 px-4 max-w-2xl">
          Discover and explore your favorite movies. Search through our collections and share your thoughts
        </h3>

        <div className="w-full max-w-2xl px-4 relative">
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Search className="w-5 h-5" />
            </div>
            <Input
              type="search"
              placeholder="Search for movies..."
              value={searchQuery}
              onChange={handleInputChange}
              className="w-full pl-10 pr-12 py-6 text-lg"
            />
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">{metadataStatus}</p>
        </div>
      </div>

      {/* Results Section */}
      <div className="container mx-auto px-4 pb-16">
        {isLoading && movies.length === 0 && searchQuery.trim().length >= 2 && (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        )}

        {!isLoading && searchQuery.trim().length >= 2 && movies.length === 0 && (
          <div className="text-center text-muted-foreground mt-8">No movies found for "{searchQuery}"</div>
        )}

        {movies.length > 0 && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {movies.map((movie) => (
                <MovieCard key={movie.id} movie={movie} onClick={handleMovieClick} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Movie Details Dialog */}
      <Dialog open={!!selectedMovie} onOpenChange={() => setSelectedMovie(null)}>
        {selectedMovie && (
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {selectedMovie.metadata?.title || selectedMovie.title}
                {selectedMovie.metadata?.tagline && (
                  <span className="block text-sm text-muted-foreground italic mt-1">
                    {selectedMovie.metadata.tagline}
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-6">
              {/* Video Player Section */}
              {selectedMovie.metadata?.videos && selectedMovie.metadata.videos.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Trailers & Videos</h3>
                  <VideoPlayer videos={selectedMovie.metadata.videos as VideoInfo[]} />
                </div>
              )}

              {/* Movie Info Section */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/3 aspect-[2/3] relative">
                  <img
                    src={getImageUrl(selectedMovie.metadata?.posterUrl || selectedMovie.poster_path)}
                    alt={selectedMovie.metadata?.title || selectedMovie.title}
                    className="rounded-lg object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground">{selectedMovie.metadata?.overview || selectedMovie.overview}</p>

                  {selectedMovie.metadata?.genres && selectedMovie.metadata.genres.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {selectedMovie.metadata.genres.map((genre: string) => (
                        <span key={genre} className="px-2 py-1 bg-accent text-accent-foreground rounded-full text-xs">
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-2">
                    <Star className="w-5 h-5 fill-secondary text-secondary" />
                    <span className="font-semibold">
                      {selectedMovie.metadata?.rating || selectedMovie.vote_average
                        ? (selectedMovie.metadata?.rating || selectedMovie.vote_average).toFixed(1)
                        : "N/A"}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm">
                    <p className="text-muted-foreground">
                      <span className="font-medium text-foreground">Release Date:</span>{" "}
                      {selectedMovie.metadata?.releaseDate || selectedMovie.release_date
                        ? new Date(
                            selectedMovie.metadata?.releaseDate || selectedMovie.release_date,
                          ).toLocaleDateString()
                        : "Unknown"}
                    </p>

                    {selectedMovie.metadata?.runtime && !isNaN(selectedMovie.metadata.runtime) && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Runtime:</span>{" "}
                        {Math.floor(selectedMovie.metadata.runtime / 60)}h {selectedMovie.metadata.runtime % 60}m
                      </p>
                    )}

                    {selectedMovie.metadata?.director && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Director:</span> {selectedMovie.metadata.director}
                      </p>
                    )}

                    {selectedMovie.metadata?.writers && selectedMovie.metadata.writers.length > 0 && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Writers:</span>{" "}
                        {selectedMovie.metadata.writers.join(", ")}
                      </p>
                    )}

                    {selectedMovie.metadata?.cast && selectedMovie.metadata.cast.length > 0 && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Cast:</span>{" "}
                        {selectedMovie.metadata.cast
                          .slice(0, 5)
                          .map((actor: { name: string }) => actor.name)
                          .join(", ")}
                      </p>
                    )}

                    {selectedMovie.metadata?.languages && selectedMovie.metadata.languages.length > 0 && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground">Languages:</span>{" "}
                        {selectedMovie.metadata.languages.join(", ")}
                      </p>
                    )}

                    {selectedMovie.metadata?.source && (
                      <div className="mt-2">
                        <p className="text-xs text-muted-foreground">Data sources:</p>
                        <MetadataSources sources={selectedMovie.metadata.source} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reviews Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Write a Review</h3>
                <ReviewForm movieId={selectedMovie.id} onSubmit={handleReviewSubmit} />
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Reviews</h3>
                {reviews
                  .filter((review) => review.movieId === selectedMovie.id)
                  .map((review) => (
                    <div key={review.id} className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-secondary text-secondary" />
                        ))}
                      </div>
                      <p className="text-sm">{review.comment}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        By {review.author} on {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                {reviews.filter((review) => review.movieId === selectedMovie.id).length === 0 && (
                  <p className="text-muted-foreground">No reviews yet. Be the first to review!</p>
                )}
              </div>

              {/* Similar Movies Section */}
              {selectedMovie.metadata?.similar && selectedMovie.metadata.similar.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Similar Movies</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {selectedMovie.metadata.similar.map((movie: BasicMovieInfo) => (
                      <div
                        key={movie.id}
                        className="cursor-pointer group"
                        onClick={() => handleSimilarMovieClick(movie)}
                      >
                        <div className="aspect-[2/3] relative rounded-lg overflow-hidden">
                          <img
                            src={getImageUrl(movie.posterUrl) || "/placeholder.svg"}
                            alt={movie.title}
                            className="object-cover w-full h-full transition-transform group-hover:scale-110"
                          />
                        </div>
                        <p className="text-sm mt-2 line-clamp-1">{movie.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  )
}

