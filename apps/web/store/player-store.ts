import { create } from "zustand";
import { Episode } from "@/types";

interface ExtendedEpisode extends Episode {
  podcastTitle?: string;
  podcastImage?: string;
}

interface PlayerState {
  currentEpisode: ExtendedEpisode | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  volume: number;
  waveformData: number[];

  // Actions
  setCurrentEpisode: (episode: ExtendedEpisode | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setPlaybackRate: (rate: number) => void;
  setVolume: (volume: number) => void;
  setWaveformData: (data: number[]) => void;
  seek: (time: number) => void;
  skipForward: (seconds?: number) => void;
  skipBackward: (seconds?: number) => void;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentEpisode: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  playbackRate: 1,
  volume: 1,
  waveformData: [],

  setCurrentEpisode: (episode) =>
    set({
      currentEpisode: episode,
      isPlaying: !!episode,
      currentTime: 0,
    }),

  setIsPlaying: (isPlaying) => set({ isPlaying }),

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  setPlaybackRate: (rate) => set({ playbackRate: rate }),

  setVolume: (volume) => set({ volume }),

  setWaveformData: (data) => set({ waveformData: data }),

  seek: (time) => set({ currentTime: time }),

  skipForward: (seconds = 30) =>
    set((state) => ({
      currentTime: Math.min(state.currentTime + seconds, state.duration),
    })),

  skipBackward: (seconds = 10) =>
    set((state) => ({
      currentTime: Math.max(state.currentTime - seconds, 0),
    })),
}));
