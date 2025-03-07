import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions } from "@/types/metadata"
import { BaseMetadataAdapter } from "./base-adapter"

// Wikidata API
// No API key required
const WIKIDATA_ENDPOINT = "https://www.wikidata.org/w/api.php"

export class WikidataAdapter extends BaseMetadataAdapter {
  name = "Wikidata"
  priority = 6

  async getMovieMetadata(id: string | number, options?: MetadataFetchOptions): Promise<MovieMetadata | null> {
    try {
      // Handle different ID types
      let wikidataId: string

      if (typeof id === "string" && id.startsWith("Q")) {
        // Already a Wikidata ID
        wikidataId = id
      } else {
        // Try to find the Wikidata ID from external IDs
        wikidataId = await this.findWikidataId(id)

        if (!wikidataId) {
          console.warn(`No Wikidata ID found for ${id}`)
          return null
        }
      }

      // Fetch entity data from Wikidata
      const url = `${WIKIDATA_ENDPOINT}?action=wbgetentities&ids=${wikidataId}&format=json&props=labels|descriptions|claims|sitelinks&origin=*`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Wikidata API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.entities || !data.entities[wikidataId]) {
        console.warn(`No Wikidata entity found for ${wikidataId}`)
        return null
      }

      const entity = data.entities[wikidataId]

      // Extract movie data from Wikidata entity
      const title = this.getEntityLabel(entity, options?.language || "en")
      const description = this.getEntityDescription(entity, options?.language || "en")
      const imdbId = this.getClaimValue(entity, "P345") // P345 is the property for IMDb ID
      const releaseDate = this.getDateClaimValue(entity, "P577") // P577 is the property for publication date
      const genres = this.getItemClaimLabels(entity, "P136") // P136 is the property for genre
      const directors = this.getItemClaimLabels(entity, "P57") // P57 is the property for director
      const cast = this.getItemClaimLabels(entity, "P161") // P161 is the property for cast member

      // Get English Wikipedia URL if available
      const wikipediaUrl =
        entity.sitelinks && entity.sitelinks.enwiki
          ? `https://en.wikipedia.org/wiki/${encodeURIComponent(entity.sitelinks.enwiki.title)}`
          : undefined

      return {
        id: wikidataId,
        title: title || `Unknown (${wikidataId})`,
        overview: description,
        releaseDate: releaseDate ? this.formatDate(releaseDate) : undefined,
        genres: genres,
        director: directors && directors.length > 0 ? directors[0] : undefined,
        cast: cast?.map((name, index) => ({
          id: `wikidata-actor-${index}`,
          name,
          character: "",
        })),
        externalIds: {
          wikidata: wikidataId,
          imdb: imdbId,
        },
        source: this.name,
      }
    } catch (error) {
      console.error("Error fetching Wikidata metadata:", error)
      return null
    }
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    try {
      // Search for movies in Wikidata
      const url = `${WIKIDATA_ENDPOINT}?action=wbsearchentities&search=${encodeURIComponent(query)}&language=en&format=json&type=item&origin=*`

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`Wikidata search API error: ${response.status}`)
      }

      const data = await response.json()

      if (!data.search || data.search.length === 0) {
        return []
      }

      // Filter results to only include movies
      // This requires fetching each entity to check if it's a movie
      const movieResults: BasicMovieInfo[] = []

      for (const result of data.search.slice(0, 10)) {
        try {
          const entityUrl = `${WIKIDATA_ENDPOINT}?action=wbgetentities&ids=${result.id}&format=json&props=claims&origin=*`
          const entityResponse = await fetch(entityUrl)

          if (entityResponse.ok) {
            const entityData = await entityResponse.json()
            const entity = entityData.entities[result.id]

            // Check if the entity is a movie (instance of film - P31:Q11424)
            const isMovie = this.hasInstanceOfFilm(entity)

            if (isMovie) {
              const releaseDate = this.getDateClaimValue(entity, "P577")

              movieResults.push({
                id: result.id,
                title: result.label || result.id,
                releaseDate: releaseDate ? this.formatDate(releaseDate) : undefined,
              })
            }
          }
        } catch (e) {
          console.warn(`Error checking if ${result.id} is a movie:`, e)
        }
      }

      return movieResults
    } catch (error) {
      console.error("Error searching Wikidata:", error)
      return []
    }
  }

  // Helper method to find a Wikidata ID from other IDs
  private async findWikidataId(id: string | number): Promise<string> {
    try {
      // Check if it's a TMDB ID
      if (typeof id === "number" || !isNaN(Number.parseInt(id.toString()))) {
        const tmdbId = typeof id === "number" ? id : Number.parseInt(id.toString())

        // Search for items with this TMDB ID (P4947)
        const url = `${WIKIDATA_ENDPOINT}?action=query&list=search&srsearch=haswbstatement:P4947=${tmdbId}&format=json&origin=*`

        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()

          if (data.query && data.query.search && data.query.search.length > 0) {
            return data.query.search[0].title // The title is the Wikidata ID (e.g., Q12345)
          }
        }
      }

      // Check if it's an IMDb ID
      if (typeof id === "string" && id.startsWith("tt")) {
        // Search for items with this IMDb ID (P345)
        const url = `${WIKIDATA_ENDPOINT}?action=query&list=search&srsearch=haswbstatement:P345=${id}&format=json&origin=*`

        const response = await fetch(url)
        if (response.ok) {
          const data = await response.json()

          if (data.query && data.query.search && data.query.search.length > 0) {
            return data.query.search[0].title
          }
        }
      }

      return ""
    } catch (error) {
      console.error("Error finding Wikidata ID:", error)
      return ""
    }
  }

  // Helper method to get a label from an entity
  private getEntityLabel(entity: any, language: string): string {
    if (entity.labels && entity.labels[language]) {
      return entity.labels[language].value
    }

    // Fallback to English
    if (language !== "en" && entity.labels && entity.labels.en) {
      return entity.labels.en.value
    }

    return ""
  }

  // Helper method to get a description from an entity
  private getEntityDescription(entity: any, language: string): string {
    if (entity.descriptions && entity.descriptions[language]) {
      return entity.descriptions[language].value
    }

    // Fallback to English
    if (language !== "en" && entity.descriptions && entity.descriptions.en) {
      return entity.descriptions.en.value
    }

    return ""
  }

  // Helper method to get a string value from a claim
  private getClaimValue(entity: any, propertyId: string): string {
    if (entity.claims && entity.claims[propertyId]) {
      const claim = entity.claims[propertyId][0]

      if (claim.mainsnak && claim.mainsnak.datavalue) {
        return claim.mainsnak.datavalue.value
      }
    }

    return ""
  }

  // Helper method to get a date value from a claim
  private getDateClaimValue(entity: any, propertyId: string): string {
    if (entity.claims && entity.claims[propertyId]) {
      const claim = entity.claims[propertyId][0]

      if (claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.type === "time") {
        return claim.mainsnak.datavalue.value.time.replace("+", "").replace("T00:00:00Z", "")
      }
    }

    return ""
  }

  // Helper method to get labels for item claims (e.g., genres, directors)
  private getItemClaimLabels(entity: any, propertyId: string): string[] {
    const items: string[] = []

    if (entity.claims && entity.claims[propertyId]) {
      for (const claim of entity.claims[propertyId]) {
        if (claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.type === "wikibase-entityid") {
          const itemId = claim.mainsnak.datavalue.value.id

          // We would need to fetch the label for this item ID
          // In a real implementation, you would batch these requests
          // For now, we'll just store the ID
          items.push(itemId)
        }
      }
    }

    return items
  }

  // Helper method to check if an entity is a movie
  private hasInstanceOfFilm(entity: any): boolean {
    if (entity.claims && entity.claims.P31) {
      for (const claim of entity.claims.P31) {
        if (claim.mainsnak && claim.mainsnak.datavalue && claim.mainsnak.datavalue.type === "wikibase-entityid") {
          const itemId = claim.mainsnak.datavalue.value.id

          // Q11424 is the Wikidata item for "film"
          if (itemId === "Q11424") {
            return true
          }
        }
      }
    }

    return false
  }
}

