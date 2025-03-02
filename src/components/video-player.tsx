"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Play } from "lucide-react"
import { Button } from "@/src/components/ui/button"
import type { VideoResult } from "@/src/lib/tmdb"

interface VideoPlayerProps {
  videos: VideoResult[]
}

export function VideoPlayer({ videos }: VideoPlayerProps) {
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)

  const trailers = videos.filter(
    (video) => video.site === "YouTube" && (video.type === "Trailer" || video.type === "Teaser"),
  )

  if (trailers.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
        <p className="text-muted-foreground">No trailers available</p>
      </div>
    )
  }

  const currentVideo = trailers[currentVideoIndex]

  const handlePrevVideo = () => {
    setCurrentVideoIndex((prev) => (prev > 0 ? prev - 1 : trailers.length - 1))
    setIsLoading(true)
  }

  const handleNextVideo = () => {
    setCurrentVideoIndex((prev) => (prev < trailers.length - 1 ? prev + 1 : 0))
    setIsLoading(true)
  }

  const handlePlay = () => {
    setIsPlaying(true)
  }

  return (
    <div className="space-y-4">
      <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden">
        {!isPlaying ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="lg"
              variant="ghost"
              className="w-16 h-16 rounded-full bg-background/80 hover:bg-background/90"
              onClick={handlePlay}
            >
              <Play className="w-8 h-8 fill-primary text-primary" />
            </Button>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            )}
            <iframe
              src={`https://www.youtube.com/embed/${currentVideo.key}?autoplay=1&rel=0`}
              title={currentVideo.name}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setIsLoading(false)}
            />
          </>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <Button variant="outline" size="icon" onClick={handlePrevVideo} disabled={trailers.length <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 text-center">
          <p className="font-medium">{currentVideo.name}</p>
          <p className="text-sm text-muted-foreground">
            {currentVideoIndex + 1} of {trailers.length}
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={handleNextVideo} disabled={trailers.length <= 1}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

