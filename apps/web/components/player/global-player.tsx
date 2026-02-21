"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { usePlayerStore } from "@/store/player-store";
import { formatDuration } from "@/lib/utils";
import { Waveform } from "./waveform";

export function GlobalPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const {
    currentEpisode,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    skipForward,
    skipBackward,
  } = usePlayerStore();

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  useEffect(() => {
    if (currentEpisode?.audioUrl && audioRef.current) {
      audioRef.current.src = currentEpisode.audioUrl;
      audioRef.current.playbackRate = playbackRate;
      if (isPlaying) {
        audioRef.current.play();
      }
    }
  }, [currentEpisode?.audioUrl]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  if (!currentEpisode) {
    return null;
  }

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-3 md:p-4 z-50 md:bottom-0 bottom-16">
        <div className="flex items-center gap-2 md:gap-4">
          {/* Episode Info - Simplified on mobile */}
          <div className="w-auto md:w-64 shrink-0 flex items-center gap-2 md:gap-3">
            <div className="w-10 h-10 md:w-14 md:h-14 relative bg-muted rounded overflow-hidden shrink-0">
              {currentEpisode.podcastImage ? (
                <Image
                  src={currentEpisode.podcastImage}
                  alt={currentEpisode.podcastTitle || ""}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                  No Image
                </div>
              )}
            </div>
            <div className="min-w-0 hidden md:block">
              <p className="font-medium text-sm truncate">
                {currentEpisode.title}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentEpisode.podcastTitle}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col items-center gap-1 md:gap-2">
            <div className="flex items-center gap-1 md:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:h-10 md:w-10"
                onClick={() => skipBackward(10)}
              >
                <SkipBack className="h-3 w-3 md:h-4 md:w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 md:h-10 md:w-10"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="h-3 w-3 md:h-4 md:w-4" />
                ) : (
                  <Play className="h-3 w-3 md:h-4 md:w-4" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:h-10 md:w-10"
                onClick={() => skipForward(30)}
              >
                <SkipForward className="h-3 w-3 md:h-4 md:w-4" />
              </Button>
            </div>

            <div className="w-full flex items-center gap-2 md:gap-3">
              <span className="text-xs text-muted-foreground w-10 md:w-12 text-right">
                {formatDuration(Math.floor(currentTime))}
              </span>

              <div className="flex-1">
                {/* Hide waveform on mobile */}
                <div className="hidden md:block">
                  <Waveform audioUrl={currentEpisode.audioUrl} />
                </div>
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={handleSeek}
                  className="md:mt-2"
                />
              </div>

              <span className="text-xs text-muted-foreground w-10 md:w-12">
                {formatDuration(Math.floor(duration))}
              </span>
            </div>
          </div>

          {/* Volume - Hidden on mobile */}
          <div className="hidden md:flex w-48 items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleMute}>
              {isMuted ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <Slider
              value={[isMuted ? 0 : volume]}
              max={1}
              step={0.1}
              onValueChange={(v) => setVolume(v[0])}
            />
          </div>
        </div>
      </div>
    </>
  );
}
