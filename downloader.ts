export type VideoStatus = "available" | "private" | "deleted";

export interface VideoEntry {
  videoId: string;
  title: string;
  downloaded: boolean;
  status?: VideoStatus;
}

export function isAvailable(v: VideoEntry): boolean {
  return !v.status || v.status === "available";
}

export interface PlaylistEntry {
  id: string;
  title: string;
  url: string;
  videos: VideoEntry[];
}

const STATE_FILE = "playlists.json";

export function sanitizeFilename(s: string): string {
  return s
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/[-_]{2,}/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");
}

export function buildFilename(
  playlistTitle: string,
  videoTitle: string,
  videoId: string,
  index: number,
): string {
  const p = sanitizeFilename(playlistTitle);
  const t = sanitizeFilename(videoTitle);
  const i = String(index + 1).padStart(3, "0");
  return `${p}_${i}_${t}_${videoId}.%(ext)s`;
}

export async function loadState(): Promise<PlaylistEntry[]> {
  try {
    return JSON.parse(await Deno.readTextFile(STATE_FILE));
  } catch {
    return [];
  }
}

export async function saveState(
  playlists: PlaylistEntry[],
): Promise<void> {
  await Deno.writeTextFile(STATE_FILE, JSON.stringify(playlists, null, 2));
}

export async function downloadVideo(
  videoId: string,
  title: string,
  playlistTitle: string,
  index: number,
): Promise<boolean> {
  const downloadsDir = `${Deno.env.get("HOME")}/Downloads`;
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const outputName = buildFilename(playlistTitle, title, videoId, index);
  const outputPath = `${downloadsDir}/${outputName}`;

  const cmd = new Deno.Command("yt-dlp", {
    args: [
      "-x",
      "--audio-format",
      "mp3",
      "-o",
      outputPath,
      "--no-playlist",
      "--embed-thumbnail",
      url,
    ],
    stdout: "inherit",
    stderr: "inherit",
  });

  try {
    const { success } = await cmd.output();
    return success;
  } catch (e) {
    console.error(`Download failed for ${title}:`, e);
    return false;
  }
}
