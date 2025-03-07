import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions } from "@/types/metadata"
import { BaseMetadataAdapter } from "./base-adapter"

// The Movie Poster Database API
// You need to get an API key from https://www.themoviedb.org/
const TMPDB_API_KEY = process.env.TMPDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY || "YOUR_TMPDB_API_KEY"
const BASE_URL = "https://api.themoviedb.org/3"

export class TMPDBAdapter extends BaseMetadataAdapter {
  name = "TMPDB"
  priority = 4

  async getMovieMetadata(id: string | number, options?: MetadataFetchOptions): Promise<MovieMetadata | null> {
    try {
      // Check if API key is available
      if (!TMPDB_API_KEY || TMPDB_API_KEY === "YOUR_TMPDB_API_KEY") {
        console.warn("TMPDB API key not configured")
        return null
      }

      // TMPDB is primarily for posters, so we'll focus on that
      let tmdbId: number

      if (typeof id === "number") {
        tmdbId = id
      } else {
        tmdbId = Number.parseInt(id)

        if (isNaN(tmdbId)) {
          // Try to search for the movie
          const searchResults = await this.searchMovies(id)

          if (searchResults.length > 0) {
            tmdbId = Number.parseInt(searchResults[0].id)
          } else {
            return null
          }
        }
      }

      // Fetch movie images from TMDB
      const url = `${BASE_URL}/movie/${tmdbId}/images?api_key=${TMPDB_API_KEY}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`TMPDB API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Also fetch basic movie details to get the title
      const detailsUrl = `${BASE_URL}/movie/${tmdbId}?api_key=${TMPDB_API_KEY}`

      const detailsResponse = await fetch(detailsUrl)
      if (!detailsResponse.ok) {
        const errorText = await detailsResponse.text()
        throw new Error(`TMPDB API error: ${detailsResponse.status} - ${errorText}`)
      }

      const details = await detailsResponse.json()

      // Get the best poster and backdrop images
      const posterPath = data.posters && data.posters.length > 0 ? data.posters[0].file_path : details.poster_path

      const backdropPath =
        data.backdrops && data.backdrops.length > 0 ? data.backdrops[0].file_path : details.backdrop_path

      return {
        id: tmdbId.toString(),
        title: details.title,
        posterUrl: posterPath ? `https://image.tmdb.org/t/p/original${posterPath}` : undefined,
        backdropUrl: backdropPath ? `https://image.tmdb.org/t/p/original${backdropPath}` : undefined,
        externalIds: {
          tmdb: tmdbId,
        },
        source: this.name,
      }
    } catch (error) {
      console.error("Error fetching TMPDB metadata:", error)
      return null
    }
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    try {
      // Check if API key is available
      if (!TMPDB_API_KEY || TMPDB_API_KEY === "YOUR_TMPDB_API_KEY") {
        console.warn("TMPDB API key not configured")
        return []
      }

      // Search for movies in TMDB
      const url = `${BASE_URL}/search/movie?api_key=${TMPDB_API_KEY}&query=${encodeURIComponent(query)}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`TMPDB API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      return data.results.map((movie: any) => ({
        id: movie.id.toString(),
        title: movie.title,
        posterUrl: movie.poster_path ? `https://image.tmdb.org/t/p/original${movie.poster_path}` : undefined,
        releaseDate: this.formatDate(movie.release_date),
      }))
    } catch (error) {
      console.error("Error searching TMPDB:", error)
      return []
    }
  }

  // Override the isAvailable method to handle TMPDB API specifically
  async isAvailable(): Promise<boolean> {
    // If no API key is configured, the adapter is not available
    if (!TMPDB_API_KEY || TMPDB_API_KEY === "YOUR_TMPDB_API_KEY") {
      console.warn("TMPDB adapter not available: API key not configured")
      return false
    }

    try {
      // Make a minimal API call to check if the API is working
      const url = `${BASE_URL}/movie/550?api_key=${TMPDB_API_KEY}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`TMPDB API not available: ${response.status} - ${errorText}`)
        return false
      }

      return true
    } catch (error) {
      console.warn("TMPDB API not available:", error)
      return false
    }
  }
}

