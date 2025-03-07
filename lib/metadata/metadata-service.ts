import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions, MetadataSource } from "../../types/metadata"
import { TMDBAdapter } from "./tmdb-adapter"
import { OMDBAdapter } from "./omdb-adapter"
import { MovieLensAdapter } from "./movielens-adapter"
import { TMPDBAdapter } from "./tmpdb-adapter"
import { YouTubeAdapter } from "./youtube-adapter"
import { WikidataAdapter } from "./wikidata-adapter"
import { OpenMediaAdapter } from "./open-media-adapter"
import { CustomDatabaseAdapter } from "./custom-db-adapter"

export class MetadataService {
  private sources: MetadataSource[] = []
  private availableSources: MetadataSource[] = []
  private initialized = false
  private customDB: CustomDatabaseAdapter
  private initializationPromise: Promise<void> | null = null
  private initializationStatus = "Not initialized"

  constructor() {
    // Create the custom database adapter
    this.customDB = new CustomDatabaseAdapter()

    // Add all our adapters
    this.sources = [
      this.customDB, // Highest priority
      new TMDBAdapter(),
      new OMDBAdapter(),
      new MovieLensAdapter(),
      new TMPDBAdapter(),
      new YouTubeAdapter(),
      new WikidataAdapter(),
      new OpenMediaAdapter(),
    ]

    // Sort by priority
    this.sources.sort((a, b) => a.priority - b.priority)
  }

  async initialize(): Promise<void> {
    // Ensure we only initialize once, even if called multiple times
    if (this.initialized) return

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this._initialize()
    return this.initializationPromise
  }

  getInitializationStatus(): string {
    return this.initializationStatus
  }

  private async _initialize(): Promise<void> {
    try {
      this.initializationStatus = "Initializing metadata service..."
      console.log(this.initializationStatus)

      // Check which sources are available
      const availabilityChecks = await Promise.allSettled(
        this.sources.map(async (source) => {
          try {
            this.initializationStatus = `Checking availability of ${source.name}...`
            console.log(this.initializationStatus)
            const isAvailable = await source.isAvailable()
            console.log(`${source.name} availability: ${isAvailable}`)
            return { source, isAvailable }
          } catch (error) {
            console.error(`Error checking availability for ${source.name}:`, error)
            return { source, isAvailable: false }
          }
        }),
      )

      this.availableSources = availabilityChecks
        .filter((result) => result.status === "fulfilled" && (result.value as any).isAvailable)
        .map((result) => (result as PromiseFulfilledResult<{ source: MetadataSource; isAvailable: any }>).value.source)

      // Always ensure we have at least the TMDB adapter and custom DB adapter available
      const ensureSources = ["TMDB", "CustomDB"]
      for (const sourceName of ensureSources) {
        if (!this.availableSources.some((source) => source.name === sourceName)) {
          const source = this.sources.find((source) => source.name === sourceName)
          if (source) {
            console.log(`Forcing ${sourceName} to be available as a fallback`)
            this.availableSources.push(source)
          }
        }
      }

      this.initialized = true

      const availableSourceNames = this.availableSources.map((s) => s.name).join(", ")
      this.initializationStatus = `Metadata service ready with sources: ${availableSourceNames}`
      console.log(
        `Metadata service initialized with ${this.availableSources.length} available sources:`,
        availableSourceNames,
      )
    } catch (error) {
      console.error("Failed to initialize metadata service:", error)
      // Ensure we're initialized even on error
      this.initialized = true

      // Use at least TMDB and the custom DB as fallbacks
      this.availableSources = this.sources.filter((source) => source.name === "TMDB" || source.name === "CustomDB")

      if (this.availableSources.length === 0) {
        // If we couldn't find TMDB or CustomDB, use whatever we have
        this.availableSources = [this.sources[0]]
      }

      const fallbackSources = this.availableSources.map((s) => s.name).join(", ")
      this.initializationStatus = `Initialization error. Using fallback sources: ${fallbackSources}`
    }
  }

  async getMovieMetadata(id: string | number, options: MetadataFetchOptions = {}): Promise<MovieMetadata | null> {
    await this.ensureInitialized()

    if (this.availableSources.length === 0) {
      console.error("No metadata sources available")
      return null
    }

    // Try each source in order of priority
    let metadata: MovieMetadata | null = null
    const errors: Error[] = []

    for (const source of this.availableSources) {
      try {
        console.log(`Fetching metadata from ${source.name} for ID ${id}...`)
        const result = await source.getMovieMetadata(id, options)
        if (result) {
          console.log(`Successfully fetched metadata from ${source.name}`)
          metadata = result
          break
        }
      } catch (error) {
        errors.push(error as Error)
        console.error(`Error fetching metadata from ${source.name}:`, error)
      }
    }

    if (!metadata && errors.length > 0) {
      console.error("All metadata sources failed:", errors)
    }

    return this.sanitizeMetadata(metadata)
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    await this.ensureInitialized()

    if (this.availableSources.length === 0) {
      console.error("No metadata sources available")
      return []
    }

    // Try the primary source first
    try {
      const primarySource = this.availableSources[0]
      console.log(`Searching with primary source ${primarySource.name}...`)
      const results = await primarySource.searchMovies(query)
      if (results.length > 0) {
        console.log(`Found ${results.length} results with ${primarySource.name}`)
        return results
      }
    } catch (error) {
      console.error(`Error searching with primary source:`, error)
    }

    // If primary source fails or returns no results, try the others
    for (let i = 1; i < this.availableSources.length; i++) {
      try {
        const source = this.availableSources[i]
        console.log(`Searching with fallback source ${source.name}...`)
        const results = await source.searchMovies(query)
        if (results.length > 0) {
          console.log(`Found ${results.length} results with ${source.name}`)
          return results
        }
      } catch (error) {
        console.error(`Error searching with ${this.availableSources[i].name}:`, error)
      }
    }

    console.log("No results found with any source")
    return []
  }

  // Add this method to the MetadataService class
  async searchMoviesWithUpcoming(query: string): Promise<BasicMovieInfo[]> {
    await this.ensureInitialized()

    if (this.availableSources.length === 0) {
      console.error("No metadata sources available")
      return []
    }

    // Get regular search results
    const searchResults = await this.searchMovies(query)

    // If we have enough results or the query is very short, return just the search results
    if (searchResults.length >= 5 || query.trim().length < 3) {
      return searchResults
    }

    // If we don't have many results, try to find the movie in upcoming releases
    try {
      // Find the TMDB adapter
      const tmdbAdapter = this.availableSources.find((source) => source.name === "TMDB")
      if (tmdbAdapter && "getUpcomingMovies" in tmdbAdapter) {
        const upcomingMovies = await (tmdbAdapter as any).getUpcomingMovies()

        // Filter upcoming movies that match the query
        const matchingUpcoming = upcomingMovies.filter((movie: BasicMovieInfo) =>
          movie.title.toLowerCase().includes(query.toLowerCase()),
        )

        // Combine results, removing duplicates
        const existingIds = new Set(searchResults.map((movie) => movie.id))
        const uniqueUpcoming = matchingUpcoming.filter((movie: BasicMovieInfo) => !existingIds.has(movie.id))

        return [...searchResults, ...uniqueUpcoming]
      }
    } catch (error) {
      console.error("Error fetching upcoming movies:", error)
    }

    return searchResults
  }

  async getEnhancedMetadata(id: string | number, options: MetadataFetchOptions = {}): Promise<MovieMetadata | null> {
    await this.ensureInitialized()

    // Get metadata from primary source
    console.log(`Getting enhanced metadata for ID ${id}...`)
    const primaryMetadata = await this.getMovieMetadata(id, options)
    if (!primaryMetadata) {
      console.warn(`No primary metadata found for ID ${id}`)
      return null
    }

    // Try to enhance with data from other sources
    const enhancedMetadata = { ...primaryMetadata }
    console.log(`Enhancing metadata from ${primaryMetadata.source}...`)

    // Skip the primary source that we already used
    const secondarySources = this.availableSources.filter((source) => source.name !== primaryMetadata.source)

    for (const source of secondarySources) {
      try {
        // Use external IDs to fetch from other sources if possible
        let sourceId = id
        if (primaryMetadata.externalIds) {
          if (source.name === "OMDB" && primaryMetadata.externalIds.imdb) {
            sourceId = primaryMetadata.externalIds.imdb
          } else if (source.name === "TMDB" && primaryMetadata.externalIds.tmdb) {
            sourceId = primaryMetadata.externalIds.tmdb
          } else if (source.name === "Wikidata" && primaryMetadata.externalIds.wikidata) {
            sourceId = primaryMetadata.externalIds.wikidata
          } else if (source.name === "MovieLens" && primaryMetadata.externalIds.movieLens) {
            sourceId = primaryMetadata.externalIds.movieLens
          }
        }

        console.log(`Enhancing with ${source.name} using ID ${sourceId}...`)
        const secondaryMetadata = await source.getMovieMetadata(sourceId, options)
        if (secondaryMetadata) {
          console.log(`Successfully enhanced with data from ${source.name}`)
          // Merge the metadata, preferring primary source for conflicts
          this.mergeMetadata(enhancedMetadata, secondaryMetadata)
        }
      } catch (error) {
        console.error(`Error enhancing metadata with ${source.name}:`, error)
      }
    }

    return this.sanitizeMetadata(enhancedMetadata)
  }

  // Methods for managing custom database entries
  async addOrUpdateCustomMovie(movie: MovieMetadata): Promise<void> {
    return this.customDB.addOrUpdateMovie(movie)
  }

  async removeCustomMovie(id: string | number): Promise<boolean> {
    return this.customDB.removeMovie(id)
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private mergeMetadata(target: MovieMetadata, source: MovieMetadata): void {
    // Only add properties that don't exist in the target
    Object.keys(source).forEach((key) => {
      const k = key as keyof MovieMetadata
      if (
        target[k] === undefined ||
        target[k] === null ||
        (Array.isArray(target[k]) && (target[k] as any[]).length === 0)
      ) {
        target[k] = source[k]
      }
    })

    // Special handling for external IDs - always merge these
    if (source.externalIds) {
      target.externalIds = { ...target.externalIds, ...source.externalIds }
    }

    // Special handling for videos - combine unique videos
    if (source.videos && source.videos.length > 0) {
      if (!target.videos) {
        target.videos = [...source.videos]
      } else {
        // Add videos that don't already exist in the target
        const existingKeys = new Set(target.videos.map((v: any) => v.key))
        source.videos.forEach((video: any) => {
          if (!existingKeys.has(video.key)) {
            target.videos!.push(video)
          }
        })
      }
    }

    // Special handling for cast - combine unique cast members
    if (source.cast && source.cast.length > 0) {
      if (!target.cast) {
        target.cast = [...source.cast]
      } else {
        // Add cast members that don't already exist in the target
        const existingNames = new Set(target.cast.map((c: any) => c.name.toLowerCase()))
        source.cast.forEach((castMember: any) => {
          if (!existingNames.has(castMember.name.toLowerCase())) {
            target.cast!.push(castMember)
          }
        })
      }
    }

    // Special handling for crew - combine unique crew members
    if (source.crew && source.crew.length > 0) {
      if (!target.crew) {
        target.crew = [...source.crew]
      } else {
        // Add crew members that don't already exist in the target
        const existingKeys = new Set(target.crew.map((c: any) => `${c.name.toLowerCase()}-${c.job?.toLowerCase() || ""}`))
        source.crew.forEach((crewMember: any) => {
          const key = `${crewMember.name.toLowerCase()}-${crewMember.job?.toLowerCase() || ""}`
          if (!existingKeys.has(key)) {
            target.crew!.push(crewMember)
          }
        })
      }
    }

    // Special handling for genres - combine unique genres
    if (source.genres && source.genres.length > 0) {
      if (!target.genres) {
        target.genres = [...source.genres]
      } else {
        // Add genres that don't already exist in the target
        const existingGenres = new Set(target.genres.map((g: string) => g.toLowerCase()))
        source.genres.forEach((genre: string) => {
          if (!existingGenres.has(genre.toLowerCase())) {
            target.genres!.push(genre)
          }
        })
      }
    }

    // Special handling for similar movies - combine unique similar movies
    if (source.similar && source.similar.length > 0) {
      if (!target.similar) {
        target.similar = [...source.similar]
      } else {
        // Add similar movies that don't already exist in the target
        const existingIds = new Set(target.similar.map((m: MovieMetadata) => m.id))
        source.similar.forEach((movie: MovieMetadata) => {
          if (!existingIds.has(movie.id)) {
            target.similar!.push(movie)
          }
        })
      }
    }

    // Update source to indicate it's a combined result
    if (target.source !== source.source) {
      target.source = `${target.source}, ${source.source}`
    }
  }

  private sanitizeMetadata(metadata: MovieMetadata | null): MovieMetadata | null {
    if (!metadata) return null

    // Create a copy to avoid mutating the original
    const sanitized = { ...metadata }

    // Sanitize numeric values
    if (sanitized.rating !== undefined && (isNaN(sanitized.rating) || sanitized.rating === null)) {
      sanitized.rating = 0
    }

    if (sanitized.runtime !== undefined && (isNaN(sanitized.runtime) || sanitized.runtime === null)) {
      sanitized.runtime = 0
    }

    if (sanitized.voteCount !== undefined && (isNaN(sanitized.voteCount) || sanitized.voteCount === null)) {
      sanitized.voteCount = 0
    }

    if (sanitized.budget !== undefined && (isNaN(sanitized.budget) || sanitized.budget === null)) {
      sanitized.budget = 0
    }

    if (sanitized.revenue !== undefined && (isNaN(sanitized.revenue) || sanitized.revenue === null)) {
      sanitized.revenue = 0
    }

    // Ensure arrays are defined
    if (!sanitized.genres) sanitized.genres = []
    if (!sanitized.writers) sanitized.writers = []
    if (!sanitized.cast) sanitized.cast = []
    if (!sanitized.crew) sanitized.crew = []
    if (!sanitized.videos) sanitized.videos = []
    if (!sanitized.similar) sanitized.similar = []
    if (!sanitized.languages) sanitized.languages = []
    if (!sanitized.keywords) sanitized.keywords = []
    if (!sanitized.productionCompanies) sanitized.productionCompanies = []

    return sanitized
  }
}

// Create a singleton instance
export const metadataService = new MetadataService()

