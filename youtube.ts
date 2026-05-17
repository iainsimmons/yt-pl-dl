const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface PlaylistItem {
  videoId: string;
  title: string;
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
      items.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
      });
    }

    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return items;
}
