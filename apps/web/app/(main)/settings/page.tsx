"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Palette, Bot, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeSelector } from "@/components/theme-selector";
import { createClient } from "@/lib/supabase/client";
import { getApiUrl } from "@/lib/utils";
import { useAIStore } from "@/store/ai-store";
import { AIUserSettings } from "@/types";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_SETTINGS: AIUserSettings = {
  llmProvider: "kimi",
  llmApiKey: "",
  llmBaseUrl: "",
  llmModel: "kimi-latest",
  systemPrompt: "你是一个专业的播客内容分析师，擅长从转录文本中提取关键信息并生成结构化的内容总结。",
  userPromptTemplate: "请根据以下播客转录文本，生成一份结构化的内容总结：\n\n{{transcription}}\n\n请包含以下部分：\n1. 核心观点概述\n2. 关键话题与讨论要点\n3. 重要引用或案例\n4. 结论与启发",
  temperature: 0.7,
  enableAutoSummary: true,
};

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const { settings, isSettingsLoading, loadSettings, saveSettings } = useAIStore();

  const [formData, setFormData] = useState<AIUserSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      await fetch(getApiUrl("api/auth/logout"), { method: "POST" });
    }
    router.push("/login");
  };

  const handleSaveAISettings = async () => {
    // Validate required fields
    if (!formData.llmProvider || !formData.llmModel) {
      toast({
        title: "验证失败",
        description: "请填写所有必填字段（Provider 和 Model）",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const success = await saveSettings(formData);
    setIsSaving(false);

    if (success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      toast({
        title: "保存成功",
        description: "AI 设置已更新",
      });
    } else {
      toast({
        title: "保存失败",
        description: "请稍后重试",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-4xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your preferences and account</p>
      </div>

      {/* AI Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI 设置
          </CardTitle>
          <CardDescription>配置大模型 API 和提示词模板</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isSettingsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label>LLM Provider *</Label>
                <Select
                  value={formData.llmProvider}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, llmProvider: value }))
                  }
                >
                  <SelectTrigger className="rounded-full">
                    <SelectValue placeholder="选择 Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kimi">Kimi (Moonshot)</SelectItem>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic</SelectItem>
                    <SelectItem value="custom">自定义</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* API Key */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>API Key *</Label>
                  {settings?.hasApiKey && !formData.llmApiKey && (
                    <span className="text-xs text-green-600 font-medium">
                      已配置
                    </span>
                  )}
                </div>
                <Input
                  type="password"
                  placeholder={settings?.hasApiKey ? "•••••••• (已配置，留空保持不变)" : "sk-..."}
                  value={formData.llmApiKey}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, llmApiKey: e.target.value }))
                  }
                  className="rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  您的 API Key 将被加密存储，不会明文显示
                  {settings?.hasApiKey && "，如需修改请输入新的 Key"}
                </p>
              </div>

              {/* Base URL */}
              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input
                  placeholder="https://api.moonshot.cn/v1"
                  value={formData.llmBaseUrl || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, llmBaseUrl: e.target.value }))
                  }
                  className="rounded-full"
                />
                <p className="text-xs text-muted-foreground">
                  OpenAI 或 Kimi 通常不需要修改
                </p>
              </div>

              {/* Model */}
              <div className="space-y-2">
                <Label>模型名称 *</Label>
                <Input
                  placeholder="如: kimi-latest, gpt-4, claude-3-opus-20240229"
                  value={formData.llmModel}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, llmModel: e.target.value }))
                  }
                  className="rounded-full"
                />
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <Label>System Prompt</Label>
                <Textarea
                  rows={4}
                  value={formData.systemPrompt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))
                  }
                  className="rounded-2xl"
                />
                <p className="text-xs text-muted-foreground">
                  定义 AI 的角色和行为方式
                </p>
              </div>

              {/* User Prompt Template */}
              <div className="space-y-2">
                <Label>User Prompt 模板</Label>
                <Textarea
                  rows={6}
                  value={formData.userPromptTemplate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, userPromptTemplate: e.target.value }))
                  }
                  className="rounded-2xl font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  使用 {"{{transcription}}"} 作为转录文本的占位符
                </p>
              </div>

              {/* Temperature */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Temperature</Label>
                  <span className="text-sm font-medium">{formData.temperature}</span>
                </div>
                <Slider
                  min={0}
                  max={2}
                  step={0.1}
                  value={[formData.temperature]}
                  onValueChange={([value]) =>
                    setFormData((prev) => ({ ...prev, temperature: value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  控制输出的随机性（0-2），较低值产生更确定的输出
                </p>
              </div>

              {/* Auto Summary Toggle */}
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label>自动总结</Label>
                  <p className="text-xs text-muted-foreground">
                    转录完成后自动生成 AI 总结
                  </p>
                </div>
                <Switch
                  checked={formData.enableAutoSummary}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, enableAutoSummary: checked }))
                  }
                />
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveAISettings}
                disabled={isSaving}
                className="w-full rounded-full"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                ) : null}
                {saved ? "已保存" : "保存设置"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>Choose your preferred color theme</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>

      {/* Account Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LogOut className="h-5 w-5" />
            Account
          </CardTitle>
          <CardDescription>Sign out of your account</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="gap-2"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
