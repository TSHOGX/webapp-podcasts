# Podcast Webapp 部署指南

## Gateway 集成说明

Podcast Webapp 已集成到 Gateway 中，可通过以下 URL 访问：

- **Gateway 入口**: `https://tshogx.vip.cpolar.cn/`
- **Podcasts 应用**: `https://tshogx.vip.cpolar.cn/podcasts`

## 架构说明

```
用户请求 → Gateway (port 1288) → Podcasts Frontend (port 12889)
                                    ↓
                              Podcasts API (port 12890)
```

### 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Gateway | 1288 | 统一入口 |
| Podcasts Frontend | 12889 | Next.js 前端 |
| Podcasts API | 12890 | FastAPI 后端 |

## 文件修改记录

### 1. Podcast Webapp (`/Users/xixi/Workspace/webapp/podcasts/`)

#### `apps/web/next.config.ts`
- 添加 `basePath: '/podcasts'`
- 添加 `assetPrefix: '/podcasts'`

#### `apps/web/.env.local`
- 配置 Supabase 连接
- 配置 API URL (`http://127.0.0.1:12890`)

### 2. Gateway (`/Users/xixi/Workspace/webapp/gateway/`)

#### `next.config.ts`
添加路由规则：
```typescript
{
  source: "/podcasts",
  destination: "http://localhost:12889/podcasts/",
},
{
  source: "/podcasts/:path*",
  destination: "http://localhost:12889/podcasts/:path*",
},
```

#### `ecosystem.config.cjs`
添加 PM2 进程：
```javascript
{
  name: "podcasts-web",
  cwd: "/Users/xixi/Workspace/webapp/podcasts/apps/web",
  script: "node",
  args: ".next/standalone/server.js",
  env: { PORT: "12889" },
},
{
  name: "podcasts-api",
  cwd: "/Users/xixi/Workspace/webapp/podcasts/apps/api",
  script: "uv",
  args: "run uvicorn main:app --host 0.0.0.0 --port 12890",
  env: { PORT: "12890", ... },
},
```

#### `src/app/page.tsx`
添加导航卡片：
```typescript
{
  name: "Podcasts",
  description: "Search podcasts, transcribe episodes, and manage your library",
  path: "/podcasts",
  icon: Headphones,
  gradient: "from-green-500 to-emerald-600",
},
```

## 启动步骤

### 1. 启动 Supabase (如果本地开发)

```bash
cd /Users/xixi/Workspace/webapp/podcasts
supabase start
```

### 2. 启动所有服务

```bash
cd /Users/xixi/Workspace/webapp/gateway
pm2 start ecosystem.config.cjs
```

### 3. 或单独启动

```bash
# Gateway
cd /Users/xixi/Workspace/webapp/gateway
npm run start

# Podcasts Frontend
cd /Users/xixi/Workspace/webapp/podcasts/apps/web
PORT=12889 node .next/standalone/server.js

# Podcasts API
cd /Users/xixi/Workspace/webapp/podcasts/apps/api
source .venv/bin/activate
uv run uvicorn main:app --host 0.0.0.0 --port 12890
```

## 验证部署

### 1. 检查服务状态

```bash
pm2 status
```

### 2. 测试 Gateway 转发

```bash
# 测试 gateway
curl -o /dev/null -w "%{http_code}" http://localhost:1288/podcasts

# 测试 podcasts 前端直连
curl -o /dev/null -w "%{http_code}" http://localhost:12889/podcasts/

# 测试 api 健康检查
curl http://localhost:12890/health
```

### 3. 浏览器访问

- Gateway 首页: `https://tshogx.vip.cpolar.cn/`
- Podcasts 应用: `https://tshogx.vip.cpolar.cn/podcasts`

## 故障排除

### 404 错误

检查 gateway 的 rewrite 规则是否正确配置。

### API 请求失败

检查：
1. FastAPI 后端是否运行 (`pm2 logs podcasts-api`)
2. 环境变量 `NEXT_PUBLIC_API_URL` 是否设置为 `http://127.0.0.1:12890`
3. Supabase 是否可访问

### 静态资源加载失败

检查 `next.config.ts` 中的 `assetPrefix` 是否设置为 `/podcasts`。

### 端口冲突

确保端口 12889 和 12890 未被占用：

```bash
lsof -i :12889
lsof -i :12890
```

## 更新部署

```bash
# 1. 更新代码
cd /Users/xixi/Workspace/webapp/podcasts
git pull  # 或手动更新

# 2. 重新构建前端
cd apps/web
yarn build

# 3. 重启服务
pm2 restart podcasts-web
pm2 restart podcasts-api

# 4. 重启 gateway
pm2 restart gateway
```

## 环境变量参考

### Podcasts Frontend

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
NEXT_PUBLIC_API_URL=http://127.0.0.1:12890
NEXT_PUBLIC_BASE_PATH=/podcasts
SUPABASE_SERVER_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=sb_secret_your_service_role_key
```

说明：`NEXT_PUBLIC_SUPABASE_URL` 用于浏览器鉴权请求（可用公网地址）。
说明：`SUPABASE_SERVER_URL` 供 Next.js 服务端调用，建议使用本机/内网地址。
说明：`SUPABASE_SERVICE_ROLE_KEY` 供 Next.js 服务端 API 路由使用，不要加 `NEXT_PUBLIC_` 前缀。

### Podcasts API

```env
PORT=12890
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_SERVICE_ROLE_KEY=sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz
WHISPER_MODEL=mlx-community/whisper-large-v3-turbo
TEMP_AUDIO_DIR=/tmp/podcast-transcribe
```

## AI 功能配置

如需使用 AI 总结和对话功能，用户需要在 `/settings` 页面配置：

1. **选择 Provider**: Kimi (Moonshot)、OpenAI、Anthropic 或自定义
2. **填写 API Key**: 用户的 LLM API Key (加密存储)
3. **选择模型**: 如 `kimi-latest`、`gpt-4`、`claude-3-opus-20240229`
4. **(可选)** 自定义提示词模板和 Temperature

AI 设置按用户存储在 `pc_user_settings` 表中。
