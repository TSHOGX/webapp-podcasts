import { create } from "zustand";
import { AIChat, AIUserSettings } from "@/types";
import { getApiUrl } from "@/lib/utils";

interface AIState {
  // 对话列表（某个转录的所有对话）
  chats: AIChat[];
  isLoading: boolean;
  streamingContent: string;
  // Track loadChats request version to prevent race conditions
  chatsLoadVersion: number;

  // 用户设置
  settings: AIUserSettings | null;
  isSettingsLoading: boolean;

  // Actions
  loadChats: (transcriptionId: string) => Promise<void>;
  sendMessage: (
    transcriptionId: string,
    message: string,
    onStreamingUpdate?: (content: string) => void
  ) => Promise<void>;
  regenerateSummary: (
    transcriptionId: string,
    transcriptionText: string,
    onStreamingUpdate?: (content: string) => void
  ) => Promise<void>;
  loadSettings: () => Promise<void>;
  saveSettings: (settings: AIUserSettings) => Promise<boolean>;
  clearStreamingContent: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  chats: [],
  isLoading: false,
  streamingContent: "",
  chatsLoadVersion: 0,
  settings: null,
  isSettingsLoading: false,

  loadChats: async (transcriptionId: string) => {
    const version = get().chatsLoadVersion + 1;
    set({ isLoading: true, chatsLoadVersion: version });
    try {
      const response = await fetch(
        getApiUrl(`api/ai/chats/${transcriptionId}`)
      );
      if (response.ok) {
        const data = await response.json();
        // Convert snake_case to camelCase
        const chats: AIChat[] = (data.chats || []).map((chat: Record<string, unknown>) => ({
          id: chat.id as string,
          transcriptionId: chat.transcription_id as string,
          role: chat.role as 'system' | 'user' | 'assistant',
          content: chat.content as string,
          model: chat.model as string | undefined,
          metadata: chat.metadata as Record<string, unknown> | undefined,
          createdAt: chat.created_at as string,
        }));
        // Only update if this is still the latest request
        if (get().chatsLoadVersion === version) {
          set({ chats });
        }
      }
    } catch (error) {
      console.error("Failed to load chats:", error);
    } finally {
      // Only clear loading if this is still the latest request
      if (get().chatsLoadVersion === version) {
        set({ isLoading: false });
      }
    }
  },

  sendMessage: async (
    transcriptionId: string,
    message: string,
    onStreamingUpdate?: (content: string) => void
  ) => {
    const { chats } = get();
    set({ isLoading: true, streamingContent: "" });

    try {
      // Build conversation history (exclude system messages)
      const conversationHistory = chats
        .filter((chat) => chat.role !== "system")
        .map((chat) => ({
          role: chat.role,
          content: chat.content,
        }));

      const response = await fetch(getApiUrl("api/ai/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcription_id: transcriptionId,
          message,
          conversation_history: conversationHistory,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to send message");
      }

      // Handle SSE streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  set({ streamingContent: fullContent });
                  onStreamingUpdate?.(fullContent);
                }
                if (data.done) {
                  // Reload chats to get the stored messages
                  await get().loadChats(transcriptionId);
                  set({ streamingContent: "" });
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  regenerateSummary: async (
    transcriptionId: string,
    transcriptionText: string,
    onStreamingUpdate?: (content: string) => void
  ) => {
    const { settings, chats } = get();

    // Use a default template if settings not loaded
    const defaultTemplate = "请根据以下播客转录文本，生成一份结构化的内容总结：\n\n{{transcription}}\n\n请包含以下部分：\n1. 核心观点概述\n2. 关键话题与讨论要点\n3. 重要引用或案例\n4. 结论与启发";
    const userPromptTemplate = settings?.userPromptTemplate || defaultTemplate;
    const userPrompt = userPromptTemplate.replace("{{transcription}}", transcriptionText);

    // Add optimistic user message
    const tempUserMessage: AIChat = {
      id: `temp-user-${Date.now()}`,
      transcriptionId,
      role: "user",
      content: userPrompt,
      createdAt: new Date().toISOString(),
    };

    // Increment version to prevent pending loadChats from overwriting our optimistic update
    const version = get().chatsLoadVersion + 1;
    // Use functional update to ensure we have latest state
    set((state) => ({
      chats: [...state.chats, tempUserMessage],
      isLoading: true,
      streamingContent: "",
      chatsLoadVersion: version,
    }));

    try {
      const response = await fetch(getApiUrl("api/ai/regenerate-summary"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcription_id: transcriptionId,
          transcription_text: transcriptionText,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.detail || errorData.error || `Failed to regenerate summary: ${response.status}`);
      }

      // Handle SSE streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  set({ streamingContent: fullContent });
                  onStreamingUpdate?.(fullContent);
                }
                if (data.done) {
                  // Reload chats to get the stored summary (includes both user and assistant messages)
                  await get().loadChats(transcriptionId);
                  // Clear streaming content after chats are loaded for smooth transition
                  set({ streamingContent: "" });
                }
              } catch (e) {
                // Ignore parse errors
                console.debug("SSE parse error:", e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to regenerate summary:", error);
      // Remove the optimistic user message on error
      set((state) => ({
        chats: state.chats.filter(chat => chat.id !== tempUserMessage.id),
      }));
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  loadSettings: async () => {
    set({ isSettingsLoading: true });
    try {
      const response = await fetch(getApiUrl("api/ai/settings"));
      if (response.ok) {
        const data = await response.json();
        // Convert snake_case to camelCase
        const settings: AIUserSettings = {
          llmProvider: data.llm_provider,
          llmApiKey: data.llm_api_key || "",
          llmBaseUrl: data.llm_base_url,
          llmModel: data.llm_model,
          systemPrompt: data.system_prompt,
          userPromptTemplate: data.user_prompt_template,
          temperature: data.temperature,
          enableAutoSummary: data.enable_auto_summary,
          hasApiKey: data.has_api_key,
        };
        set({ settings });
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      set({ isSettingsLoading: false });
    }
  },

  saveSettings: async (settings: AIUserSettings): Promise<boolean> => {
    try {
      const response = await fetch(getApiUrl("api/ai/settings"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          llm_provider: settings.llmProvider,
          llm_api_key: settings.llmApiKey,
          llm_model: settings.llmModel,
          llm_base_url: settings.llmBaseUrl,
          system_prompt: settings.systemPrompt,
          user_prompt_template: settings.userPromptTemplate,
          temperature: settings.temperature,
          enable_auto_summary: settings.enableAutoSummary,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Save settings error:", response.status, errorData);
        return false;
      }

      // Update local state immediately for better UX
      set({ settings });
      return true;
    } catch (error) {
      console.error("Failed to save settings:", error);
      return false;
    }
  },

  clearStreamingContent: () => set({ streamingContent: "" }),
}));
