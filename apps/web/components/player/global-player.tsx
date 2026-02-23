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
  X,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlayerStore } from "@/store/player-store";
import { formatDuration } from "@/lib/utils";
import { Waveform } from "./waveform";

const playbackRates = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];

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
    isMinimized,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    setPlaybackRate,
    skipForward,
    skipBackward,
    toggleMinimized,
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

  // Listen for custom seek events from transcription viewer
  useEffect(() => {
    const handleCustomSeek = (event: CustomEvent<{ time: number }>) => {
      const newTime = event.detail.time;
      if (audioRef.current) {
        audioRef.current.currentTime = newTime;
        setCurrentTime(newTime);
        // Also start playing if not already playing
        if (!isPlaying) {
          setIsPlaying(true);
        }
      }
    };

    window.addEventListener("podcast:seek", handleCustomSeek as EventListener);
    return () => {
      window.removeEventListener("podcast:seek", handleCustomSeek as EventListener);
    };
  }, [isPlaying, setCurrentTime, setIsPlaying]);

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

  const handlePlaybackRateChange = (value: string) => {
    const rate = parseFloat(value);
    setPlaybackRate(rate);
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  if (!currentEpisode) {
    return null;
  }

  // Minimized floating player
  if (isMinimized) {
    return (
      <>
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
        <button
          onClick={toggleMinimized}
          className="fixed bottom-24 right-4 md:bottom-6 w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden shadow-xl z-50 bg-card border border-border hover:scale-105 transition-transform"
        >
          {currentEpisode.podcastImage ? (
            <Image
              src={currentEpisode.podcastImage}
              alt={currentEpisode.podcastTitle || ""}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Play className="h-5 w-5 text-muted-foreground" />
            </div>
          )}
          {/* Play/Pause overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            {isPlaying ? (
              <Pause className="h-6 w-6 text-white" />
            ) : (
              <Play className="h-6 w-6 text-white ml-0.5" />
            )}
          </div>
        </button>
      </>
    );
  }

  return (
    <>
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      <div className="fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-xl p-3 md:p-6 z-50">
        {/* Desktop layout - single row */}
        <div className="hidden md:flex max-w-6xl mx-auto items-center gap-8">
          {/* Episode Info */}
          <div className="shrink-0 flex items-center gap-4">
            <div className="w-[72px] h-[72px] relative bg-muted rounded-2xl overflow-hidden shadow-soft">
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
            <div className="min-w-0 max-w-[220px]">
              <p className="font-medium text-sm truncate">{currentEpisode.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {currentEpisode.podcastTitle}
              </p>
            </div>
          </div>

          {/* Desktop Controls */}
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

            <div className="w-full flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-12 text-right">
                {formatDuration(Math.floor(currentTime))}
              </span>

              <div className="flex-1">
                <Waveform audioUrl={currentEpisode.audioUrl} />
                <Slider
                  value={[currentTime]}
                  max={duration || 100}
                  step={1}
                  onValueChange={handleSeek}
                  className="mt-2"
                />
              </div>

              <span className="text-xs text-muted-foreground w-12">
                {formatDuration(Math.floor(duration))}
              </span>
            </div>
          </div>

          {/* Desktop Playback Rate + Volume + Close */}
          <div className="flex items-center gap-4">
            <Select
              value={playbackRate.toString()}
              onValueChange={handlePlaybackRateChange}
            >
              <SelectTrigger className="w-20 h-9 text-xs">
                <SelectValue placeholder="1x" />
              </SelectTrigger>
              <SelectContent>
                {playbackRates.map((rate) => (
                  <SelectItem key={rate} value={rate.toString()}>
                    {rate}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex w-36 items-center gap-2">
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

            <button
              onClick={toggleMinimized}
              className="p-2 rounded-full hover:bg-accent/50 transition-colors"
              aria-label="Minimize player"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Mobile layout - two rows */}
        <div className="md:hidden max-w-6xl mx-auto">
          {/* Row 1: Cover, Controls, Close */}
          <div className="flex items-center justify-between px-1">
            {/* Album Cover */}
            <div className="w-11 h-11 relative bg-muted rounded-xl overflow-hidden shadow-soft shrink-0">
              {currentEpisode.podcastImage ? (
                <Image
                  src={currentEpisode.podcastImage}
                  alt={currentEpisode.podcastTitle || ""}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                  No Image
                </div>
              )}
            </div>

            {/* Center Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-accent"
                onClick={() => skipBackward(10)}
              >
                <SkipBack className="h-4 w-4" />
              </Button>

              <Button
                variant="default"
                size="icon"
                className="h-12 w-12 rounded-full shadow-soft"
                onClick={() => setIsPlaying(!isPlaying)}
              >
                {isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-accent"
                onClick={() => skipForward(30)}
              >
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            {/* Close Button */}
            <button
              onClick={toggleMinimized}
              className="p-2 rounded-full hover:bg-accent/50 transition-colors shrink-0"
              aria-label="Minimize player"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Row 2: Progress Bar with Time and Rate */}
          <div className="mt-2 flex items-center gap-2 px-1">
            <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">
              {formatDuration(Math.floor(currentTime))}
            </span>

            <div className="flex-1">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={1}
                onValueChange={handleSeek}
              />
            </div>

            <span className="text-[10px] text-muted-foreground w-8 shrink-0">
              {formatDuration(Math.floor(duration))}
            </span>

            {/* Playback Rate */}
            <Select
              value={playbackRate.toString()}
              onValueChange={handlePlaybackRateChange}
            >
              <SelectTrigger className="w-12 h-6 text-[10px] px-1.5 rounded-full border-primary/20 shrink-0">
                <SelectValue placeholder="1x" />
              </SelectTrigger>
              <SelectContent>
                {playbackRates.map((rate) => (
                  <SelectItem key={rate} value={rate.toString()}>
                    {rate}x
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Mobile spacing for bottom nav */}
      <div className="md:hidden h-20" />
    </>
  );
}
