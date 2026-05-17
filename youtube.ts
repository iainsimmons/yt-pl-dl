const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export type VideoStatus = "available" | "private" | "deleted";

export interface PlaylistItem {
  videoId: string;
  title: string;
  status: VideoStatus;
}

function detectStatus(title: string): VideoStatus {
  if (title === "Private video") return "private";
  if (title === "Deleted video") return "deleted";
  return "available";
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([^&]+)/);
  return match ? match[1] : null;
}

export async function fetchPlaylistTitle(
  playlistId: string,
  apiKey: string,
): Promise<string> {
  const params = new URLSearchParams({
    part: "snippet",
    id: playlistId,
    key: apiKey,
  });
  const res = await fetch(`${YOUTUBE_API_BASE}/playlists?${params}`);
  if (!res.ok) return playlistId;
  const data = await res.json();
  return data.items?.[0]?.snippet?.title ?? playlistId;
}

export async function fetchPlaylistItems(
  playlistId: string,
  apiKey: string,
): Promise<PlaylistItem[]> {
  const items: PlaylistItem[] = [];
  let pageToken: string | undefined;

  while (true) {
    const params = new URLSearchParams({
      part: "snippet",
      playlistId,
      maxResults: "50",
      key: apiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params}`);
    if (!res.ok) {
      throw new Error(`YouTube API ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    for (const item of data.items ?? []) {
      const title = item.snippet.title;
      items.push({
        videoId: item.snippet.resourceId.videoId,
        title,
        status: detectStatus(title),
      });
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return items;
}
