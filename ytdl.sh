#!/usr/bin/env bash
#
# ytdl — YouTube Playlist Downloader
#
# Starts the Deno server that serves the SPA frontend,
# REST API, and orchestrates yt-dlp downloads.
#
# Usage:
#   ./ytdl.sh
#
# Environment:
#   YOUTUBE_API_KEY   Required. Set via .env file or environment variable.
#   PORT              Optional. Server port (default: 8000).
#
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

deno task start
