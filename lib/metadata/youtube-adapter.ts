import type { MovieMetadata, BasicMovieInfo, MetadataFetchOptions, VideoInfo } from "@/types/metadata"
import { BaseMetadataAdapter } from "./base-adapter"

// YouTube Data API v3
// You need to get an API key from Google Cloud Console
// https://developers.google.com/youtube/v3/getting-started
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || "YOUR_YOUTUBE_API_KEY"
const BASE_URL = "https://www.googleapis.com/youtube/v3"

export class YouTubeAdapter extends BaseMetadataAdapter {
  name = "YouTube"
  priority = 5

  async getMovieMetadata(id: string | number, options?: MetadataFetchOptions): Promise<MovieMetadata | null> {
    try {
      // For YouTube, we need to search for videos related to the movie
      // First, get the movie title if we have an ID
      let movieTitle = ""

      if (typeof id === "string" && !id.startsWith("youtube_")) {
        // If it's not a YouTube video ID, assume it's a movie title
        movieTitle = id
      } else if (typeof id === "number") {
        // If it's a number, assume it's a TMDB ID and try to get the title
        try {
          const tmdbUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}`
          const response = await fetch(tmdbUrl)
          if (response.ok) {
            const data = await response.json()
            movieTitle = data.title
          }
        } catch (e) {
          console.warn(`Failed to get movie title for TMDB ID ${id}:`, e)
          return null
        }
      }

      if (!movieTitle) {
        return null
      }

      // Search for trailers and videos related to the movie
      const videos = await this.searchYouTubeVideos(`${movieTitle} official trailer`)

      if (!videos || videos.length === 0) {
        return null
      }

      return {
        id: id.toString(),
        title: movieTitle,
        videos: videos,
        source: this.name,
      }
    } catch (error) {
      console.error("Error fetching YouTube metadata:", error)
      return null
    }
  }

  async searchMovies(query: string): Promise<BasicMovieInfo[]> {
    try {
      // Check if API key is available
      if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "YOUR_YOUTUBE_API_KEY") {
        console.warn("YouTube API key not configured")
        return []
      }

      // Search for movie trailers on YouTube
      const videos = await this.searchYouTubeVideos(`${query} movie trailer`)

      return videos.map((video) => {
        // Extract the movie title from the video title
        // This is a simple heuristic and might not always work perfectly
        const title = video.name
          .replace(/official trailer/i, "")
          .replace(/trailer/i, "")
          .replace(/$$.*?$$/g, "")
          .replace(/\[.*?\]/g, "")
          .replace(/\|.*$/g, "")
          .trim()

        return {
          id: `youtube_${video.id}`,
          title: title,
          // YouTube thumbnails as poster images
          posterUrl: `https://img.youtube.com/vi/${video.key}/maxresdefault.jpg`,
        }
      })
    } catch (error) {
      console.error("Error searching YouTube:", error)
      return []
    }
  }

  private async searchYouTubeVideos(query: string): Promise<VideoInfo[]> {
    try {
      // Check if API key is available
      if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "YOUR_YOUTUBE_API_KEY") {
        console.warn("YouTube API key not configured")
        return []
      }

      // Use the YouTube Data API to search for videos
      const url = `${BASE_URL}/search?part=snippet&maxResults=10&q=${encodeURIComponent(query)}&type=video&key=${YOUTUBE_API_KEY}`

      const response = await fetch(url)
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`YouTube API error: ${response.status} - ${errorText}`)
      }

      const data = await response.json()

      // Transform the results to our VideoInfo format
      return data.items.map((item: any) => ({
        id: item.id.videoId,
        key: item.id.videoId,
        site: "YouTube",
        type: item.snippet.title.toLowerCase().includes("trailer") ? "Trailer" : "Clip",
        name: item.snippet.title,
        size: 1080, // Assume HD
        official:
          item.snippet.channelTitle.includes("Official") || item.snippet.title.toLowerCase().includes("official"),
        publishedAt: item.snippet.publishedAt,
      }))
    } catch (error) {
      console.error("Error searching YouTube videos:", error)
      return []
    }
  }

  // Override the isAvailable method to handle YouTube API specifically
  async isAvailable(): Promise<boolean> {
    // If no API key is configured, the adapter is not available
    if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === "YOUR_YOUTUBE_API_KEY") {
      console.warn("YouTube adapter not available: API key not configured")
      return false
    }

    try {
      // Make a minimal API call to check if the API is working
      // Using a simple search with minimal results
      const url = `${BASE_URL}/search?part=snippet&maxResults=1&q=test&type=video&key=${YOUTUBE_API_KEY}`

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(url, {
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId))

      if (!response.ok) {
        const errorText = await response.text()
        console.warn(`YouTube API not available: ${response.status} - ${errorText}`)
        return false
      }

      const data = await response.json()
      return Array.isArray(data.items)
    } catch (error) {
      console.warn("YouTube API not available:", error)
      return false
    }
  }
}

