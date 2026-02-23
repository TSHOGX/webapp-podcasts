# Podcast Webapp 功能文档

## 核心功能

> 部分功能有独立详细文档：
> - [AI_CHAT.md](./AI_CHAT.md) - AI 总结与对话
> - [TRANSCRIPTION.md](./TRANSCRIPTION.md) - 转录功能详解

### 1. 播客搜索与浏览

**Podcast Search**
- 使用 Apple iTunes API 搜索数百万播客
- 显示播客封面、标题、作者、描述
- 点击进入播客详情页查看单集列表

**Episode Browser**
- RSS feed 解析获取单集列表
- 显示单集标题、描述、发布日期、时长
- 支持 RSS GUID 稳定识别单集

### 2. 音频播放

**Audio Player**
- Howler.js 音频播放
- wavesurfer.js 波形可视化
- 播放/暂停、快进/快退
- 播放速度调节 (0.5x - 2x)
- 播放进度跟踪 (自动保存到数据库)

### 3. 转录功能

详细文档: [TRANSCRIPTION.md](./TRANSCRIPTION.md)

**核心能力**
- mlx-whisper 转录 (Apple Silicon 优化)
- 分段/词级时间戳
- 点击跳转音频位置
- 多格式导出 (TXT, MD, SRT, VTT, JSON)
- 取消进行中的任务

### 4. AI 总结与对话

详细文档: [AI_CHAT.md](./AI_CHAT.md)

**核心能力**
- LLM 驱动的内容总结 (Kimi/OpenAI/Anthropic)
- 基于转录内容的对话
- 可配置提示词模板
- 流式响应
- 自动/手动总结开关

### 5. 用户功能

**Authentication**
- Supabase Auth 邮箱注册/登录
- Session 管理
- 测试模式支持 (`NEXT_PUBLIC_TEST_MODE`)

**Favorites**
- 收藏/取消收藏播客
- 收藏列表页面

**Playback Progress**
- 自动保存播放进度
- 跨设备同步 (基于登录用户)

**Settings**
- AI 配置
- 主题选择
- 登出

## 技术实现

### 数据库表

| 表名 | 用途 |
|------|------|
| `pc_users` | 用户资料 |
| `pc_podcasts` | 播客元数据 |
| `pc_episodes` | 单集数据 (含 RSS GUID) |
| `pc_transcriptions` | 转录任务和结果 |
| `pc_favorites` | 用户收藏 |
| `pc_playback_progress` | 播放进度 |
| `pc_ai_chats` | AI 对话历史 |
| `pc_user_settings` | 用户 AI 设置 |

### API 路由

| 路由 | 说明 |
|------|------|
| `/api/podcasts/search` | 搜索播客 |
| `/api/podcasts/[id]` | 播客详情 |
| `/api/transcribe` | 创建转录任务 |
| `/api/transcriptions/[id]/cancel` | 取消转录 |
| `/api/ai/settings` | AI 设置 CRUD |
| `/api/ai/chats/[id]` | 获取对话历史 |
| `/api/ai/chat` | 发送消息 (SSE) |
| `/api/ai/regenerate-summary` | 生成总结 (SSE) |

### 状态管理

**Zustand Stores:**
- `player-store.ts` - 音频播放状态
- `ai-store.ts` - AI 对话和设置状态

### 组件结构

```
components/
├── ai/
│   └── ai-chat-panel.tsx      # AI 对话面板
├── transcription/
│   ├── transcription-viewer.tsx  # 转录查看器
│   └── segment-card.tsx          # 单段转录卡片
├── audio/
│   └── audio-player.tsx       # 音频播放器
├── podcast/
│   └── episode-card.tsx       # 单集卡片
└── ui/                        # shadcn/ui 组件
```

## 使用流程

### 转录流程

1. 用户在单集页点击 "Transcribe"
2. 前端调用 `POST /api/transcribe`
3. 后端创建转录记录，转发到 FastAPI
4. FastAPI 下载音频，使用 mlx-whisper 转录
5. WebSocket 推送进度更新
6. 转录完成，保存 segments 到数据库
7. (可选) 自动生成 AI 总结

### AI 对话流程

1. 用户查看已完成的转录
2. `AIChatPanel` 加载对话历史
3. 用户发送消息或请求总结
4. 后端调用 LLM API (基于用户设置)
5. SSE 流式返回响应
6. 消息保存到 `pc_ai_chats`

## 配置说明

### 环境变量

**Frontend (.env.local)**
```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_API_URL=http://127.0.0.1:12890
SUPABASE_SERVER_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
```

**Backend (.env)**
```env
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
WHISPER_MODEL=mlx-community/whisper-large-v3-turbo
TEMP_AUDIO_DIR=/tmp/podcast-transcribe
```

### AI Provider 配置示例

**Kimi (默认)**
- Provider: `kimi`
- Base URL: `https://api.moonshot.cn/v1`
- Model: `kimi-latest`

**OpenAI**
- Provider: `openai`
- Base URL: `https://api.openai.com/v1`
- Model: `gpt-4`

**Anthropic**
- Provider: `anthropic`
- Base URL: `https://api.anthropic.com`
- Model: `claude-3-opus-20240229`
