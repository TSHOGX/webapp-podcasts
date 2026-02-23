# Podcast Webapp 文档

本文档目录包含项目的详细文档。

## 文档索引

| 文档 | 说明 |
|------|------|
| [CLAUDE.md](../CLAUDE.md) | 项目总览和开发指南 (根目录，简洁版) |
| [FEATURES.md](./FEATURES.md) | 功能总览 |
| [AI_CHAT.md](./AI_CHAT.md) | AI 总结与对话功能详解 |
| [TRANSCRIPTION.md](./TRANSCRIPTION.md) | 转录功能详解 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 部署指南和 Gateway 集成 |

## 快速链接

### 开发相关
- [项目架构](../CLAUDE.md#application-architecture)
- [开发命令](../CLAUDE.md#development-commands)
- [数据库 Schema](../CLAUDE.md#database-schema)
- [API 端点](../CLAUDE.md#key-implementation-patterns)

### 功能相关
- [AI 总结与对话](./AI_CHAT.md) - 详细文档
- [转录功能](./TRANSCRIPTION.md) - 详细文档
- [功能总览](./FEATURES.md) - 功能列表

### 部署相关
- [环境变量](./DEPLOYMENT.md#环境变量参考)
- [AI 功能配置](./DEPLOYMENT.md#ai-功能配置)
- [故障排除](./DEPLOYMENT.md#故障排除)

## 新功能概览

### 最近添加的功能

1. **AI Chat & Summary**
   - 基于 LLM 的自动内容总结
   - 与转录内容交互对话
   - 支持 Kimi、OpenAI、Anthropic

2. **Timestamped Transcription**
   - 分段时间戳显示
   - 播放时自动高亮当前段落
   - 点击跳转音频位置
   - 支持 SRT/VTT 字幕导出

3. **Transcription Cancellation**
   - 取消进行中的转录任务
   - 支持 pending/processing 状态

4. **Settings Page**
   - AI Provider 配置
   - 提示词模板自定义
   - 主题切换

## 数据库迁移

迁移文件位于 `supabase/migrations/`：

- `001_initial_schema.sql` - 初始表结构
- `002_remove_pc_users.sql` - 移除手动 pc_users
- `003_add_episode_guid.sql` - 添加 RSS GUID
- `004_add_transcription_segments.sql` - 添加时间戳支持
- `005_add_cancelled_status.sql` - 添加取消状态
- `006_add_ai_tables.sql` - 添加 AI 表
