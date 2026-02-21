#!/usr/bin/env python3
"""
Podcast Transcription Test Tool

A command-line tool for end-to-end testing of the podcast transcription feature.
Supports submitting audio URLs for transcription and polling for results.

Usage:
    python scripts/test-transcribe.py --url "https://example.com/podcast.mp3"
    python scripts/test-transcribe.py --url "..." --title "Test Episode" --podcast "Test Podcast"
    python scripts/test-transcribe.py --check --transcription-id "uuid"
"""

import argparse
import json
import sys
import time
from datetime import datetime
from typing import Optional
from urllib.parse import urljoin

import requests


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Podcast Transcription Test Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Submit a transcription request
  python scripts/test-transcribe.py --url "https://example.com/podcast.mp3"

  # With custom title and podcast name
  python scripts/test-transcribe.py --url "..." --title "Episode 1" --podcast "My Podcast"

  # Check existing transcription status
  python scripts/test-transcribe.py --check --transcription-id "uuid"

  # Use custom base URL
  python scripts/test-transcribe.py --url "..." --base-url "http://localhost:3000"
        """
    )

    parser.add_argument(
        "--url",
        type=str,
        help="Audio URL to transcribe"
    )

    parser.add_argument(
        "--title",
        type=str,
        default="",
        help="Episode title (optional)"
    )

    parser.add_argument(
        "--podcast",
        type=str,
        default="",
        help="Podcast name (optional)"
    )

    parser.add_argument(
        "--base-url",
        type=str,
        default="http://localhost:12889/podcasts",
        help="Base URL of the podcast service (default: http://localhost:12889/podcasts)"
    )

    parser.add_argument(
        "--timeout",
        type=int,
        default=600,
        help="Maximum time to wait for transcription in seconds (default: 600)"
    )

    parser.add_argument(
        "--check",
        action="store_true",
        help="Check status of existing transcription instead of creating new one"
    )

    parser.add_argument(
        "--transcription-id",
        type=str,
        help="Transcription ID to check (required with --check)"
    )

    parser.add_argument(
        "--output",
        type=str,
        help="Save transcription text to file (optional)"
    )

    parser.add_argument(
        "--poll-interval",
        type=int,
        default=5,
        help="Seconds between status checks (default: 5)"
    )

    return parser.parse_args()


def print_header():
    """Print the tool header."""
    print("🎵 Podcast Transcription Test Tool")
    print("=" * 50)


def print_config(args: argparse.Namespace):
    """Print configuration."""
    print(f"Base URL: {args.base_url}")
    if args.url:
        print(f"Audio URL: {args.url}")
    if args.title:
        print(f"Title: {args.title}")
    if args.podcast:
        print(f"Podcast: {args.podcast}")
    print()


def submit_transcription(
    base_url: str,
    audio_url: str,
    title: str = "",
    podcast: str = ""
) -> dict:
    """Submit a transcription request."""
    url = urljoin(base_url + "/", "api/test/transcribe")

    payload = {
        "audioUrl": audio_url,
    }
    if title:
        payload["episodeTitle"] = title
    if podcast:
        payload["podcastName"] = podcast

    print("📤 Submitting transcription request...")
    print(f"   POST {url}")

    try:
        response = requests.post(
            url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        response.raise_for_status()
        data = response.json()

        print("✅ Transcription started!")
        print(f"   - Transcription ID: {data['transcriptionId']}")
        print(f"   - Task ID: {data['taskId']}")
        print()

        return data

    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to submit transcription: {e}")
        if hasattr(e, 'response') and e.response is not None:
            try:
                error_data = e.response.json()
                print(f"   Error: {error_data.get('error', 'Unknown error')}")
            except:
                print(f"   Status: {e.response.status_code}")
        sys.exit(1)


def check_transcription_status(base_url: str, transcription_id: str) -> dict:
    """Check the status of a transcription."""
    url = urljoin(base_url + "/", f"api/transcriptions/{transcription_id}")

    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to check status: {e}")
        sys.exit(1)


def poll_transcription(
    base_url: str,
    transcription_id: str,
    timeout: int = 600,
    poll_interval: int = 5
) -> dict:
    """Poll for transcription status until complete or failed."""
    print(f"⏳ Polling for status (every {poll_interval}s, max {timeout}s)...")
    print()

    start_time = time.time()
    last_status = None

    while time.time() - start_time < timeout:
        data = check_transcription_status(base_url, transcription_id)
        transcription = data.get("transcription", {})
        status = transcription.get("status", "unknown")

        elapsed = int(time.time() - start_time)
        timestamp = f"[{elapsed:02d}:{elapsed//60:02d}]"

        if status != last_status:
            if status == "completed":
                print(f"   {timestamp} Status: {status} ✅")
            elif status == "failed":
                print(f"   {timestamp} Status: {status} ❌")
            elif status == "processing":
                print(f"   {timestamp} Status: {status} 🔄")
            else:
                print(f"   {timestamp} Status: {status} ⏳")
            last_status = status

        if status == "completed":
            print()
            return transcription
        elif status == "failed":
            print()
            error_msg = transcription.get("error_message", "Unknown error")
            print(f"❌ Transcription failed: {error_msg}")
            sys.exit(1)

        time.sleep(poll_interval)

    print()
    print(f"❌ Timeout after {timeout} seconds")
    sys.exit(1)


def print_result(transcription: dict, args: argparse.Namespace):
    """Print the transcription result."""
    text = transcription.get("text", "")
    episode = transcription.get("episode", {})

    print("📝 Transcription Result:")
    print("-" * 50)

    if text:
        # Print first 500 characters
        preview = text[:500]
        if len(text) > 500:
            preview += "..."
        print(preview)
    else:
        print("(No text content)")

    print("-" * 50)
    print()

    # Stats
    char_count = len(text) if text else 0
    word_count = len(text.split()) if text else 0

    print("📊 Stats:")
    print(f"   - Characters: {char_count:,}")
    print(f"   - Words: {word_count:,}")
    print()

    # Save to file if requested
    if args.output:
        output_file = args.output
    else:
        # Generate filename from transcription ID
        timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
        output_file = f"transcription-{transcription['id'][:8]}-{timestamp}.txt"

    with open(output_file, "w", encoding="utf-8") as f:
        f.write(f"Episode: {episode.get('title', 'Unknown')}\n")
        f.write(f"Podcast: {episode.get('podcast', {}).get('title', 'Unknown')}\n")
        f.write(f"Transcription ID: {transcription['id']}\n")
        f.write(f"Created: {transcription.get('created_at', 'Unknown')}\n")
        f.write("=" * 50 + "\n\n")
        f.write(text or "")

    print(f"💾 Saved to: {output_file}")


def main():
    """Main entry point."""
    args = parse_args()

    print_header()
    print_config(args)

    # Validate arguments
    if args.check:
        if not args.transcription_id:
            print("❌ Error: --transcription-id is required when using --check")
            sys.exit(1)

        # Just check status
        transcription = poll_transcription(
            args.base_url,
            args.transcription_id,
            args.timeout,
            args.poll_interval
        )
        print_result(transcription, args)
    else:
        if not args.url:
            print("❌ Error: --url is required (or use --check with --transcription-id)")
            sys.exit(1)

        # Submit new transcription
        result = submit_transcription(
            args.base_url,
            args.url,
            args.title,
            args.podcast
        )

        transcription_id = result["transcriptionId"]

        # Poll for completion
        transcription = poll_transcription(
            args.base_url,
            transcription_id,
            args.timeout,
            args.poll_interval
        )

        print_result(transcription, args)

    print()
    print("✨ Done!")


if __name__ == "__main__":
    main()
