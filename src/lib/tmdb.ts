const TMDB_API_KEY = process.env.NEXT_PUBLIC_TMDB_API_KEY
const BASE_URL = "https://api.themoviedb.org/3"
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500"

export async function searchMovies(query: string) {
  const response = await fetch(`${BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`)
  const data = await response.json()
  return data.results
}

export async function getMovieDetails(id: number) {
  const response = await fetch(`${BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`)
  const data = await response.json()
  return data
}

export function getImageUrl(path: string) {
  if (!path) return "/placeholder.svg?height=500&width=333"
  return `${IMAGE_BASE_URL}${path}`
}

