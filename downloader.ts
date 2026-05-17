export type VideoStatus = "available" | "private" | "deleted" | "error";

export interface VideoEntry {
  videoId: string;
  title: string;
  downloaded: boolean;
  status?: VideoStatus;
  errorMessage?: string;
}

export function isAvailable(v: VideoEntry): boolean {
  return !v.status || v.status === "available";
}

export function canToggle(v: VideoEntry): boolean {
  return isAvailable(v) || v.status === "error";
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

export async function saveState(playlists: PlaylistEntry[]): Promise<void> {
  await Deno.writeTextFile(STATE_FILE, JSON.stringify(playlists, null, 2));
}

export async function downloadVideo(
  videoId: string,
  title: string,
  playlistTitle: string,
  index: number,
): Promise<{ success: boolean; errorMessage?: string }> {
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
    stderr: "piped",
  });

  try {
    const { success, stderr } = await cmd.output();
    if (success) return { success: true };
    const msg = new TextDecoder()
      .decode(stderr)
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("[") && !l.startsWith("WARNING"))
      .slice(-2)
      .join("; ");
    return { success: false, errorMessage: msg || "yt-dlp failed" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Download failed for ${title}:`, msg);
    return { success: false, errorMessage: msg };
  }
}
