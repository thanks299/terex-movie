import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions } from "@/types/metadata"
import { BaseMetadataAdapter } from "./base-adapter"

// This adapter would typically connect to a database or spreadsheet
// For demonstration, we'll use a mock in-memory database
export class CustomDatabaseAdapter extends BaseMetadataAdapter {
  name = "CustomDB"
  priority = 0 // Highest priority - overrides all other sources

  private customMovies: Record<string, MovieMetadata> = {}

  constructor() {
    super()
    // Initialize with some sample curated data
    this.initializeSampleData()
  }

  async getMovieMetadata(id: string | number, options?: MetadataFetchOptions): Promise<MovieMetadata | null> {
    const idStr = id.toString()
    return this.customMovies[idStr] || null
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    const lowerQuery = query.toLowerCase()

    return Object.values(this.customMovies)
      .filter((movie) => movie.title.toLowerCase().includes(lowerQuery))
      .map((movie) => ({
        id: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        releaseDate: movie.releaseDate,
        rating: movie.rating,
      }))
  }

  // Add a new movie or update an existing one
  async addOrUpdateMovie(movie: MovieMetadata): Promise<void> {
    this.customMovies[movie.id] = {
      ...movie,
      source: this.name,
    }
  }

  // Remove a movie from the custom database
  async removeMovie(id: string | number): Promise<boolean> {
    const idStr = id.toString()
    if (this.customMovies[idStr]) {
      delete this.customMovies[idStr]
      return true
    }
    return false
  }

  // Update the isAvailable method to always return true since it's our fallback

  async isAvailable(): Promise<boolean> {
    // Custom DB is always available as it's in-memory
    return true
  }

  // Initialize with some sample curated data
  private initializeSampleData(): void {
    const sampleMovies: MovieMetadata[] = [
      {
        id: "custom-1",
        title: "Inception",
        overview:
          "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.",
        posterUrl: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg",
        releaseDate: "2010-07-16",
        runtime: 148,
        genres: ["Action", "Science Fiction", "Adventure"],
        rating: 8.8,
        director: "Christopher Nolan",
        writers: ["Christopher Nolan"],
        cast: [
          { id: "custom-actor-1", name: "Leonardo DiCaprio", character: "Dom Cobb" },
          { id: "custom-actor-2", name: "Joseph Gordon-Levitt", character: "Arthur" },
          { id: "custom-actor-3", name: "Ellen Page", character: "Ariadne" },
        ],
        externalIds: {
          imdb: "tt1375666",
          tmdb: 27205,
        },
        source: this.name,
      },
      {
        id: "custom-2",
        title: "The Godfather",
        overview:
          "The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son.",
        posterUrl: "https://image.tmdb.org/t/p/w500/3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
        backdropUrl: "https://image.tmdb.org/t/p/original/tmU7GeKVybMWFButWEGl2M4GeiP.jpg",
        releaseDate: "1972-03-14",
        runtime: 175,
        genres: ["Drama", "Crime"],
        rating: 9.2,
        director: "Francis Ford Coppola",
        writers: ["Mario Puzo", "Francis Ford Coppola"],
        cast: [
          { id: "custom-actor-4", name: "Marlon Brando", character: "Don Vito Corleone" },
          { id: "custom-actor-5", name: "Al Pacino", character: "Michael Corleone" },
          { id: "custom-actor-6", name: "James Caan", character: "Sonny Corleone" },
        ],
        externalIds: {
          imdb: "tt0068646",
          tmdb: 238,
        },
        source: this.name,
      },
    ]

    sampleMovies.forEach((movie) => {
      this.customMovies[movie.id] = movie
    })
  }
}

