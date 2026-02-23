"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, RefreshCw, Loader2, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAIStore } from "@/store/ai-store";
import { AIChat } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface AIChatPanelProps {
  transcriptionId: string;
  transcriptionText: string;
  className?: string;
}

export function AIChatPanel({
  transcriptionId,
  transcriptionText,
  className,
}: AIChatPanelProps) {
  const {
    chats,
    isLoading,
    streamingContent,
    settings,
    loadChats,
    sendMessage,
    regenerateSummary,
    loadSettings,
    clearStreamingContent,
  } = useAIStore();

  const [inputMessage, setInputMessage] = useState("");
  const scrollViewportRef = useRef<HTMLDivElement>(null);

  // Load chats and settings on mount
  useEffect(() => {
    loadChats(transcriptionId);
    loadSettings();
  }, [transcriptionId]);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [chats, streamingContent]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const message = inputMessage.trim();
    setInputMessage("");

    try {
      await sendMessage(transcriptionId, message);
    } finally {
      clearStreamingContent();
    }
  };

  const handleRegenerateSummary = async () => {
    try {
      await regenerateSummary(transcriptionId, transcriptionText);
    } catch (error) {
      console.error("Regenerate summary failed:", error);
    } finally {
      clearStreamingContent();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Filter out system messages for display
  const displayChats = chats.filter((chat) => chat.role !== "system");

  // Check if settings are configured
  const isSettingsConfigured =
    settings?.llmProvider && (settings?.hasApiKey || settings?.llmApiKey) && settings?.llmModel;

  // Check if we have any chats or are currently generating
  const hasContent = displayChats.length > 0 || isLoading;

  return (
    <Card className={cn("overflow-hidden border-primary/20", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-display text-xl">AI 总结与对话</CardTitle>
              <CardDescription>
                {displayChats.length === 0
                  ? "基于转录内容生成 AI 总结"
                  : `${displayChats.length} 条对话`}
              </CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {displayChats.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegenerateSummary}
                  disabled={isLoading || !isSettingsConfigured}
                  className="rounded-full"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  重新生成
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="rounded-full"
                >
                  <Link href="/settings">
                    <Settings className="h-4 w-4 mr-2" />
                    设置
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isSettingsConfigured ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Settings className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                请先配置 AI 设置以使用总结和对话功能
              </p>
              <Button asChild className="rounded-full">
                <Link href="/settings">前往设置</Link>
              </Button>
            </div>
          </div>
        ) : !hasContent ? (
          // Empty state - no chats and not loading
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-2">
              <p className="text-muted-foreground">
                转录已完成，点击下方按钮生成 AI 总结
              </p>
              <Button
                onClick={handleRegenerateSummary}
                disabled={isLoading}
                className="rounded-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                生成总结
              </Button>
            </div>
          </div>
        ) : (
          // Chat display
          <>
            <div
              ref={scrollViewportRef}
              className="h-[400px] overflow-y-auto pr-4 space-y-4"
            >
              {displayChats.map((chat, index) => (
                <ChatMessage
                  key={chat.id || index}
                  chat={chat}
                  isFirst={index === 0}
                />
              ))}
              {/* Streaming message */}
              {isLoading && streamingContent === "" && (
                <ChatMessage
                  chat={{
                    id: "streaming",
                    transcriptionId,
                    role: "assistant",
                    content: "",
                    createdAt: new Date().toISOString(),
                  }}
                  isLoading
                />
              )}
              {streamingContent && (
                <ChatMessage
                  chat={{
                    id: "streaming",
                    transcriptionId,
                    role: "assistant",
                    content: streamingContent,
                    createdAt: new Date().toISOString(),
                  }}
                  isStreaming
                />
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Textarea
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="继续对话，询问关于内容的更多信息..."
                className="min-h-[60px] resize-none rounded-2xl"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="h-[60px] px-4 rounded-2xl shrink-0"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ChatMessage({
  chat,
  isFirst = false,
  isStreaming = false,
  isLoading = false,
}: {
  chat: AIChat;
  isFirst?: boolean;
  isStreaming?: boolean;
  isLoading?: boolean;
}) {
  const isUser = chat.role === "user";
  const [isExpanded, setIsExpanded] = useState(false);

  // Collapse long user messages
  const MAX_LENGTH = 300;
  const isLongMessage = chat.content.length > MAX_LENGTH;
  const shouldShowExpand = isUser && isLongMessage && !isStreaming && !isLoading;

  const displayContent = shouldShowExpand && !isExpanded
    ? chat.content.slice(0, MAX_LENGTH) + "..."
    : chat.content;

  // Detect summary prompt
  const isSummaryPrompt = isUser && isLongMessage;

  return (
    <div
      className={cn(
        "flex gap-3 mb-4",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-primary/10 text-primary"
        )}
      >
        {isUser ? (
          <span className="text-sm font-medium">我</span>
        ) : (
          <Bot className="h-4 w-4" />
        )}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        )}
      >
        {isFirst && !isUser && (
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-3 w-3" />
            <span className="text-xs font-medium opacity-70">AI 总结</span>
          </div>
        )}
        {isSummaryPrompt && (
          <div className="flex items-center gap-2 mb-2 opacity-70">
            <span className="text-xs font-medium">生成总结请求</span>
          </div>
        )}
        <div className="whitespace-pre-wrap text-sm leading-relaxed">
          {isLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-xs opacity-70">AI 思考中...</span>
            </div>
          ) : (
            <>
              {displayContent}
              {isStreaming && (
                <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />
              )}
            </>
          )}
        </div>
        {shouldShowExpand && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 mt-2 text-xs opacity-70 hover:opacity-100 transition-opacity"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3" />
                展开更多
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
