import os
import re
import json
import argparse
from datetime import datetime

import requests
import mlx_whisper


def sanitize_filename(filename: str) -> str:
    filename = re.sub(r'[<>:"/\\|?*]', "", filename)
    filename = re.sub(r"\s+", " ", filename).strip()
    return filename[:200]


def fetch_html(url: str) -> str:
    print(f"正在访问: {url}")
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": url,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    }
    resp = requests.get(url, headers=headers, timeout=20)
    resp.raise_for_status()
    return resp.text


def parse_episode_metadata(page_source: str) -> dict:
    # Prefer og:title → <meta property="og:title" content="...">
    m = re.search(
        r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^\"\']+)["\']',
        page_source,
        re.IGNORECASE,
    )
    title = m.group(1).strip() if m else "未命名播客"

    # Find media url quickly (m4a/mp3)
    media_url = ""
    for ext in ["m4a", "mp3"]:
        m = re.search(
            rf"(https?://[^\s\"\']+\.{ext}(?:\?[^\s\"\']*)?)",
            page_source,
            re.IGNORECASE,
        )
        if m:
            media_url = m.group(1)
            break
    if not media_url:
        raise RuntimeError("未找到音频URL")

    # Try to extract a date if present
    date = None
    for key in ["datePublished", "published", "publishedAt", "createdAt"]:
        m = re.search(
            rf'"{key}"\s*:\s*"([0-9]{{4}}-[0-9]{{2}}-[0-9]{{2}})', page_source
        )
        if m:
            date = m.group(1)
            break
    if not date:
        date = datetime.now().strftime("%Y-%m-%d")

    return {"title": title, "media_url": media_url, "date": date}


def transcribe(audio_path: str, model: str, language: str) -> str:
    print(f"🎙️  开始转录: {audio_path}")
    print(f"🤖 模型: {model}")
    print(f"🌐 语言: {language}")
    result = mlx_whisper.transcribe(
        audio_path,
        path_or_hf_repo=model,
        language=language,
        verbose=True,
    )
    segments = result.get("segments", [])
    texts = []
    for seg in segments:
        if isinstance(seg, dict):
            t = (seg.get("text") or "").strip()
            if t:
                texts.append(t)
    return " ".join(texts)


def save_markdown(output_dir: str, title: str, date_str: str, text: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    ymd = date_str.replace("-", "")
    filename = f"podcast_{ymd}_{sanitize_filename(title)}.md"
    path = os.path.join(output_dir, filename)
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"# {title}\n\n日期: {date_str}\n\n{text}\n")
    return path


def download_audio(url: str, referer: str, out_dir: str, title: str) -> str:
    os.makedirs(out_dir, exist_ok=True)
    ext = ".m4a" if url.lower().endswith(".m4a") else ".mp3"
    path = os.path.join(out_dir, sanitize_filename(title) + ext)
    if os.path.exists(path):
        return path
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": referer,
    }
    with requests.get(url, headers=headers, stream=True, timeout=60) as r:
        r.raise_for_status()
        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
    return path


def main():
    parser = argparse.ArgumentParser(
        description="Transcribe Xiaoyuzhou episode to markdown"
    )
    parser.add_argument(
        "url", help="Episode URL, e.g. https://www.xiaoyuzhoufm.com/episode/..."
    )
    parser.add_argument(
        "--out",
        dest="out_dir",
        default="/Users/xixi/Library/Mobile Documents/iCloud~md~obsidian/Documents/Uu/Clipping/Podcasts",
        help="Markdown output dir",
    )
    parser.add_argument(
        "--tmp",
        dest="tmp_dir",
        default="/Users/xixi/Workspace/tmp_audio",
        help="Temp audio dir",
    )
    parser.add_argument(
        "--model", dest="model", default="mlx-community/whisper-large-v3-turbo"
    )
    parser.add_argument("--lang", dest="language", default="Chinese")
    parser.add_argument("--metadata-only", action="store_true")
    parser.add_argument("--no-transcribe", action="store_true")
    args = parser.parse_args()

    # Fetch page
    html = fetch_html(args.url)

    # Parse metadata
    meta = parse_episode_metadata(html)
    title = meta["title"]
    media_url = meta["media_url"]
    date_str = meta["date"]

    if args.metadata_only:
        print(json.dumps(meta, ensure_ascii=False, indent=2))
        return

    # Download audio
    audio_path = download_audio(media_url, args.url, args.tmp_dir, title)
    if args.no_transcribe:
        print(f"Downloaded: {audio_path}")
        return

    # Transcribe
    text = transcribe(audio_path, args.model, args.language)

    # Save markdown
    md_path = save_markdown(args.out_dir, title, date_str, text)
    print(f"Saved transcript: {md_path}")

    # Cleanup
    try:
        os.remove(audio_path)
    except Exception:
        pass
    try:
        import shutil

        shutil.rmtree(args.tmp_dir)
    except Exception:
        pass


if __name__ == "__main__":
    main()

