import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions } from "@/types/metadata"
import { BaseMetadataAdapter } from "./base-adapter"

// OMDB API - http://www.omdbapi.com/
// You would need to get an API key from http://www.omdbapi.com/apikey.aspx
const OMDB_API_KEY = process.env.OMDB_API_KEY || "YOUR_OMDB_API_KEY" // Replace with your actual key or env variable
const BASE_URL = "https://www.omdbapi.com/" // Using HTTPS

export class OMDBAdapter extends BaseMetadataAdapter {
  name = "OMDB"
  priority = 2

  async getMovieMetadata(id: string | number, options?: MetadataFetchOptions): Promise<MovieMetadata | null> {
    try {
      // Check if API key is available
      if (!OMDB_API_KEY || OMDB_API_KEY === "YOUR_OMDB_API_KEY") {
        console.warn("OMDB API key not configured")
        return null
      }
      
      // OMDB uses IMDb IDs, so we need to handle different ID types
      let imdbId = typeof id === "string" && id.startsWith("tt") ? id : undefined

      // If we don't have an IMDb ID, we need to search by title
      if (!imdbId && typeof id === "string") {
        const searchResults = await this.searchMovies(id)
        if (searchResults.length > 0) {
          imdbId = searchResults[0].id
        }
      }

      if (!imdbId) {
        console.warn(`No valid IMDb ID found for ${id}`)
        return null
      }

      const url = `${BASE_URL}?apikey=${OMDB_API_KEY}&i=${imdbId}&plot=full`
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      try {
        const response = await fetch(url, { 
          signal: controller.signal 
        }).finally(() => clearTimeout(timeoutId))

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`OMDB API error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()

        if (data.Response === "False") {
          console.warn(`OMDB API returned error: ${data.Error}`)
          return null
        }

        // Parse ratings
        let rating = 0
        if (data.imdbRating && !isNaN(Number.parseFloat(data.imdbRating))) {
          rating = Number.parseFloat(data.imdbRating)
        }

        // Parse genres
        const genres = data.Genre ? data.Genre.split(", ") : []

        // Parse cast
        const cast = data.Actors && data.Actors !== "N/A"
          ? data.Actors.split(", ").map((name: string, index: number) => ({
              id: `omdb-actor-${index}`,
              name,
              character: "",
            }))
          : []

        // Parse crew
        const crew: { id: string; name: string; job: string; department: string }[] = []
        if (data.Director && data.Director !== "N/A") {
          data.Director.split(", ").forEach((name: string, index: number) => {
            crew.push({
              id: `omdb-director-${index}`,
              name,
              job: "Director",
              department: "Directing",
            })
          })
        }

        if (data.Writer && data.Writer !== "N/A") {
          data.Writer.split(", ").forEach((name: string, index: number) => {
            // Remove "(characters)" or other parenthetical notes
            const cleanName = name.replace(/\s*$$.*?$$\s*/g, "")
            crew.push({
              id: `omdb-writer-${index}`,
              name: cleanName,
              job: "Writer",
              department: "Writing",
            })
          })
        }

        return {
          id: imdbId,
          title: data.Title,
          overview: data.Plot !== "N/A" ? data.Plot : undefined,
          posterUrl: data.Poster !== "N/A" ? data.Poster : undefined,
          releaseDate: this.formatDate(data.Released !== "N/A" ? data.Released : data.Year),
          runtime: data.Runtime !== "N/A" ? parseInt(data.Runtime) : undefined,
          genres,
          rating,
          director: data.Director !== "N/A" ? data.Director : undefined,
          writers:
            data.Writer !== "N/A"
              ? data.Writer.split(", ").map((w: string) => w.replace(/\s*$$.*?$$\s*/g, ""))
              : undefined,
          cast: options?.includeCast ? cast : undefined,
          crew: options?.includeCrew ? crew : undefined,
          languages: data.Language !== "N/A" ? data.Language.split(", ") : undefined,
          externalIds: {
            imdb: imdbId,
          },
          source: this.name,
        }
      } catch (fetchError) {
        console.error("OMDB fetch error:", fetchError)
        return null
      }
    } catch (error) {
      console.error("Error fetching OMDB metadata:", error)
      return null
    }
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    try {
      // Check if API key is available
      if (!OMDB_API_KEY || OMDB_API_KEY === "YOUR_OMDB_API_KEY") {
        console.warn("OMDB API key not configured")
        return []
      }
      
      const url = `${BASE_URL}?apikey=${OMDB_API_KEY}&s=${encodeURIComponent(query)}&type=movie`
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      try {
        const response = await fetch(url, { 
          signal: controller.signal 
        }).finally(() => clearTimeout(timeoutId))

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`OMDB API error: ${response.status} - ${errorText}`)
        }

        const data = await response.json()

        if (data.Response === "False") {
          // No results found is not an error
          if (data.Error === "Movie not found!") {
            return []
          }
          throw new Error(`OMDB API error: ${data.Error}`)
        }

        return data.Search.map((movie: any) => ({
          id: movie.imdbID,
          title: movie.Title,
          posterUrl: movie.Poster !== "N/A" ? movie.Poster : undefined,
          releaseDate: this.formatDate(movie.Year),
          // OMDB search doesn't return ratings, so we leave it undefined
        }))
      } catch (fetchError) {
        console.error("OMDB fetch error:", fetchError)
        return []
      }
    } catch (error) {
      console.error("Error searching OMDB:", error)
      return []
    }
  }

  // Override the isAvailable method to handle OMDB API specifically
  async isAvailable(): Promise<boolean> {
    // If no API key is configured, the adapter is not available
    if (!OMDB_API_KEY || OMDB_API_KEY === "YOUR_OMDB_API_KEY") {
      console.warn("OMDB adapter not available: API key not configured")
      return false
    }
    
    try {
      // Make a minimal API call to check if the API is working
      // Using a simple search with minimal results
      const url = `${BASE_URL}?apikey=${OMDB_API_KEY}&s=test&type=movie&page=1&r=json`
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      try {
        const response = await fetch(url, { 
          signal: controller.signal 
        }).finally(() => clearTimeout(timeoutId))
        
        if (!response.ok) {
          const errorText = await response.text()
          console.warn(`OMDB API not available: ${response.status} - ${errorText}`)
          return false
        }
        
        const data = await response.json()
        return data.Response === "True"
      } catch (fetchError) {
        console.warn("OMDB API not available (network error):", fetchError)
        return false
      }
    } catch (error) {
      console.warn("OMDB API not available:", error)
      return false
    }
  }
}
