"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams, useParams } from "next/navigation";
import { Loader2, Play, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayerStore } from "@/store/player-store";
import { useToast } from "@/hooks/use-toast";
import { Episode } from "@/types";
import { getApiUrl } from "@/lib/utils";

interface EpisodeDetail extends Episode {
  podcastTitle: string;
  podcastImage: string;
  podcastId: string;
}

export default function EpisodeDetailPage() {
  const [episode, setEpisode] = useState<EpisodeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptionStatus, setTranscriptionStatus] = useState<string | null>(null);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const params = useParams();
  const id = params.id as string;
  const podcastId = searchParams.get("podcastId");
  const setCurrentEpisode = usePlayerStore((state) => state.setCurrentEpisode);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchEpisode() {
      if (!podcastId) {
        setError("Podcast ID is required");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(getApiUrl(`api/podcasts/${podcastId}/episodes/${id}`));
        if (!response.ok) {
          throw new Error("Failed to fetch episode");
        }
        const data = await response.json();
        setEpisode(data);

        // Check if transcription exists
        if (data.audioUrl) {
          checkExistingTranscription(data.audioUrl);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load episode");
      } finally {
        setLoading(false);
      }
    }

    fetchEpisode();
  }, [id, podcastId]);

  const checkExistingTranscription = async (audioUrl: string) => {
    try {
      const response = await fetch(getApiUrl("api/transcriptions/check"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audioUrl }),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.transcription) {
          setTranscriptionStatus(data.transcription.status);
          setTranscriptionText(data.transcription.text);
        }
      }
    } catch {
      // No existing transcription
    }
  };

  const handlePlay = () => {
    if (episode) {
      setCurrentEpisode({
        ...episode,
        podcastTitle: episode.podcastTitle,
        podcastImage: episode.podcastImage,
      });
    }
  };

  const handleTranscribe = async () => {
    if (!episode?.audioUrl) return;

    setTranscribing(true);
    try {
      const response = await fetch(getApiUrl("api/transcribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          episodeId: id,
          audioUrl: episode.audioUrl,
          episodeTitle: episode.title,
          podcastId: episode.podcastId || null,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage = typeof data.error === "string" ? data.error : "Failed to start transcription";
        const hintMessage = typeof data.hint === "string" ? data.hint : "";
        throw new Error(hintMessage ? `${errorMessage} ${hintMessage}` : errorMessage);
      }

      setTranscriptionStatus(data.status);

      // If transcription already exists and is completed, show the text
      if (data.status === "completed" && data.transcription?.text) {
        setTranscriptionText(data.transcription.text);
        toast({
          title: "Transcription exists",
          description: "This episode has already been transcribed.",
        });
      } else {
        toast({
          title: "Success",
          description: data.message || "Transcription started. You can check progress in the Transcriptions page.",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to start transcription",
        variant: "destructive",
      });
    } finally {
      setTranscribing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-destructive py-20">
        {error}
      </div>
    );
  }

  if (!episode) {
    return (
      <div className="text-center text-destructive py-20">
        Episode not found
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Episode Header */}
      <div className="flex gap-6">
        <div className="w-32 h-32 shrink-0 relative bg-muted rounded-lg overflow-hidden">
          {episode.podcastImage ? (
            <Image
              src={episode.podcastImage}
              alt={episode.podcastTitle || ""}
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h1 className="text-2xl font-bold mb-2">{episode.title}</h1>
            <p className="text-muted-foreground">{episode.podcastTitle}</p>
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePlay}>
              <Play className="h-4 w-4 mr-2" />
              Play Episode
            </Button>

            {transcriptionStatus === "completed" ? (
              <Button variant="outline" disabled>
                <FileText className="h-4 w-4 mr-2" />
                Transcribed
              </Button>
            ) : transcriptionStatus === "processing" ? (
              <Button variant="outline" disabled>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transcribing...
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={handleTranscribe}
                disabled={transcribing}
              >
                {transcribing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                Transcribe
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Transcription Result */}
      {transcriptionStatus === "completed" && transcriptionText && (
        <Card>
          <CardHeader>
            <CardTitle>Transcription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none">
              <p className="whitespace-pre-wrap">{transcriptionText}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Episode Description */}
      {episode.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose max-w-none text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: episode.description }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
