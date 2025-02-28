import Image from "next/image"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"
import { Calendar, Star } from "lucide-react"
import type { Movie } from "../../types"
import { getImageUrl } from "../lib/tmdb"

interface MovieCardProps {
  movie: Movie
  onClick: (movie: Movie) => void
}

export function MovieCard({ movie, onClick }: MovieCardProps) {
  return (
    <Card
      className="overflow-hidden cursor-pointer transition-all hover:scale-105 hover:shadow-lg"
      onClick={() => onClick(movie)}
    >
      <div className="relative aspect-[2/3] w-full">
        <Image
          src={getImageUrl(movie.poster_path) || "/placeholder.svg"}
          alt={movie.title}
          fill
          className="object-cover"
          priority
        />
      </div>
      <CardHeader className="p-4">
        <CardTitle className="text-lg line-clamp-1">{movie.title}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-4 mb-2">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 fill-secondary text-secondary" />
            <span>{movie.vote_average.toFixed(1)}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{new Date(movie.release_date).getFullYear()}</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{movie.overview}</p>
      </CardContent>
    </Card>
  )
}

