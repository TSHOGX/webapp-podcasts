"use client";

import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { usePlayerStore } from "@/store/player-store";

interface WaveformProps {
  audioUrl?: string;
}

export function Waveform({ audioUrl }: WaveformProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const { isPlaying, setWaveformData } = usePlayerStore();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current || !audioUrl) return;

    // Clean up previous instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: "#4b5563",
      progressColor: "#10b981",
      cursorColor: "#10b981",
      barWidth: 2,
      barGap: 1,
      height: 40,
      normalize: true,
      interact: true,
    });

    wavesurfer.on("ready", () => {
      setIsReady(true);
      const data = wavesurfer.getDecodedData();
      if (data) {
        // Extract waveform data for visualization
        const channelData = data.getChannelData(0);
        const samples = 100;
        const blockSize = Math.floor(channelData.length / samples);
        const waveformData: number[] = [];

        for (let i = 0; i < samples; i++) {
          let sum = 0;
          for (let j = 0; j < blockSize; j++) {
            sum += Math.abs(channelData[i * blockSize + j]);
          }
          waveformData.push(sum / blockSize);
        }

        setWaveformData(waveformData);
      }
    });

    wavesurfer.load(audioUrl);
    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioUrl, setWaveformData]);

  useEffect(() => {
    if (wavesurferRef.current && isReady) {
      if (isPlaying) {
        wavesurferRef.current.play();
      } else {
        wavesurferRef.current.pause();
      }
    }
  }, [isPlaying, isReady]);

  if (!audioUrl) {
    return <div className="h-10 bg-muted rounded" />;
  }

  return <div ref={containerRef} className="w-full" />;
}
