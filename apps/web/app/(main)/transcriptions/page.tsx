"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, FileText, Search, Download, Trash2, Copy, CheckCircle2, Clock, AlertCircle, ExternalLink, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedContent } from "@/components/auth/protected-content";
import { Transcription } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";

function TranscriptionsContent() {
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [filteredTranscriptions, setFilteredTranscriptions] = useState<Transcription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchTranscriptions();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = transcriptions.filter(
        (t) =>
          t.text?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.episode?.title?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTranscriptions(filtered);
    } else {
      setFilteredTranscriptions(transcriptions);
    }
  }, [searchQuery, transcriptions]);

  const fetchTranscriptions = async () => {
    try {
      const response = await fetch(getApiUrl("api/transcriptions"));
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch transcriptions");
      }

      setTranscriptions(data.transcriptions);
      setFilteredTranscriptions(data.transcriptions);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to fetch transcriptions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`api/transcriptions/${id}`), {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete transcription");
      }

      setTranscriptions(transcriptions.filter((t) => t.id !== id));
      toast({
        title: "Success",
        description: "Transcription deleted successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete",
        variant: "destructive",
      });
    }
  };

  const handleExport = (transcription: Transcription, format: "txt" | "md") => {
    const text = transcription.text || "";
    const episodeTitle = transcription.episode?.title || "Untitled";

    let content = "";
    if (format === "md") {
      content = `# ${episodeTitle}\n\n${text}`;
    } else {
      content = `${episodeTitle}\n\n${text}`;
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${episodeTitle}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (transcription: Transcription) => {
    const text = transcription.text || "";
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "已复制",
        description: "转录内容已复制到剪贴板",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(getApiUrl(`api/transcriptions/${id}/cancel`), {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel transcription");
      }

      // Update local state to show cancelled status
      setTranscriptions(transcriptions.map((t) =>
        t.id === id ? { ...t, status: "cancelled" } : t
      ));

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/80 bg-primary/10 px-2.5 py-1 rounded-full">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            Processing
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-destructive/80 bg-destructive/10 px-2.5 py-1 rounded-full">
            <AlertCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-orange-600 bg-orange-100 px-2.5 py-1 rounded-full">
            <XCircle className="h-3 w-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="font-display text-2xl md:text-3xl font-bold">Transcriptions</h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcriptions..."
            className="pl-12"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredTranscriptions.length === 0 ? (
        <div className="text-center text-muted-foreground py-20 bg-muted/30 rounded-3xl">
          {searchQuery ? "No transcriptions found" : "No transcriptions yet"}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTranscriptions.map((transcription) => {
            const cardContent = (
              <Card
                key={transcription.id}
                className={cn(
                  "overflow-hidden group",
                  transcription.episode?.id && "hover:border-primary/50 transition-colors"
                )}
              >
                <CardHeader className="pb-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base leading-snug mb-1 flex items-center gap-2">
                          {transcription.episode?.title || "Unknown Episode"}
                          {transcription.episode?.id && (
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {transcription.episode?.podcast?.title || "Unknown Podcast"}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(transcription.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {transcription.status === "completed" && transcription.text && (
                    <>
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                        {transcription.text}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCopy(transcription);
                          }}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleExport(transcription, "md");
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(transcription.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </>
                  )}
                  {(transcription.status === "processing" || transcription.status === "pending") && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        {transcription.status === "processing" ? "Transcribing..." : "Waiting in queue..."}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full hover:bg-orange-100 hover:text-orange-600 hover:border-orange-200"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleCancel(transcription.id);
                          }}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(transcription.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                  {transcription.status === "failed" && (
                    <div className="flex flex-col gap-3">
                      <div className="text-sm text-destructive">
                        {transcription.errorMessage || "Transcription failed"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(transcription.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                  {transcription.status === "cancelled" && (
                    <div className="flex flex-col gap-3">
                      <div className="text-sm text-orange-600">
                        {transcription.errorMessage || "Transcription was cancelled"}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDelete(transcription.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );

            if (transcription.episode?.id) {
              // Use guid (RSS GUID) as episode id if available, otherwise fall back to database id
              const effectiveEpisodeId = transcription.episode.guid || transcription.episode.id;
              // Use itunes_id as podcast id if available, otherwise fall back to database id
              const effectivePodcastId = transcription.episode.podcast?.itunesId
                ? String(transcription.episode.podcast.itunesId)
                : transcription.episode.podcast?.id || "";
              return (
                <Link
                  key={transcription.id}
                  href={`/episodes/${encodeURIComponent(effectiveEpisodeId)}?podcastId=${encodeURIComponent(effectivePodcastId)}`}
                  className="block"
                >
                  {cardContent}
                </Link>
              );
            }

            return cardContent;
          })}
        </div>
      )}
    </div>
  );
}

export default function TranscriptionsPage() {
  return (
    <ProtectedContent
      title="需要登录"
      description="登录后可以将播客剧集转录为文字，并查看、导出您的转录历史。"
    >
      <TranscriptionsContent />
    </ProtectedContent>
  );
}
