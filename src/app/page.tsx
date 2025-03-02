"use client"

import { useState, useEffect, useCallback, type ChangeEvent } from "react"
import { Input } from "@/src/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/components/ui/dialog"
import { Loader2, Star, Search } from "lucide-react" // Import the Search icon
import { MovieCard } from "@/src/components/movie-card"
import { ReviewForm } from "@/src/components/review-form"
import { searchMovies, getMovieDetails, getMovieVideos } from "@/src/lib/tmdb"
import type { Movie, Review } from "@/types"
import { ThemeToggle } from "@/src/components/theme-toggle"
import debounce from "lodash/debounce"
import { VideoPlayer } from "@/src/components/video-player"
import type { VideoResult } from "@/src/lib/tmdb"

interface MovieWithVideos extends Movie {
  videos?: VideoResult[]
}

const getImageUrl = (path: string | null): string | null => {
  if (!path) return null
  return `https://image.tmdb.org/t/p/w500${path}`
}

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("")
  const [movies, setMovies] = useState<Movie[]>([])
  const [selectedMovie, setSelectedMovie] = useState<MovieWithVideos | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Debounced search function for real-time results
  const debouncedSearch = useCallback(
    debounce(async (query: string) => {
      if (query.trim().length < 2) {
        setMovies([])
        return
      }
      setIsLoading(true)
      try {
        const results = await searchMovies(query)
        setMovies(results)
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
      const [details, videos] = await Promise.all([getMovieDetails(movie.id), getMovieVideos(movie.id)])
      setSelectedMovie({ ...movie, ...details, videos })
    } catch (error) {
      console.error("Error fetching movie details:", error)
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
          Discover and explore your favorite movies. Search through our collection and share your thoughts.
        </h3>

        <div className="w-full max-w-2xl px-4 relative">
          <div className="relative">
            <Input
              type="search"
              placeholder="Search for movies..."
              value={searchQuery}
              onChange={handleInputChange}
              className="w-full pl-12 pr-4 py-6 text-lg" // Adjusted padding to accommodate the icon
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              <Search className="w-5 h-5 text-muted-foreground" /> {/* Search icon */}
            </div>
            {isLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
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
              <DialogTitle className="text-xl font-bold">{selectedMovie.title}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6">
              {/* Video Player Section */}
              {selectedMovie.videos && selectedMovie.videos.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Trailers & Videos</h3>
                  <VideoPlayer videos={selectedMovie.videos} />
                </div>
              )}

              {/* Movie Info Section */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/3 aspect-[2/3] relative">
                  <img
                    src={getImageUrl(selectedMovie.poster_path) || "/placeholder.svg"}
                    alt={selectedMovie.title}
                    className="rounded-lg object-cover w-full h-full"
                  />
                </div>
                <div className="flex-1">
                  <p className="text-muted-foreground">{selectedMovie.overview}</p>
                  <div className="mt-4 flex items-center gap-2">
                    <Star className="w-5 h-5 fill-secondary text-secondary" />
                    <span className="font-semibold">{selectedMovie.vote_average.toFixed(1)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Release Date: {new Date(selectedMovie.release_date).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Reviews Section */}
              <div className="space-y-4 mt-6">
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
            </div>
          </DialogContent>
        )}
      </Dialog>
    </main>
  )
}