"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useParams } from "next/navigation";
import { Loader2, Play, FileText, Copy, Download, ChevronUp, CheckCircle2, FileTextIcon, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlayerStore } from "@/store/player-store";
import { useToast } from "@/hooks/use-toast";
import { Episode, TranscriptionSegment } from "@/types";
import { getApiUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  TranscriptionViewer,
  formatAsSRT,
  formatAsVTT,
  formatAsMarkdown,
} from "@/components/transcription/transcription-viewer";
import { AIChatPanel } from "@/components/ai/ai-chat-panel";

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
  const [transcriptionId, setTranscriptionId] = useState<string | null>(null);
  const [transcriptionText, setTranscriptionText] = useState<string | null>(null);
  const [transcriptionSegments, setTranscriptionSegments] = useState<TranscriptionSegment[] | null>(null);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<string | null>(null);
  const [showTranscription, setShowTranscription] = useState(false);
  const [copied, setCopied] = useState(false);
  const searchParams = useSearchParams();
  const params = useParams();
  const id = params.id as string;
  const podcastId = searchParams.get("podcastId");
  const setCurrentEpisode = usePlayerStore((state) => state.setCurrentEpisode);
  const currentTime = usePlayerStore((state) => state.currentTime);
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
          setTranscriptionId(data.transcription.id);
          setTranscriptionStatus(data.transcription.status);
          setTranscriptionText(data.transcription.text);
          setTranscriptionSegments(data.transcription.segments || null);
          setTranscriptionLanguage(data.transcription.language || null);
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

  const handleSeek = (time: number) => {
    // The player store handles seeking through the audio element
    // We need to dispatch a custom event that the player can listen to
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('podcast:seek', { detail: { time } }));
    }
  };

  const handleCopy = async () => {
    if (!transcriptionText) return;
    try {
      await navigator.clipboard.writeText(transcriptionText);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Transcription copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleExport = (format: "txt" | "md" | "srt" | "vtt" | "json") => {
    if (!episode) return;

    let content = "";
    let mimeType = "text/plain";
    let fileExtension = format;

    switch (format) {
      case "srt":
        if (!transcriptionSegments) {
          toast({
            title: "Error",
            description: "No timestamp data available for SRT export",
            variant: "destructive",
          });
          return;
        }
        content = formatAsSRT(transcriptionSegments);
        mimeType = "application/x-subrip";
        break;
      case "vtt":
        if (!transcriptionSegments) {
          toast({
            title: "Error",
            description: "No timestamp data available for VTT export",
            variant: "destructive",
          });
          return;
        }
        content = formatAsVTT(transcriptionSegments);
        mimeType = "text/vtt";
        break;
      case "json":
        content = JSON.stringify(
          {
            title: episode.title,
            text: transcriptionText,
            segments: transcriptionSegments,
            language: transcriptionLanguage,
          },
          null,
          2
        );
        mimeType = "application/json";
        break;
      case "md":
        if (transcriptionSegments) {
          content = formatAsMarkdown(transcriptionSegments, episode.title);
        } else {
          content = `# ${episode.title}\n\n${transcriptionText || ""}`;
        }
        break;
      case "txt":
      default:
        content = `${episode.title}\n\n${transcriptionText || ""}`;
        break;
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${episode.title}.${fileExtension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const getReadingTime = (wordCount: number) => {
    const minutes = Math.ceil(wordCount / 200);
    return minutes;
  };

  const handleCancelTranscription = async () => {
    if (!transcriptionStatus || !["pending", "processing"].includes(transcriptionStatus)) return;

    try {
      // First we need to get the transcription id
      const checkResponse = await fetch(getApiUrl("api/transcriptions/check"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ audioUrl: episode?.audioUrl }),
      });

      if (!checkResponse.ok) {
        throw new Error("Failed to find transcription");
      }

      const data = await checkResponse.json();
      if (!data.transcription?.id) {
        throw new Error("Transcription not found");
      }

      const response = await fetch(getApiUrl(`api/transcriptions/${data.transcription.id}/cancel`), {
        method: "POST",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to cancel transcription");
      }

      setTranscriptionStatus("cancelled");
      toast({
        title: "Success",
        description: "Transcription cancelled successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to cancel transcription",
        variant: "destructive",
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
        setTranscriptionId(data.transcription.id);
        setTranscriptionText(data.transcription.text);
        setTranscriptionSegments(data.transcription.segments || null);
        setTranscriptionLanguage(data.transcription.language || null);
        toast({
          title: "Transcription exists",
          description: "This episode has already been transcribed.",
        });
      } else {
        if (data.transcriptionId) {
          setTranscriptionId(data.transcriptionId);
        }
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
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    <div className="space-y-8">
      {/* Episode Header */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-32 h-32 sm:w-40 sm:h-40 shrink-0 relative bg-muted rounded-3xl overflow-hidden shadow-soft">
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

        <div className="flex-1 space-y-5">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold mb-2 leading-tight">{episode.title}</h1>
            <p className="text-muted-foreground text-base">{episode.podcastTitle}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePlay} className="rounded-full h-12 px-6">
              <Play className="h-4 w-4 mr-2" />
              Play Episode
            </Button>

            {transcriptionStatus === "completed" ? (
              <Button
                variant="outline"
                onClick={() => setShowTranscription(!showTranscription)}
                className="rounded-full h-12 px-6"
              >
                {showTranscription ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" />
                    Hide Transcription
                  </>
                ) : (
                  <>
                    <FileTextIcon className="h-4 w-4 mr-2" />
                    View Transcription
                  </>
                )}
              </Button>
            ) : transcriptionStatus === "processing" || transcriptionStatus === "pending" ? (
              <div className="flex flex-wrap gap-3">
                <Link href="/transcriptions">
                  <Button variant="outline" className="rounded-full h-12 px-6">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={handleCancelTranscription}
                  className="rounded-full h-12 px-6 hover:bg-orange-100 hover:text-orange-600 hover:border-orange-200"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            ) : transcriptionStatus === "cancelled" ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  onClick={handleTranscribe}
                  disabled={transcribing}
                  className="rounded-full h-12 px-6"
                >
                  {transcribing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  Transcribe Again
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleTranscribe}
                disabled={transcribing}
                className="rounded-full h-12 px-6"
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
        <div className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          showTranscription ? "opacity-100 max-h-[800px]" : "opacity-0 max-h-0"
        )}>
          <Card className="overflow-hidden border-primary/20">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="font-display text-xl">Transcription</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getWordCount(transcriptionText).toLocaleString()} words ·
                      {getReadingTime(getWordCount(transcriptionText))} min read
                      {currentTime > 0 && ` · ${Math.floor(currentTime / 60)}:${(Math.floor(currentTime) % 60).toString().padStart(2, '0')}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    className="rounded-full"
                  >
                    {copied ? (
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4 mr-2" />
                    )}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("txt")}
                    className="rounded-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    TXT
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport("srt")}
                    disabled={!transcriptionSegments}
                    title={transcriptionSegments ? "Export as SRT subtitles" : "No timestamp data available"}
                    className="rounded-full"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    SRT
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTranscription(false)}
                    className="rounded-full"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {transcriptionSegments ? (
                <TranscriptionViewer
                  segments={transcriptionSegments}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              ) : (
                <div className="max-h-[500px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap leading-relaxed text-muted-foreground">
                      {transcriptionText}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Summary & Chat Panel - only shown when transcription is completed */}
      {transcriptionStatus === "completed" && transcriptionText && transcriptionId && (
        <AIChatPanel
          transcriptionId={transcriptionId}
          transcriptionText={transcriptionText}
        />
      )}

      {/* Episode Description */}
      {episode.description && (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="font-display text-xl">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="prose max-w-none text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: episode.description }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
