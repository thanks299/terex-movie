import type { MetadataSource, MovieMetadata, BasicMovieInfo, MetadataFetchOptions } from "@/types/metadata.ts"

export abstract class BaseMetadataAdapter implements MetadataSource {
  abstract name: string
  abstract priority: number

  abstract getMovieMetadata(id: string | number, options?: MetadataFetchOptions): Promise<MovieMetadata | null>
  abstract searchMovies(query: string): Promise<BasicMovieInfo[]>

  async isAvailable(): Promise<boolean> {
    try {
      // Simple test to check if the API is available
      // Use a minimal query that's less likely to fail
      const results = await this.searchMovies("test")
      return Array.isArray(results)
    } catch (error) {
      console.error(`${this.name} API is not available:`, error)
      return false
    }
  }

  protected normalizeRating(rating: number, maxRating = 10): number {
    return (rating / maxRating) * 10
  }

  protected formatDate(date: string): string {
    if (!date) return ""

    try {
      return new Date(date).toISOString().split("T")[0]
    } catch (e) {
      return date
    }
  }
}
