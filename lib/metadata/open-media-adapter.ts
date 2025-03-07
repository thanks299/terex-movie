import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions } from "@/types/metadata"
import { BaseMetadataAdapter } from "./base-adapter"

// Using The Open Movie Database (OMDb) as a real alternative to the fictional Open Media Database
// You need to get an API key from http://www.omdbapi.com/apikey.aspx
const OPEN_MEDIA_API_KEY = process.env.OPEN_MEDIA_API_KEY || process.env.OMDB_API_KEY || "YOUR_OMDB_API_KEY"
const BASE_URL = "https://www.omdbapi.com/"

export class OpenMediaAdapter extends BaseMetadataAdapter {
  name = "OpenMedia"
  priority = 7

  async getMovieMetadata(id: string | number, options?: MetadataFetchOptions): Promise<MovieMetadata | null> {
    try {
      // Check if API key is available
      if (!OPEN_MEDIA_API_KEY || OPEN_MEDIA_API_KEY === "YOUR_OMDB_API_KEY") {
        console.warn("Open Media API key not configured")
        return null
      }

      // Handle different ID types
      let imdbId: string | undefined

      if (typeof id === "string" && id.startsWith("tt")) {
        // Already an IMDb ID
        imdbId = id
      } else {
        // Try to search for the movie
        let searchTerm: string

        if (typeof id === "number") {
          // Try to get the title from TMDB
          try {
            const tmdbUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
            const response = await fetch(tmdbUrl)

            if (response.ok) {
              const data = await response.json()
              searchTerm = data.title
            } else {
              searchTerm = id.toString()
            }
          } catch (e) {
            searchTerm = id.toString()
          }
        } else {
          searchTerm = id.toString()
        }

        const searchResults = await this.searchMovies(searchTerm)

        if (searchResults.length > 0) {
          imdbId = searchResults[0].id
        } else {
          return null
        }
      }

      // Fetch movie details from OMDb
      const url = `${BASE_URL}?apikey=${OPEN_MEDIA_API_KEY}&i=${imdbId}&plot=full`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Open Media API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      if (data.Response === "False") {
        console.warn(`Open Media API returned error: ${data.Error}`)
        return null
      }

      // Parse ratings
      let rating = 0
      if (data.imdbRating && !isNaN(Number.parseFloat(data.imdbRating))) {
        rating = Number.parseFloat(data.imdbRating)
      }

      // Parse runtime
      let runtime: number | undefined
      if (data.Runtime && data.Runtime !== "N/A") {
        const runtimeMatch = data.Runtime.match(/^(\d+)/)
        if (runtimeMatch) {
          runtime = Number.parseInt(runtimeMatch[1])
        }
      }

      // Parse genres
      const genres = data.Genre && data.Genre !== "N/A" ? data.Genre.split(", ") : []

      // Parse cast
      const cast =
        data.Actors && data.Actors !== "N/A"
          ? data.Actors.split(", ").map((name: string, index: number) => ({
              id: `openmedia-actor-${index}`,
              name,
              character: "",
            }))
          : []

      return {
        id: imdbId,
        title: data.Title,
        overview: data.Plot !== "N/A" ? data.Plot : undefined,
        posterUrl: data.Poster !== "N/A" ? data.Poster : undefined,
        releaseDate: this.formatDate(data.Released !== "N/A" ? data.Released : data.Year),
        runtime,
        genres,
        rating,
        director: data.Director !== "N/A" ? data.Director : undefined,
        writers:
          data.Writer !== "N/A"
            ? data.Writer.split(", ").map((w: string) => w.replace(/\s*$$.*?$$\s*/g, ""))
            : undefined,
        cast: options?.includeCast ? cast : undefined,
        languages: data.Language !== "N/A" ? data.Language.split(", ") : undefined,
        externalIds: {
          imdb: imdbId,
        },
        source: this.name,
      }
    } catch (error) {
      console.error("Error fetching Open Media metadata:", error)
      return null
    }
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    try {
      // Check if API key is available
      if (!OPEN_MEDIA_API_KEY || OPEN_MEDIA_API_KEY === "YOUR_OMDB_API_KEY") {
        console.warn("Open Media API key not configured")
        return []
      }

      // Search for movies in OMDb
      const url = `${BASE_URL}?apikey=${OPEN_MEDIA_API_KEY}&s=${encodeURIComponent(query)}&type=movie`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Open Media API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      if (data.Response === "False") {
        // No results found is not an error
        if (data.Error === "Movie not found!") {
          return []
        }
        throw new Error(`Open Media API error: ${data.Error}`)
      }

      return data.Search.map((movie: any) => ({
        id: movie.imdbID,
        title: movie.Title,
        posterUrl: movie.Poster !== "N/A" ? movie.Poster : undefined,
        releaseDate: this.formatDate(movie.Year),
      }))
    } catch (error) {
      console.error("Error searching Open Media:", error)
      return []
    }
  }

  // Override the isAvailable method to handle Open Media API specifically
  async isAvailable(): Promise<boolean> {
    // If no API key is configured, the adapter is not available
    if (!OPEN_MEDIA_API_KEY || OPEN_MEDIA_API_KEY === "YOUR_OMDB_API_KEY") {
      console.warn("Open Media adapter not available: API key not configured")
      return false
    }

    try {
      // Make a minimal API call to check if the API is working
      const url = `${BASE_URL}?apikey=${OPEN_MEDIA_API_KEY}&s=test&type=movie&page=1&r=json`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`Open Media API not available: ${response.status} - ${errorText}`)
        return false
      }

      const data = await response.json()
      return data.Response === "True"
    } catch (error) {
      console.warn("Open Media API not available:", error)
      return false
    }
  }
}

