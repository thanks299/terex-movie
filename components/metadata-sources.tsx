"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Database, Film, Youtube, BookOpen, Users, Image, Server } from "lucide-react"

interface MetadataSourcesProps {
  sources: string
}

export function MetadataSources({ sources }: MetadataSourcesProps) {
  const [sourceList, setSourceList] = useState<string[]>([])

  useEffect(() => {
    if (sources) {
      setSourceList(sources.split(", "))
    }
  }, [sources])

  if (!sourceList.length) return null

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      <TooltipProvider>
        {sourceList.map((source) => (
          <Tooltip key={source}>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="flex items-center gap-1">
                {getSourceIcon(source)}
                {source}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{getSourceDescription(source)}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </TooltipProvider>
    </div>
  )
}

function getSourceIcon(source: string) {
  switch (source) {
    case "TMDB":
      return <Film className="w-3 h-3" />
    case "OMDB":
      return <Film className="w-3 h-3" />
    case "MovieLens":
      return <Users className="w-3 h-3" />
    case "TMPDB":
      return <Image className="w-3 h-3" />
    case "YouTube":
      return <Youtube className="w-3 h-3" />
    case "Wikidata":
      return <BookOpen className="w-3 h-3" />
    case "OpenMedia":
      return <Users className="w-3 h-3" />
    case "CustomDB":
      return <Server className="w-3 h-3" />
    default:
      return <Database className="w-3 h-3" />
  }
}

function getSourceDescription(source: string) {
  switch (source) {
    case "TMDB":
      return "The Movie Database - Primary source for movie information"
    case "OMDB":
      return "Open Movie Database - Secondary source with IMDb data"
    case "MovieLens":
      return "MovieLens - Community ratings and recommendations"
    case "TMPDB":
      return "The Movie Poster Database - High-quality movie posters"
    case "YouTube":
      return "YouTube - Video trailers and clips"
    case "Wikidata":
      return "Wikidata - Structured data from Wikimedia"
    case "OpenMedia":
      return "Open Media Database - Community-driven open source database"
    case "CustomDB":
      return "Custom Database - Manually curated movie information"
    default:
      return "Unknown source"
  }
}

