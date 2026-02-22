"use client";

import { cn } from "@/lib/utils";
import { TranscriptionSegment } from "@/types";

interface SegmentCardProps {
  segment: TranscriptionSegment;
  isActive?: boolean;
  onSeek?: (time: number) => void;
  className?: string;
}

function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}`;
}

export function SegmentCard({
  segment,
  isActive = false,
  onSeek,
  className,
}: SegmentCardProps) {
  const handleClick = () => {
    onSeek?.(segment.start);
  };

  return (
    <div
      className={cn(
        "group flex gap-3 p-3 rounded-xl transition-all duration-200",
        "hover:bg-muted/50",
        isActive && "bg-primary/5 border-l-2 border-l-primary",
        className
      )}
    >
      <button
        onClick={handleClick}
        className={cn(
          "shrink-0 px-2 py-1 rounded-md text-xs font-medium",
          "bg-muted text-muted-foreground",
          "hover:bg-primary hover:text-primary-foreground",
          "transition-colors duration-200",
          isActive && "bg-primary text-primary-foreground"
        )}
        title="Jump to this timestamp"
      >
        {formatTimestamp(segment.start)}
      </button>
      <p className="text-sm leading-relaxed text-foreground">{segment.text}</p>
    </div>
  );
}
