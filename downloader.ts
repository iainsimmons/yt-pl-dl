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
): Promise<boolean> {
  const downloadsDir = `${Deno.env.get("HOME")}/Downloads`;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  const cmd = new Deno.Command("yt-dlp", {
    args: [
      "-x",
      "--audio-format",
      "mp3",
      "-o",
      `${downloadsDir}/%(title)s.%(ext)s`,
      "--no-playlist",
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
