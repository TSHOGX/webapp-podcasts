# AI Chat & Summary

AI 总结与对话功能，基于 LLM 对播客转录内容进行分析总结和交互式问答。

## 功能概述

### AI Summary
- 自动生成结构化内容总结
- 可配置的提示词模板
- 流式响应显示
- 总结包含：核心观点、关键话题、重要引用、结论

### AI Chat
- 基于转录内容的多轮对话
- 历史消息持久化
- 流式响应
- 支持追问和深入讨论

## 架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│  Next.js API │────▶│   LLM API   │
│ AIChatPanel │◄────│  /api/ai/*   │◄────│ Kimi/OpenAI │
└─────────────┘ SSE └──────────────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│  useAIStore │
│  (Zustand)  │
└─────────────┘
```

## 数据库表

### pc_ai_chats
存储 AI 对话历史。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| transcription_id | UUID | 关联转录 |
| user_id | UUID | 关联用户 |
| role | VARCHAR(20) | system/user/assistant |
| content | TEXT | 消息内容 |
| model | VARCHAR(100) | 使用的模型 |
| metadata | JSONB | 额外元数据 |
| created_at | TIMESTAMP | 创建时间 |

### pc_user_settings
存储用户 AI 配置。

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 关联用户 |
| llm_provider | VARCHAR(50) | 提供商 |
| llm_api_key | TEXT | API Key (加密) |
| llm_base_url | TEXT | 自定义 API 地址 |
| llm_model | VARCHAR(100) | 模型名称 |
| system_prompt | TEXT | 系统提示词 |
| user_prompt_template | TEXT | 用户提示词模板 |
| temperature | DECIMAL(3,2) | 温度参数 |
| enable_auto_summary | BOOLEAN | 自动总结开关 |

## API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/ai/settings` | GET/POST | 获取/保存用户设置 |
| `/api/ai/chats/[id]` | GET | 获取对话历史 |
| `/api/ai/chat` | POST | 发送消息 (SSE 流式) |
| `/api/ai/regenerate-summary` | POST | 生成总结 (SSE 流式) |

## 组件

### AIChatPanel
`components/ai/ai-chat-panel.tsx`

- 显示对话历史
- 输入框发送消息
- 重新生成总结按钮
- 设置页面链接
- 未配置状态的引导

### useAIStore
`store/ai-store.ts`

- 加载对话历史
- 发送消息 (SSE 处理)
- 重新生成总结
- 加载/保存设置
- 流式内容管理

## 配置

### Provider 设置

**Kimi (默认)**
```
Provider: kimi
Base URL: https://api.moonshot.cn/v1
Model: kimi-latest
```

**OpenAI**
```
Provider: openai
Base URL: https://api.openai.com/v1
Model: gpt-4
```

**Anthropic**
```
Provider: anthropic
Base URL: https://api.anthropic.com
Model: claude-3-opus-20240229
```

### 提示词模板

**System Prompt**
默认角色定义，控制 AI 的总结风格和专业度。

**User Prompt Template**
必须包含 `{{transcription}}` 占位符，用于插入转录文本。

默认模板：
```
请根据以下播客转录文本，生成一份结构化的内容总结：

{{transcription}}

请包含以下部分：
1. 核心观点概述
2. 关键话题与讨论要点
3. 重要引用或案例
4. 结论与启发
```

## 使用流程

1. 用户完成转录后，在单集页面看到 AI 面板
2. 首次使用需要前往 `/settings` 配置 Provider 和 API Key
3. 配置完成后点击 "生成总结" 或发送自定义消息
4. 前端通过 SSE 流式接收 AI 响应
5. 对话自动保存，下次查看时可继续对话

## 自动总结

开启 `enable_auto_summary` 后：
- 转录完成时自动触发总结生成
- 无需用户手动操作
- 可在设置中随时关闭
