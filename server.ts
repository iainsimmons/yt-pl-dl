import { extractPlaylistId, fetchPlaylistItems, fetchPlaylistTitle } from "./youtube.ts";
import {
  downloadVideo,
  isAvailable,
  loadState,
  saveState,
  type PlaylistEntry,
} from "./downloader.ts";

const PORT = parseInt(Deno.env.get("PORT") || "8000");
const API_KEY = Deno.env.get("YOUTUBE_API_KEY") || "";

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const { pathname } = url;
  const { method } = req;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (pathname === "/api/playlists") {
      if (method === "GET") {
        return Response.json(await loadState(), { headers: corsHeaders });
      }
      if (method === "POST") {
        const { url: playlistUrl } = await req.json();
        return await addPlaylist(playlistUrl, corsHeaders);
      }
    }

    const downloadMatch = pathname.match(
      /^\/api\/playlists\/([^/]+)\/download$/,
    );
    if (downloadMatch && method === "POST") {
      return await downloadPlaylist(downloadMatch[1], corsHeaders);
    }

    const deleteMatch = pathname.match(/^\/api\/playlists\/([^/]+)$/);
    if (deleteMatch && method === "DELETE") {
      return await deletePlaylist(deleteMatch[1], corsHeaders);
    }

    const allVideosMatch = pathname.match(
      /^\/api\/playlists\/([^/]+)\/videos$/,
    );
    if (allVideosMatch && method === "PATCH") {
      const { downloaded } = await req.json();
      return await updateAllVideos(allVideosMatch[1], downloaded, corsHeaders);
    }

    const singleVideoMatch = pathname.match(
      /^\/api\/playlists\/([^/]+)\/videos\/([^/]+)$/,
    );
    if (singleVideoMatch && method === "PATCH") {
      return await toggleVideo(
        singleVideoMatch[1],
        singleVideoMatch[2],
        corsHeaders,
      );
    }

    if (pathname === "/") {
      return await serveFile("index.html", "text/html");
    }

    return new Response("Not found", { status: 404 });
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500, headers: corsHeaders });
  }
}

async function addPlaylist(
  playlistUrl: string,
  headers: Record<string, string>,
): Promise<Response> {
  if (!API_KEY) {
    return new Response("Set YOUTUBE_API_KEY environment variable", {
      status: 500,
      headers,
    });
  }

  const playlistId = extractPlaylistId(playlistUrl);
  if (!playlistId) {
    return new Response("Invalid YouTube playlist URL", {
      status: 400,
      headers,
    });
  }

  const [items, playlistTitle] = await Promise.all([
    fetchPlaylistItems(playlistId, API_KEY),
    fetchPlaylistTitle(playlistId, API_KEY),
  ]);

  const playlists = await loadState();

  if (playlists.some((p) => p.id === playlistId)) {
    return new Response("Playlist already added", {
      status: 409,
      headers,
    });
  }

  const entry: PlaylistEntry = {
    id: playlistId,
    title: playlistTitle,
    url: playlistUrl,
    videos: items.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      downloaded: false,
      status: v.status === "available" ? undefined : v.status,
    })),
  };

  playlists.push(entry);
  await saveState(playlists);

  return Response.json(entry, { status: 201, headers });
}

async function downloadPlaylist(
  playlistId: string,
  headers: Record<string, string>,
): Promise<Response> {
  const playlists = await loadState();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) {
    return new Response("Playlist not found", { status: 404, headers });
  }

  const pending = playlist.videos.filter(
    (v) => !v.downloaded && isAvailable(v),
  );
  const results: Array<{
    videoId: string;
    title: string;
    success: boolean;
  }> = [];

  for (const video of pending) {
    console.log(`Downloading: ${video.title}`);
    const success = await downloadVideo(video.videoId, video.title);
    video.downloaded = success;
    results.push({ videoId: video.videoId, title: video.title, success });
    await saveState(playlists);
  }

  console.log(`Skipped ${playlist.videos.length - pending.length - results.length} unavailable videos`);

  return Response.json({ playlistId, results }, { headers });
}

async function deletePlaylist(
  playlistId: string,
  headers: Record<string, string>,
): Promise<Response> {
  let playlists = await loadState();
  const idx = playlists.findIndex((p) => p.id === playlistId);
  if (idx === -1) {
    return new Response("Playlist not found", { status: 404, headers });
  }
  playlists.splice(idx, 1);
  await saveState(playlists);
  return new Response(null, { status: 204, headers });
}

async function updateAllVideos(
  playlistId: string,
  downloaded: boolean,
  headers: Record<string, string>,
): Promise<Response> {
  const playlists = await loadState();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) {
    return new Response("Playlist not found", { status: 404, headers });
  }
  for (const video of playlist.videos) {
    if (isAvailable(video)) video.downloaded = downloaded;
  }
  await saveState(playlists);
  return Response.json(playlist, { headers });
}

async function toggleVideo(
  playlistId: string,
  videoId: string,
  headers: Record<string, string>,
): Promise<Response> {
  const playlists = await loadState();
  const playlist = playlists.find((p) => p.id === playlistId);
  if (!playlist) {
    return new Response("Playlist not found", { status: 404, headers });
  }
  const video = playlist.videos.find((v) => v.videoId === videoId);
  if (!video) {
    return new Response("Video not found", { status: 404, headers });
  }
  if (!isAvailable(video)) {
    return new Response("Cannot toggle unavailable video", {
      status: 400,
      headers,
    });
  }
  video.downloaded = !video.downloaded;
  await saveState(playlists);
  return Response.json(video, { headers });
}

async function serveFile(
  filename: string,
  contentType: string,
): Promise<Response> {
  try {
    const content = await Deno.readTextFile(filename);
    return new Response(content, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return new Response("File not found", { status: 404 });
  }
}

Deno.serve({ port: PORT }, handler);
