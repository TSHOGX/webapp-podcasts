"use client";

import { useEffect, useState } from "react";
import { Loader2, FileText, Search, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProtectedContent } from "@/components/auth/protected-content";
import { Transcription } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500";
      case "processing":
        return "text-blue-500";
      case "failed":
        return "text-red-500";
      default:
        return "text-yellow-500";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Transcriptions</h1>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transcriptions..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {filteredTranscriptions.length === 0 ? (
        <div className="text-center text-muted-foreground py-20">
          {searchQuery ? "No transcriptions found" : "No transcriptions yet"}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTranscriptions.map((transcription) => (
            <Card key={transcription.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
                    <div>
                      <CardTitle className="text-base">
                        {transcription.episode?.title || "Unknown Episode"}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {transcription.episode?.podcast?.title || "Unknown Podcast"}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(transcription.status)} shrink-0`}>
                    {transcription.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {transcription.status === "completed" && transcription.text && (
                  <>
                    <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                      {transcription.text}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport(transcription, "txt")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export TXT
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport(transcription, "md")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Export MD
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(transcription.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </>
                )}
                {transcription.status === "processing" && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Transcribing...
                  </div>
                )}
                {transcription.status === "failed" && (
                  <div className="text-sm text-red-500">
                    {transcription.errorMessage || "Transcription failed"}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
