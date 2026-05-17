# YouTube Playlist Downloader

A Deno-powered web app that fetches YouTube playlists via the YouTube Data API v3, downloads each video as an MP3 using `yt-dlp`, and tracks progress via a persistent JSON state file. The frontend is a vanilla JS SPA served directly by the Deno server.

## Technologies

- **[Deno](https://deno.com)** — HTTP server, TypeScript runtime, file I/O
- **[yt-dlp](https://github.com/yt-dlp/yt-dlp)** — Audio extraction (YouTube → MP3)
- **[YouTube Data API v3](https://developers.google.com/youtube/v3)** — Playlist metadata
- **Vanilla HTML/CSS/JS** — SPA frontend (no framework)

## How it works

1. You paste a YouTube playlist URL into the web UI and click **Add Playlist**.
2. The server calls the YouTube Data API to fetch all videos in the playlist and saves them to `playlists.json`.
3. Click **Download All** — the server runs `yt-dlp -x --audio-format mp3` for each undownloaded video, saving MP3s to `~/Downloads/`.
4. The `downloaded` boolean in `playlists.json` is set to `true` after each successful download.
5. You can also toggle the downloaded state manually, reset an entire playlist, or delete a playlist.
6. Private and deleted videos are detected automatically from the YouTube API response and marked with `"status": "private"` or `"status": "deleted"` — they are grayed out in the UI, skipped during download, and cannot be toggled.

## Project structure

```
youtube/
├── deno.json          # Task definitions
├── server.ts          # HTTP server (API + static frontend)
├── youtube.ts         # YouTube Data API v3 helpers
├── downloader.ts      # yt-dlp wrapper + JSON state management
├── index.html         # SPA frontend
├── playlists.json     # Persistent state (auto-created)
├── ytdl.sh            # Convenience launcher script
└── .env               # Your YouTube API key (ignored by git)
```

## Setup

### 1. Get a YouTube Data API key

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Go to **APIs & Services** → **Library**
4. Search for **YouTube Data API v3** and click **Enable**
5. Go to **Credentials** → **Create Credentials** → **API Key**
6. (Recommended) Restrict the key to YouTube Data API v3 only
7. Copy the key

### 2. Configure the API key

```bash
cd ~/coding/youtube
echo 'YOUTUBE_API_KEY=AIzaSy...' > .env
```

The `.env` file is loaded automatically at startup (via the `--env-file` flag).

### 3. Run the server

```bash
./ytdl.sh
# or
deno task start
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serves the SPA frontend |
| `GET` | `/api/playlists` | List all playlists with video statuses |
| `POST` | `/api/playlists` | Add a new playlist — body: `{ "url": "..." }` |
| `POST` | `/api/playlists/:id/download` | Download all undownloaded videos in a playlist |
| `DELETE` | `/api/playlists/:id` | Delete a playlist |
| `PATCH` | `/api/playlists/:id/videos` | Update all videos — body: `{ "downloaded": true/false }` |
| `PATCH` | `/api/playlists/:id/videos/:videoId` | Toggle a single video's downloaded state (returns 400 for unavailable videos) |

## Example

Add a public playlist using `curl`:

```bash
curl -X POST http://localhost:8000/api/playlists \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"}'
```

Response (videos with `"status"` omitted are available; private/deleted videos are flagged):

```json
{
  "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "title": "Select Lectures",
  "url": "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "videos": [
    { "videoId": "0VH1Lim8gL8", "title": "Deep Learning State of the Art (2020)", "downloaded": false },
    { "videoId": "O5xeyoRL95U", "title": "Deep Learning Basics: Introduction and Overview", "downloaded": false }
  ]
}
```

A playlist containing unavailable videos will include the `status` field:

```json
{
  "id": "PLYn1ziFYjknf1b2hIM9I0739K6L_YiSlC",
  "title": "Children's class",
  "videos": [
    { "videoId": "xkeNAqvwQeA", "title": "Private video", "downloaded": false, "status": "private" },
    { "videoId": "sFjycoXZPMI", "title": "Deleted video", "downloaded": false, "status": "deleted" }
  ]
}
```

Download all videos in that playlist:

```bash
curl -X POST http://localhost:8000/api/playlists/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/download
```

List all playlists:

```bash
curl http://localhost:8000/api/playlists
```

Toggle a single video's download status back to not-downloaded:

```bash
curl -X PATCH http://localhost:8000/api/playlists/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/videos/0VH1Lim8gL8
```

Trying to toggle a private or deleted video returns an error and is ignored by the UI:

```bash
curl -X PATCH http://localhost:8000/api/playlists/PLYn1ziFYjknf1b2hIM9I0739K6L_YiSlC/videos/xkeNAqvwQeA
# → 400 Cannot toggle unavailable video
```

Reset all videos in a playlist:

```bash
curl -X PATCH http://localhost:8000/api/playlists/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/videos \
  -H "Content-Type: application/json" \
  -d '{"downloaded": false}'
```

Delete a playlist:

```bash
curl -X DELETE http://localhost:8000/api/playlists/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf
```

## Permissions

The Deno server requires these permissions:

| Flag | Purpose |
|------|---------|
| `--allow-net` | HTTP server + YouTube API calls |
| `--allow-env` | Read `YOUTUBE_API_KEY` and `HOME` |
| `--allow-read` | Read `playlists.json`, `index.html` |
| `--allow-write` | Write `playlists.json` |
| `--allow-run` | Spawn `yt-dlp` subprocess |
| `--env-file` | Load `.env` file |
