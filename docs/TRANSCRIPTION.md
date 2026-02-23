# Transcription

播客转录功能，使用 mlx-whisper 将音频转换为带时间戳的文本。

## 功能概述

### 核心转录
- 使用 mlx-whisper (Apple Silicon 优化)
- 支持模型: whisper-large-v3-turbo
- 队列式异步处理
- WebSocket 实时进度更新

### 时间戳转录
- 分段级时间戳 (segment-level)
- 词级时间戳 (word-level, optional)
- 当前播放段高亮
- 点击跳转音频位置

### 转录取消
- 取消 pending/processing 状态的任务
- FastAPI 任务追踪 (task_id)
- 状态同步到数据库

## 架构

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│  POST /api   │────▶│   FastAPI   │
│  Episode    │◄────│  /transcribe │◄────│  /transcribe│
└─────────────┘ WS  └──────────────┘     └──────┬──────┘
                                                 │
                                                 ▼
                                          ┌─────────────┐
                                          │ mlx-whisper │
                                          └─────────────┘
```

## 数据库表

### pc_transcriptions

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| user_id | UUID | 关联用户 |
| episode_id | UUID | 关联单集 |
| status | VARCHAR(50) | pending/processing/completed/failed/cancelled |
| text | TEXT | 转录文本 |
| segments | JSONB | 带时间戳的分段数据 |
| language | VARCHAR(10) | 检测到的语言 |
| task_id | VARCHAR(255) | FastAPI 任务 ID |
| error_message | TEXT | 错误信息 |
| created_at | TIMESTAMP | 创建时间 |
| completed_at | TIMESTAMP | 完成时间 |

### segments 数据结构

```json
[
  {
    "id": 0,
    "start": 0.0,
    "end": 5.5,
    "text": "转录文本内容",
    "words": [
      {"word": "转录", "start": 0.0, "end": 0.8},
      {"word": "文本", "start": 0.9, "end": 1.5}
    ]
  }
]
```

## API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/transcribe` | POST | 创建转录任务 |
| `/api/transcriptions/check` | POST | 检查转录状态 |
| `/api/transcriptions/[id]/cancel` | POST | 取消转录 |
| `/api/transcriptions/[id]` | DELETE | 删除转录 |

## 组件

### TranscriptionViewer
`components/transcription/transcription-viewer.tsx`

- 显示分段转录内容
- 自动滚动到当前播放段
- 点击跳转音频位置
- 支持显示/隐藏时间戳

### SegmentCard
`components/transcription/segment-card.tsx`

- 单个转录分段卡片
- 显示时间戳
- 高亮当前播放段
- 点击跳转

## 导出格式

### TXT
纯文本，包含标题和转录内容。

### Markdown
带时间戳的 Markdown 格式：
```markdown
# 标题

[00:30] 第一段文本

[01:45] 第二段文本
```

### SRT
字幕格式：
```
1
00:00:00,000 --> 00:00:05,500
第一段文本

2
00:00:05,500 --> 00:00:12,000
第二段文本
```

### VTT
WebVTT 格式：
```
WEBVTT

00:00:00.000 --> 00:00:05.500
第一段文本

00:00:05.500 --> 00:00:12.000
第二段文本
```

### JSON
完整数据结构，包含所有元数据。

## 使用流程

1. 用户在单集页点击 "Transcribe"
2. 前端调用 `POST /api/transcribe`
3. 后端创建/更新 episode 记录
4. 转发请求到 FastAPI
5. FastAPI 下载音频，使用 mlx-whisper 转录
6. WebSocket 推送进度更新
7. 结果保存到 pc_transcriptions (含 segments)
8. (可选) 自动生成 AI 总结

## 转录取消

支持取消的状态：
- `pending` - 排队等待中
- `processing` - 正在处理

取消流程：
1. 调用 `POST /api/transcriptions/[id]/cancel`
2. 通知 FastAPI 取消任务
3. 更新数据库状态为 `cancelled`
4. 前端状态同步更新

## 状态机

```
       ┌──────────┐
       │  pending │
       └────┬─────┘
            │
            ▼
    ┌───────────────┐
    │   processing  │
    └───────┬───────┘
            │
    ┌───────┴───────┐
    ▼               ▼
┌─────────┐   ┌──────────┐
│completed│   │  failed  │
└─────────┘   └──────────┘

    ┌──────────┐
    │cancelled │
    └──────────┘
```

## 相关文档

- [AI_CHAT.md](./AI_CHAT.md) - 转录完成后的 AI 总结功能
