# Apple iTunes Search API 测试分析报告

**测试日期**: 2026-02-15
**API 版本**: iTunes Search API (公开版，无需认证)

---

## 1. API 基本用法

### 1.1 基础端点

| 端点 | 说明 |
|------|------|
| `https://itunes.apple.com/search` | 搜索 API |
| `https://itunes.apple.com/lookup?id={id}` | 通过 ID 查询详情 |

### 1.2 主要参数

| 参数 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `term` | string | 搜索关键词（URL 编码） | `term=tech+podcast` |
| `media` | string | 媒体类型 | `media=podcast` |
| `entity` | string | 返回实体类型 | `entity=podcast` / `podcastEpisode` |
| `limit` | number | 返回数量（1-200） | `limit=50` |
| `attribute` | string | 指定搜索字段 | `attribute=titleTerm` |
| `country` | string | 国家代码（默认 US） | `country=CN` |
| `explicit` | string | 是否包含成人内容 | `explicit=No` |

### 1.3 Attribute 可选值（Podcast）

- `titleTerm` - 标题搜索
- `authorTerm` / `artistTerm` - 作者搜索
- `languageTerm` - 语言
- `genreIndex` - 分类
- `descriptionTerm` - 描述
- `keywordsTerm` - 关键词

---

## 2. 测试示例

### 2.1 搜索播客

```bash
curl "https://itunes.apple.com/search?term=tech+podcast&media=podcast&entity=podcast&limit=5"
```

### 2.2 获取详情

```bash
curl "https://itunes.apple.com/lookup?id=360084272"
```

### 2.3 按标题精确搜索

```bash
curl "https://itunes.apple.com/search?term=Serial&media=podcast&attribute=titleTerm"
```

---

## 3. API 返回字段（完整列表）

### 3.1 Podcast 类型返回字段

**共 29 个字段：**

```typescript
{
  // 基础标识
  wrapperType: "track"           // 包装类型
  kind: "podcast"                // 内容类型
  trackId: number                // 播客唯一 ID
  collectionId: number           // 合集 ID（同 trackId）
  artistId: number               // 创作者 ID

  // 名称信息
  trackName: string              // 播客名称
  collectionName: string         // 合集名称（同 trackName）
  artistName: string             // 创作者/主播名称
  trackCensoredName: string      // 过滤后名称
  collectionCensoredName: string // 过滤后合集名称

  // 关键 URL
  feedUrl: string                // RSS Feed URL ⭐️重要
  trackViewUrl: string           // Apple Podcasts 页面
  collectionViewUrl: string      // 合集页面
  artistViewUrl: string          // 创作者页面

  // 封面图（4种尺寸）
  artworkUrl30: string           // 30x30px
  artworkUrl60: string           // 60x60px
  artworkUrl100: string          // 100x100px
  artworkUrl600: string          // 600x600px（推荐）

  // 内容元数据
  trackCount: number             // 总集数（非播放量！）
  trackTimeMillis: number        // 最新集时长（毫秒）
  releaseDate: string            // 最新集发布日期 (ISO 8601)
  primaryGenreName: string       // 主分类
  genres: string[]               // 所有分类名称
  genreIds: string[]             // 分类 ID

  // 内容分级
  trackExplicitness: string      // "explicit" | "cleaned" | "notExplicit"
  collectionExplicitness: string // 同上
  contentAdvisoryRating: string  // "Explicit" | "Clean"

  // 价格/地区
  trackPrice: number             // 价格（通常为 0）
  collectionPrice: number        // 合集价格（通常为 0）
  currency: string               // 货币代码，如 "USD"
  country: string                // 国家代码，如 "USA"
  collectionHdPrice: number      // HD 价格（通常为 0）
}
```

### 3.2 Podcast Episode 返回字段

当 `entity=podcastEpisode` 时，额外包含：

```typescript
{
  kind: "podcast-episode"
  episodeUrl: string             // 音频文件直接 URL
  episodeContentType: string     // MIME 类型，如 "audio/mpeg"
  episodeFileExtension: string   // 文件扩展名，如 "mp3"
  episodeGuid: string            // 集的唯一标识
}
```

---

## 4. 关键结论：Popularity / 热度数据

### 4.1 ❌ API 不提供的数据

| 数据类型 | 是否提供 | 说明 |
|----------|----------|------|
| **播放量 / 收听次数** | ❌ 否 | API 完全不返回任何播放统计 |
| **订阅数 / 关注数** | ❌ 否 | 无此字段 |
| **评分 / 星级** | ❌ 否 | Podcast 类型特有，App 类型才有 |
| **评分人数** | ❌ 否 | Podcast 类型特有 |
| **评论数** | ❌ 否 | 无法获取 |
| **热度排名** | ❌ 否 | 无排行榜数据 |
| **趋势数据** | ❌ 否 | 无时间序列数据 |

### 4.2 ✅ 可用的间接指标

虽然 API 不直接提供 popularity 数据，但以下字段可作为间接参考：

| 字段 | 说明 | 参考价值 |
|------|------|----------|
| `trackCount` | 总集数 | 集数越多，通常播客存在时间越长 |
| `releaseDate` | 最新集日期 | 越新表示越活跃 |
| `trackTimeMillis` | 最新集时长 | 可了解内容长度 |

**注意**：`trackCount` 是**总集数**，不是播放量！

### 4.3 对比：App 类型有评分数据

对于 `media=software`，API 会返回：

```typescript
{
  averageUserRating: number                   // 平均评分（1-5）
  averageUserRatingForCurrentVersion: number  // 当前版本评分
  userRatingCount: number                     // 总评分人数
  userRatingCountForCurrentVersion: number    // 当前版本评分人数
}
```

但这些字段在 `media=podcast` 查询中**完全不存在**。

---

## 5. 封面图返回形式

### 5.1 提供的尺寸

| 字段 | 尺寸 | 推荐用途 |
|------|------|----------|
| `artworkUrl30` | 30×30 px | 超小图标、列表装饰 |
| `artworkUrl60` | 60×60 px | 标准列表缩略图 |
| `artworkUrl100` | 100×100 px | 中等尺寸展示 |
| `artworkUrl600` | 600×600 px | **高清封面（推荐）** |

### 5.2 URL 结构

```
https://is1-ssl.mzstatic.com/image/thumb/
  Podcasts211/v4/d8/c6/2b/xxxxx/mza_xxxxx.jpg
  /600x600bb.jpg
```

**特点：**
- 所有尺寸指向同一源文件，仅 URL 后缀尺寸参数不同
- 托管于 Apple CDN（is1-ssl.mzstatic.com）
- 格式：JPG 或 PNG
- 可通过修改 URL 获取其他尺寸（如 `/200x200bb.jpg`）

### 5.3 使用建议

```typescript
// 推荐：优先使用 600x600，然后降采样
const artwork = podcast.artworkUrl600 ||
                podcast.artworkUrl100 ||
                podcast.artworkUrl60;

// 如需特定尺寸，可替换 URL
const smallArtwork = artwork.replace('600x600bb', '200x200bb');
```

---

## 6. 获取 Popularity 数据的替代方案

由于 iTunes Search API 不提供 popularity 数据，可考虑以下替代方案：

### 6.1 第三方 API

| API 服务 | 提供的数据 | 认证 | 费用 |
|----------|-----------|------|------|
| **Spotify Web API** | 流行度指数 (0-100) | OAuth | 免费（有配额）|
| **Podchaser API** | 评分、评论、收听量估计 | API Key | 免费/付费 |
| **Taddy API** | 热度、评分、评论、趋势 | API Key | 付费 |
| **Chartable API** | 排行榜、排名数据 | API Key | 付费 |
| **PodcastIndex API** | 部分流行度指标 | 需注册 | 免费 |
| **Listen Notes API** | 评分、评论、收听数据 | API Key | 免费/付费 |

### 6.2 Apple 官方（有限制）

| API | 数据 | 限制 |
|-----|------|------|
| **Apple Podcasts Connect API** | 详细统计数据 | 仅访问自己的播客 |
| **Apple Affiliate API** | 基础元数据 | 无 popularity 数据 |

### 6.3 网页抓取（不推荐）

- Apple Podcasts 网页版包含部分 popularity 指标（如"热门程度"）
- 但 Apple 有反爬虫机制，不推荐用于生产环境

---

## 7. API 限制与最佳实践

### 7.1 速率限制

- **限制**: 约 20 请求/分钟/IP
- **超过限制**: 返回 HTTP 429 (Too Many Requests)

### 7.2 最佳实践

1. **缓存结果**: API 数据更新不频繁，建议缓存 1-24 小时
2. **优先使用 HTTPS**: 所有请求应使用 SSL
3. **处理缺失字段**: 某些字段可能为空（如 `contentAdvisoryRating`）
4. **验证 feedUrl**: 使用前应验证 RSS Feed 是否可访问

### 7.3 错误处理

| HTTP 状态 | 含义 | 处理建议 |
|-----------|------|----------|
| 200 | 成功 | - |
| 429 | 请求过多 | 等待后重试，添加指数退避 |
| 403 | 禁止访问 | 检查请求头，避免被识别为爬虫 |
| 500 | 服务器错误 | 稍后重试 |

---

## 8. 完整响应示例

### 8.1 搜索响应

```json
{
  "resultCount": 5,
  "results": [
    {
      "wrapperType": "track",
      "kind": "podcast",
      "artistId": 204040224,
      "collectionId": 470624027,
      "trackId": 470624027,
      "artistName": "TED Tech",
      "collectionName": "TED Tech",
      "trackName": "TED Tech",
      "collectionCensoredName": "TED Tech",
      "trackCensoredName": "TED Tech",
      "artistViewUrl": "https://podcasts.apple.com/us/artist/ted-talks/204040224?uo=4",
      "collectionViewUrl": "https://podcasts.apple.com/us/podcast/ted-tech/id470624027?uo=4",
      "feedUrl": "https://feeds.acast.com/public/shows/67585c62102e6d4448d44969",
      "trackViewUrl": "https://podcasts.apple.com/us/podcast/ted-tech/id470624027?uo=4",
      "artworkUrl30": "https://is1-ssl.mzstatic.com/image/thumb/.../30x30bb.jpg",
      "artworkUrl60": "https://is1-ssl.mzstatic.com/image/thumb/.../60x60bb.jpg",
      "artworkUrl100": "https://is1-ssl.mzstatic.com/image/thumb/.../100x100bb.jpg",
      "artworkUrl600": "https://is1-ssl.mzstatic.com/image/thumb/.../600x600bb.jpg",
      "collectionPrice": 0.00,
      "trackPrice": 0.00,
      "collectionHdPrice": 0,
      "releaseDate": "2026-02-13T05:00:00Z",
      "collectionExplicitness": "notExplicit",
      "trackExplicitness": "cleaned",
      "trackCount": 253,
      "trackTimeMillis": 756000,
      "country": "USA",
      "currency": "USD",
      "primaryGenreName": "Technology",
      "contentAdvisoryRating": "Clean",
      "genreIds": ["1318", "26"],
      "genres": ["Technology", "Podcasts"]
    }
  ]
}
```

### 8.2 Lookup 响应

```json
{
  "resultCount": 1,
  "results": [
    {
      "trackId": 360084272,
      "trackName": "The Joe Rogan Experience",
      "artistName": "Joe Rogan",
      "artworkUrl600": "https://is1-ssl.mzstatic.com/image/thumb/.../600x600bb.jpg",
      "feedUrl": "https://feeds.megaphone.fm/GLT1412515089",
      "trackCount": 2000,
      "trackTimeMillis": 9532000,
      "primaryGenreName": "Comedy",
      "releaseDate": "2026-02-13T18:00:00Z"
      // 注意：没有 rating、没有 popularity、没有 play count
    }
  ]
}
```

---

## 9. 总结

### 9.1 iTunes Search API 适用场景

✅ **适合**：
- 基础播客搜索
- 获取播客元数据（名称、作者、分类）
- 获取封面图
- 获取 RSS Feed URL

❌ **不适合**：
- 获取 popularity/热度数据
- 获取播放量/收听数据
- 获取评分/评论数据
- 排行榜展示

### 9.2 如果需要 Popularity 数据

需要额外集成以下至少一种服务：
1. **Spotify Web API**（流行度指数）
2. **Podchaser API**（评分 + 收听估计）
3. **Taddy API**（综合 popularity 数据）
4. **自建统计系统**（通过 RSS 或音频文件追踪）

---

## 10. 参考资源

- [Apple iTunes Search API Documentation](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)
- [Apple Affiliate Program - Search API](https://performance-partners.apple.com/search-api)
- [PodcastIndex API](https://podcastindex-org.github.io/docs-api/)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [Podchaser API](https://www.podchaser.com/pages/api)

---

*报告生成时间: 2026-02-15*
*测试工具: curl + Python*
*测试环境: macOS / Darwin*
