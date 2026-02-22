export interface Podcast {
  id: string;
  itunesId?: number;
  title: string;
  author: string;
  description: string;
  rssUrl?: string;
  artworkUrl?: string;
  genre?: string;
  createdAt?: string;
}

export interface Episode {
  id: string;
  guid?: string;  // RSS GUID for stable episode identification
  podcastId?: string;
  title: string;
  description?: string;
  audioUrl?: string;
  duration?: number;
  publishedAt?: string;
  createdAt?: string;
}

export interface EpisodeWithPodcast extends Episode {
  podcast?: Podcast;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptionSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordTimestamp[];
}

export interface Transcription {
  id: string;
  userId?: string;
  episodeId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  text?: string;
  segments?: TranscriptionSegment[];
  language?: string;
  errorMessage?: string;
  createdAt?: string;
  completedAt?: string;
  episode?: EpisodeWithPodcast;
  taskId?: string;  // FastAPI task ID for cancellation
}

export interface Favorite {
  id: string;
  userId?: string;
  podcastId?: string;
  createdAt?: string;
  podcast?: Podcast;
}

export interface PlaybackProgress {
  id: string;
  userId?: string;
  episodeId?: string;
  position: number;
  completed: boolean;
  updatedAt?: string;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  createdAt?: string;
}
