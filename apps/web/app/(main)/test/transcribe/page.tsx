"use client";

import { useState } from "react";
import { Loader2, Play, AlertCircle, CheckCircle, Clock, FileText, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl } from "@/lib/utils";
import { isTestMode } from "@/lib/test-mode";

interface TranscriptionResult {
  transcriptionId: string;
  taskId: string;
  episodeId: string;
  status: string;
  message: string;
}

export default function TestTranscribePage() {
  const [audioUrl, setAudioUrl] = useState("");
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [podcastName, setPodcastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(getApiUrl("api/test/transcribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          audioUrl: audioUrl.trim(),
          episodeTitle: episodeTitle.trim() || undefined,
          podcastName: podcastName.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start transcription");
      }

      setResult(data);
      toast({
        title: "Success",
        description: "Transcription started successfully",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start transcription";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const testMode = isTestMode();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Mic className="h-6 w-6" />
          Test Transcription
        </h1>
        <p className="text-muted-foreground">
          Test podcast transcription with a direct audio URL. No iTunes lookup required.
        </p>
      </div>

      {!testMode && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Test Mode Disabled</AlertTitle>
          <AlertDescription>
            Test mode is not enabled. Please set NEXT_PUBLIC_TEST_MODE=true in your environment.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Audio Source
          </CardTitle>
          <CardDescription>
            Enter the audio URL and optional metadata for the transcription test.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="audioUrl">
                Audio URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="audioUrl"
                type="url"
                placeholder="https://example.com/podcast.mp3"
                value={audioUrl}
                onChange={(e) => setAudioUrl(e.target.value)}
                required
                disabled={!testMode || loading}
              />
              <p className="text-xs text-muted-foreground">
                Direct link to an audio file (MP3, M4A, etc.)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="episodeTitle">Episode Title (Optional)</Label>
              <Input
                id="episodeTitle"
                placeholder="Test Episode"
                value={episodeTitle}
                onChange={(e) => setEpisodeTitle(e.target.value)}
                disabled={!testMode || loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="podcastName">Podcast Name (Optional)</Label>
              <Input
                id="podcastName"
                placeholder="Test Podcast"
                value={podcastName}
                onChange={(e) => setPodcastName(e.target.value)}
                disabled={!testMode || loading}
              />
            </div>

            <Button
              type="submit"
              disabled={!testMode || loading || !audioUrl.trim()}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Starting Transcription...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Start Transcription
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {result && (
        <Card className="border-green-200 bg-green-50/50 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Transcription Started
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium min-w-[120px]">Transcription ID:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">{result.transcriptionId}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium min-w-[120px]">Task ID:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">{result.taskId}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium min-w-[120px]">Episode ID:</span>
                <code className="bg-muted px-2 py-1 rounded text-xs">{result.episodeId}</code>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium min-w-[120px]">Status:</span>
                <span className="flex items-center gap-1 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  {result.status}
                </span>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Next Steps</AlertTitle>
              <AlertDescription className="space-y-2">
                <p>
                  The transcription is being processed. You can check the status in the{" "}
                  <a href={getApiUrl("transcriptions")} className="underline font-medium">
                    Transcriptions page
                  </a>
                  .
                </p>
                <p className="text-xs text-muted-foreground">
                  Or use the CLI tool:{' '}
                  <code className="bg-muted px-1 rounded">
                    python scripts/test-transcribe.py --check --transcription-id &quot;{result.transcriptionId}&quot;
                  </code>
                </p>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Example Audio URLs for Testing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Here are some example audio URLs you can use for testing:
          </p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>Any direct MP3 or M4A URL</li>
            <li>Public podcast episode URLs</li>
            <li>Test audio files hosted on your server</li>
          </ul>
          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200">
              <strong>Note:</strong> The audio URL must be publicly accessible and support direct
              download. Some podcast hosts may block requests or require authentication.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
