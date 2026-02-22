"use client";

import { useRef, useEffect, useMemo } from "react";
import { TranscriptionSegment } from "@/types";
import { SegmentCard } from "./segment-card";
import { cn } from "@/lib/utils";

interface TranscriptionViewerProps {
  segments: TranscriptionSegment[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  className?: string;
  showTimestamps?: boolean;
}

export function TranscriptionViewer({
  segments,
  currentTime = 0,
  onSeek,
  className,
  showTimestamps = true,
}: TranscriptionViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeSegmentRef = useRef<HTMLDivElement>(null);

  // Find the current active segment based on playback time
  const activeIndex = useMemo(() => {
    if (!segments.length) return -1;

    // Ensure currentTime is a number
    const time = typeof currentTime === 'number' ? currentTime : parseFloat(currentTime as unknown as string) || 0;

    // First try: find segment where currentTime falls within [start, end)
    // Using < for end to handle adjacent segments (e.g., end: 5.32, next start: 5.32)
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      // Ensure start and end are numbers
      const start = typeof segment.start === 'number' ? segment.start : parseFloat(segment.start as unknown as string) || 0;
      const end = typeof segment.end === 'number' ? segment.end : parseFloat(segment.end as unknown as string) || 0;

      if (time >= start && time < end) {
        return i;
      }
    }

    // Second try: handle edge case where currentTime exactly equals a segment start
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const start = typeof segment.start === 'number' ? segment.start : parseFloat(segment.start as unknown as string) || 0;
      if (Math.abs(time - start) < 0.001) {
        return i;
      }
    }

    // If between segments, find the closest upcoming segment
    for (let i = 0; i < segments.length; i++) {
      const start = typeof segments[i].start === 'number' ? segments[i].start : parseFloat(segments[i].start as unknown as string) || 0;
      if (start > time) {
        return Math.max(0, i - 1);
      }
    }

    return segments.length - 1;
  }, [segments, currentTime]);

  // Auto-scroll to active segment
  useEffect(() => {
    if (
      activeSegmentRef.current &&
      containerRef.current &&
      activeIndex >= 0
    ) {
      const container = containerRef.current;
      const activeElement = activeSegmentRef.current;

      const containerRect = container.getBoundingClientRect();
      const activeRect = activeElement.getBoundingClientRect();

      // Check if element is visible
      const isVisible =
        activeRect.top >= containerRect.top + 50 &&
        activeRect.bottom <= containerRect.bottom - 50;

      if (!isVisible) {
        activeElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }
  }, [activeIndex]);

  if (!segments.length) {
    return (
      <div className={cn("text-center text-muted-foreground py-8", className)}>
        No transcription segments available.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
        className
      )}
    >
      <div className="space-y-1">
        {segments.map((segment, index) => (
          <div
            key={segment.id}
            ref={index === activeIndex ? activeSegmentRef : undefined}
          >
            {showTimestamps ? (
              <SegmentCard
                segment={segment}
                isActive={index === activeIndex}
                onSeek={onSeek}
              />
            ) : (
              <span className="text-sm leading-relaxed text-muted-foreground">
                {segment.text}{" "}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Format segments into SRT subtitle format
export function formatAsSRT(segments: TranscriptionSegment[]): string {
  return segments
    .map((segment, index) => {
      const start = formatSrtTimestamp(segment.start);
      const end = formatSrtTimestamp(segment.end);
      return `${index + 1}\n${start} --> ${end}\n${segment.text.trim()}\n`;
    })
    .join("\n");
}

// Format segments into WebVTT format
export function formatAsVTT(segments: TranscriptionSegment[]): string {
  const vttContent = segments
    .map((segment) => {
      const start = formatVttTimestamp(segment.start);
      const end = formatVttTimestamp(segment.end);
      return `${start} --> ${end}\n${segment.text.trim()}`;
    })
    .join("\n\n");

  return `WEBVTT\n\n${vttContent}`;
}

// Format segments into Markdown with timestamps
export function formatAsMarkdown(
  segments: TranscriptionSegment[],
  title?: string
): string {
  const header = title ? `# ${title}\n\n` : "";
  const content = segments
    .map((segment) => {
      const timestamp = formatTimestamp(segment.start);
      return `[${timestamp}] ${segment.text.trim()}`;
    })
    .join("\n\n");

  return `${header}${content}`;
}

// Helper functions
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

function formatSrtTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")},${ms
    .toString()
    .padStart(3, "0")}`;
}

function formatVttTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  if (hours > 0) {
    return `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${ms
      .toString()
      .padStart(3, "0")}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${secs
    .toString()
    .padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}
