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

      <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl p-5 md:p-6 z-50">
        <div className="max-w-6xl mx-auto flex items-center gap-5 md:gap-8">
          {/* Episode Info */}
          <div className="shrink-0 flex items-center gap-4">
            <div className="w-14 h-14 md:w-[72px] md:h-[72px] relative bg-muted rounded-2xl overflow-hidden shadow-soft">
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
            <div className="hidden md:block min-w-0 max-w-[220px]">
              <p className="font-medium text-sm truncate">{currentEpisode.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentEpisode.podcastTitle}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex-1 flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full hover:bg-accent"
                onClick={() => skipBackward(10)}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="default"
                size="icon"
                className="h-14 w-14 rounded-full shadow-soft"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="h-6 w-6" />
                ) : (
                  <Play className="h-6 w-6 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full hover:bg-accent"
                onClick={() => skipForward(30)}
              >
                <SkipForward className="h-4 w-4" />
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

          {/* Volume */}
          <div className="hidden md:flex w-44 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-accent"
              onClick={toggleMute}
            >
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

      {/* Mobile spacing for bottom nav */}
      <div className="md:hidden h-24" />
    </>
  );
}
