export interface Movie {
  id: number
  title: string
  overview: string
  poster_path: string
  release_date: string
  vote_average: number
}

export interface Review {
  id: string
  movieId: number
  rating: number
  comment: string
  author: string
  createdAt: string
}

