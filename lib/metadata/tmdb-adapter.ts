import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions, VideoInfo } from "@/types/metadata"
import { BaseMetadataAdapter } from "./base-adapter"

const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY
const BASE_URL = "https://api.themoviedb.org/3"
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/"

export class TMDBAdapter extends BaseMetadataAdapter {
  name = "TMDB"
  priority = 1 // Highest priority

  async getMovieMetadata(id: number | string, options: MetadataFetchOptions = {}): Promise<MovieMetadata | null> {
    try {
      const movieId = typeof id === "string" ? id : id.toString()

      // Fetch basic movie details
      const detailsUrl = `${BASE_URL}/movie/${movieId}?api_key=${TMDB_API_KEY}&language=${options.language || "en-US"}&append_to_response=alternative_titles`
      const detailsResponse = await fetch(detailsUrl)

      if (!detailsResponse.ok) {
        throw new Error(`TMDB API error: ${detailsResponse.status}`)
      }

      const details = await detailsResponse.json()

      // Prepare the metadata object
      const metadata: MovieMetadata = {
        id: movieId,
        title: details.title,
        originalTitle: details.original_title,
        overview: details.overview,
        tagline: details.tagline,
        posterUrl: details.poster_path ? `${IMAGE_BASE_URL}w500${details.poster_path}` : undefined,
        backdropUrl: details.backdrop_path ? `${IMAGE_BASE_URL}original${details.backdrop_path}` : undefined,
        releaseDate: this.formatDate(details.release_date),
        runtime: details.runtime,
        genres: details.genres?.map((g: any) => g.name) || [],
        rating: details.vote_average,
        voteCount: details.vote_count,
        productionCompanies: details.production_companies?.map((c: any) => c.name) || [],
        budget: details.budget,
        revenue: details.revenue,
        languages: details.spoken_languages?.map((l: any) => l.english_name) || [],
        externalIds: {
          tmdb: details.id,
          imdb: details.imdb_id,
        },
        source: this.name,
      }

      // Fetch additional data based on options
      const promises = []

      if (options.includeVideos) {
        promises.push(
          this.fetchVideos(movieId).then((videos) => {
            metadata.videos = videos
          }),
        )
      }

      if (options.includeCast || options.includeCrew) {
        promises.push(
          this.fetchCredits(movieId).then((credits) => {
            if (options.includeCast) {
              metadata.cast = credits.cast
            }
            if (options.includeCrew) {
              metadata.crew = credits.crew

              // Extract director and writers
              const directors = credits.crew.filter((c: { job: string }) => c.job === "Director")
              if (directors.length > 0) {
                metadata.director = directors[0].name
              }

              const writers = credits.crew.filter(
                (c: { department: string; job: string }) => c.department === "Writing" || ["Screenplay", "Writer", "Novel", "Story"].includes(c.job || ""),
              )
              if (writers.length > 0) {
                metadata.writers = writers.map((w: { name: string }) => w.name)
              }
            }
          }),
        )
      }

      if (options.includeSimilar) {
        promises.push(
          this.fetchSimilar(movieId).then((similar) => {
            metadata.similar = similar
          }),
        )
      }

      // Wait for all additional data to be fetched
      if (promises.length > 0) {
        await Promise.all(promises)
      }

      return metadata
    } catch (error) {
      console.error("Error fetching TMDB metadata:", error)
      return null
    }
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    try {
      // First, search for movies with the exact query
      const exactResults = await this.performSearch(query)

      // If we have exact results, return them
      if (exactResults.length > 0) {
        return exactResults
      }

      // If no exact results, try a more comprehensive search
      // Split the query into words for better matching
      const words = query.split(" ").filter((word) => word.length > 1)

      // If we have multiple words, try searching with just the first few words
      // This helps with movies like "Daredevil: Born Again" where the subtitle might be different
      if (words.length > 1) {
        const partialQuery = words.slice(0, Math.min(2, words.length)).join(" ")
        return await this.performSearch(partialQuery)
      }

      return []
    } catch (error) {
      console.error("Error searching TMDB:", error)
      return []
    }
  }

  private async performSearch(query: string): Promise<BasicMovieInfo[]> {
    // Search in both movie and tv endpoints to get more comprehensive results
    const movieUrl = `${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
    const tvUrl = `${BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`

    const [movieResponse, tvResponse] = await Promise.all([fetch(movieUrl), fetch(tvUrl)])

    if (!movieResponse.ok) {
      throw new Error(`TMDB API error: ${movieResponse.status}`)
    }

    if (!tvResponse.ok) {
      throw new Error(`TMDB API error: ${tvResponse.status}`)
    }

    const movieData = await movieResponse.json()
    const tvData = await tvResponse.json()

    // Process movie results
    const movieResults = movieData.results.map((movie: any) => ({
      id: movie.id.toString(),
      title: movie.title,
      posterUrl: movie.poster_path ? `${IMAGE_BASE_URL}w500${movie.poster_path}` : undefined,
      releaseDate: this.formatDate(movie.release_date),
      rating: movie.vote_average,
      mediaType: "movie",
    }))

    // Process TV results
    const tvResults = tvData.results.map((tv: any) => ({
      id: tv.id.toString(),
      title: tv.name,
      posterUrl: tv.poster_path ? `${IMAGE_BASE_URL}w500${tv.poster_path}` : undefined,
      releaseDate: this.formatDate(tv.first_air_date),
      rating: tv.vote_average,
      mediaType: "tv",
    }))

    // Combine and sort by popularity (assuming more recent/popular items appear first in the API response)
    const combinedResults = [...movieResults, ...tvResults]

    // Filter out items without titles
    return combinedResults.filter((item) => item.title)
  }

  private async fetchVideos(movieId: string): Promise<VideoInfo[]> {
    try {
      const url = `${BASE_URL}/movie/${movieId}/videos?api_key=${TMDB_API_KEY}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`)
      }

      const data = await response.json()

      return data.results.map((video: any) => ({
        id: video.id,
        key: video.key,
        site: video.site,
        type: video.type,
        name: video.name,
        size: video.size,
        official: video.official,
        publishedAt: video.published_at,
      }))
    } catch (error) {
      console.error("Error fetching TMDB videos:", error)
      return []
    }
  }

  private async fetchCredits(movieId: string) {
    try {
      const url = `${BASE_URL}/movie/${movieId}/credits?api_key=${TMDB_API_KEY}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`)
      }

      const data = await response.json()

      return {
        cast:
          data.cast?.slice(0, 10).map((person: any) => ({
            id: person.id.toString(),
            name: person.name,
            character: person.character,
            profileUrl: person.profile_path ? `${IMAGE_BASE_URL}w185${person.profile_path}` : undefined,
          })) || [],
        crew:
          data.crew?.map((person: any) => ({
            id: person.id.toString(),
            name: person.name,
            job: person.job,
            department: person.department,
            profileUrl: person.profile_path ? `${IMAGE_BASE_URL}w185${person.profile_path}` : undefined,
          })) || [],
      }
    } catch (error) {
      console.error("Error fetching TMDB credits:", error)
      return { cast: [], crew: [] }
    }
  }

  private async fetchSimilar(movieId: string): Promise<BasicMovieInfo[]> {
    try {
      const url = `${BASE_URL}/movie/${movieId}/similar?api_key=${TMDB_API_KEY}`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`)
      }

      const data = await response.json()

      return data.results.slice(0, 6).map((movie: any) => ({
        id: movie.id.toString(),
        title: movie.title,
        posterUrl: movie.poster_path ? `${IMAGE_BASE_URL}w500${movie.poster_path}` : undefined,
        releaseDate: this.formatDate(movie.release_date),
        rating: movie.vote_average,
      }))
    } catch (error) {
      console.error("Error fetching TMDB similar movies:", error)
      return []
    }
  }

  // Add a method to fetch upcoming movies
  async getUpcomingMovies(): Promise<BasicMovieInfo[]> {
    try {
      const url = `${BASE_URL}/movie/upcoming?api_key=${TMDB_API_KEY}&language=en-US&page=1`
      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`TMDB API error: ${response.status}`)
      }

      const data = await response.json()

      return data.results.map((movie: any) => ({
        id: movie.id.toString(),
        title: movie.title,
        posterUrl: movie.poster_path ? `${IMAGE_BASE_URL}w500${movie.poster_path}` : undefined,
        releaseDate: this.formatDate(movie.release_date),
        rating: movie.vote_average,
      }))
    } catch (error) {
      console.error("Error fetching upcoming movies:", error)
      return []
    }
  }
}

