import fs from "fs";
import path from "path";
import { removeUploads, uploadsDir } from "../middleware/upload";
import { env } from "../config/env";
import { log } from "../utils/logger";

/**
 * Media-team publisher: service photos/videos -> church social pages.
 *
 * Facebook: photos + videos via the Page token (same token the blog
 * sync uses, but publishing needs a token granted the publish_pages /
 * pages_manage_posts permission — see .env.example).
 * Instagram: photo + reels publishing via the Content Publishing API.
 * Needs an Instagram Business/Creator account linked to the Page
 * (INSTAGRAM_BUSINESS_ID), public file URLs and a token with
 * instagram_content_publish. Local dev (localhost) cannot serve the
 * file bytes to Meta — publishing works once the backend has a public
 * URL (YOUR_APP_URL, e.g. Render).
 * TikTok: Content Posting API DIRECT_POST. Needs a TikTok developer app
 * that passed audit + video.upload scope (TIKTOK_ACCESS_TOKEN).
 * Until then the target reports "not connected" instead of failing.
 */

export interface PublishTargetResult {
  ok: boolean;
  id?: string;
  url?: string;
  error?: string;
  message?: string;
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm"]);

const graph = (p: string) =>
  `https://graph.facebook.com/${env.facebook.graphVersion}${p}`;

async function readGraph(res: Response): Promise<{ data: unknown }> {
  const data = (await res.json()) as {
    id?: string;
    post_id?: string;
    error?: { message: string; code: number };
  };
  if (!res.ok || data.error) {
    throw new Error(
      `Facebook error${data.error ? ` ${data.error.code}` : ` ${res.status}`}: ${
        data.error?.message ?? res.statusText
      }`
    );
  }
  return { data };
}

async function postForm(
  url: string,
  fields: Record<string, string>,
  file?: { field: string; path: string; name: string; type: string }
): Promise<{ id?: string; post_id?: string }> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (file) {
    const buf = fs.readFileSync(file.path);
    form.append(file.field, new Blob([buf], { type: file.type }), file.name);
  }
  const res = await fetch(url, { method: "POST", body: form });
  const { data } = await readGraph(res);
  return data as { id?: string; post_id?: string };
}

/* ------------------------------- Facebook ------------------------------ */

function facebookReady(): boolean {
  return Boolean(env.facebook.pageId && env.facebook.pageAccessToken);
}

async function publishPhotosToFacebook(
  caption: string,
  images: string[]
): Promise<PublishTargetResult> {
  const token = env.facebook.pageAccessToken;
  const page = env.facebook.pageId;
  try {
    if (images.length === 1) {
      const r = await postForm(
        graph(`/${page}/photos`),
        { caption, published: "true", access_token: token },
        { field: "source", path: images[0], name: path.basename(images[0]), type: "image/jpeg" }
      );
      return {
        ok: true,
        id: r.id ?? r.post_id,
        url: r.post_id ? `https://www.facebook.com/${r.post_id}` : undefined,
      };
    }
    // Album-style post: upload unpublished, then attach to one feed post.
    const ids: string[] = [];
    for (const img of images) {
      const r = await postForm(
        graph(`/${page}/photos`),
        { caption, published: "false", access_token: token },
        { field: "source", path: img, name: path.basename(img), type: "image/jpeg" }
      );
      if (r.id) ids.push(r.id);
    }
    if (ids.length === 0) throw new Error("Photo upload returned no ids.");
    const params = new URLSearchParams({ message: caption, access_token: token });
    ids.forEach((id, i) => params.append(`attached_media[${i}]`, JSON.stringify({ media_fbid: id })));
    const res = await fetch(graph(`/${page}/feed`), { method: "POST", body: params });
    const { data } = await readGraph(res);
    const pid = (data as { id?: string }).id;
    return {
      ok: true,
      id: pid,
      url: pid ? `https://www.facebook.com/${pid}` : undefined,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function publishVideoToFacebook(
  caption: string,
  video: string
): Promise<PublishTargetResult> {
  const token = env.facebook.pageAccessToken;
  const page = env.facebook.pageId;
  try {
    const r = await postForm(
      graph(`/${page}/videos`),
      { description: caption, access_token: token },
      { field: "source", path: video, name: path.basename(video), type: "video/mp4" }
    );
    return { ok: true, id: r.id };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/* ------------------------------- Instagram ----------------------------- */

function instagramReady(): boolean {
  return Boolean(env.instagram.businessId);
}

async function igCall(
  endpoint: string,
  params: Record<string, string>
): Promise<Record<string, unknown>> {
  const url = `${graph(endpoint)}?${new URLSearchParams({
    ...params,
    access_token: env.instagram.accessToken,
  })}`;
  const res = await fetch(url, { method: "POST" });
  const data = (await res.json()) as {
    id?: string;
    error?: { message: string; code: number };
  };
  if (!res.ok || data.error) {
    throw new Error(
      `Instagram error${data.error ? ` ${data.error.code}` : ` ${res.status}`}: ${
        data.error?.message ?? res.statusText
      }`
    );
  }
  return data as Record<string, unknown>;
}

async function igWaitReady(containerId: string): Promise<void> {
  // Reels/photo containers encode asynchronously — poll for FINISHED.
  for (let i = 0; i < 20; i++) {
    const url = `${graph(`/${containerId}`)}?${new URLSearchParams({
      fields: "status_code",
      access_token: env.instagram.accessToken,
    })}`;
    const res = await fetch(url);
    const data = (await res.json()) as { status_code?: string };
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("Instagram failed to process the media.");
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Instagram took too long to process the media — try publishing again.");
}

async function publishToInstagram(
  caption: string,
  publicFiles: { url: string; video: boolean }[]
): Promise<PublishTargetResult> {
  if (!instagramReady()) {
    return {
      ok: false,
      message:
        "Instagram is not connected. Link the church Instagram Business account to the Facebook Page and set INSTAGRAM_BUSINESS_ID (see backend .env.example).",
    };
  }
  try {
    const ig = env.instagram.businessId;
    const first = publicFiles[0];
    const container = (await igCall(`/${ig}/media`, {
      ...(first.video
        ? { media_type: "REELS", video_url: first.url }
        : { image_url: first.url }),
      caption,
    })) as { id?: string };
    if (!container.id) throw new Error("Instagram returned no container id.");
    await igWaitReady(container.id);
    const published = (await igCall(`/${ig}/media_publish`, {
      creation_id: container.id,
    })) as { id?: string };
    return { ok: true, id: published.id };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/* -------------------------------- TikTok --------------------------------- */

function tiktokReady(): boolean {
  return Boolean(env.tiktok.accessToken);
}

async function publishToTikTok(
  caption: string,
  videoPath: string
): Promise<PublishTargetResult> {
  if (!tiktokReady()) {
    return {
      ok: false,
      message:
        "TikTok is not connected. Create a TikTok developer app, pass Content Posting API audit (video.upload scope) and set TIKTOK_ACCESS_TOKEN (see backend .env.example).",
    };
  }
  try {
    const stat = fs.statSync(videoPath);
    const token = env.tiktok.accessToken;
    // 1) Init upload (single chunk for files under the size limit).
    const initRes = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        source: "FILE_UPLOAD",
        video_size: stat.size,
        chunk_size: stat.size,
        total_chunk_count: 1,
      }),
    });
    const init = (await initRes.json()) as {
      error?: { code: string; message: string };
      data?: { upload_url?: string; publish_id?: string };
    };
    if (!initRes.ok || init.error?.code !== "ok" || !init.data?.upload_url) {
      throw new Error(`TikTok init failed: ${init.error?.message ?? initRes.statusText}`);
    }
    // 2) Upload bytes.
    const buf = fs.readFileSync(videoPath);
    const upRes = await fetch(init.data.upload_url, {
      method: "PUT",
      headers: { "Content-Type": "video/mp4", "Content-Length": String(buf.length) },
      body: buf,
    });
    if (!upRes.ok) throw new Error(`TikTok upload failed: ${upRes.statusText}`);
    // 3) Publish as a direct post.
    const pubRes = await fetch("https://open.tiktokapis.com/v2/post/publish/video/init/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: { title: caption.slice(0, 2200), privacy_level: "SELF_ONLY" },
        source_info: {
          source: "FILE_UPLOAD",
          video_size: stat.size,
          chunk_size: stat.size,
          total_chunk_count: 1,
        },
        post_mode: "DIRECT_POST",
      }),
    });
    const pub = (await pubRes.json()) as {
      error?: { code: string; message: string };
      data?: { publish_id?: string };
    };
    if (!pubRes.ok || pub.error?.code !== "ok") {
      throw new Error(`TikTok publish failed: ${pub.error?.message ?? pubRes.statusText}`);
    }
    return { ok: true, id: pub.data?.publish_id ?? init.data.publish_id };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

/* --------------------------------- entry --------------------------------- */

export interface MediaPublishInput {
  caption: string;
  filenames: string[];
  targets: ("facebook" | "instagram" | "tiktok")[];
}

export async function publishMedia(input: MediaPublishInput): Promise<{
  files: string[];
  results: Record<string, PublishTargetResult>;
}> {
  const localPaths = input.filenames.map((f) => path.join(uploadsDir, path.basename(f)));
  const publicPaths = input.filenames.map(
    (f) => `${env.appUrl.replace(/\/$/, "")}/uploads/${path.basename(f)}`
  );
  const images = localPaths.filter((p) => IMAGE_EXT.has(path.extname(p).toLowerCase()));
  const videos = localPaths.filter((p) => VIDEO_EXT.has(path.extname(p).toLowerCase()));
  const results: Record<string, PublishTargetResult> = {};

  for (const target of input.targets) {
    if (target === "facebook") {
      if (!facebookReady()) {
        results.facebook = {
          ok: false,
          message:
            "Facebook publishing is not configured — the Page token needs the publish permission (see backend .env.example).",
        };
        continue;
      }
      if (videos.length > 0) {
        results.facebook = await publishVideoToFacebook(input.caption, videos[0]);
      } else if (images.length > 0) {
        results.facebook = await publishPhotosToFacebook(input.caption, images);
      } else {
        results.facebook = { ok: false, message: "No images to publish." };
      }
      log(`Media->Facebook ok=${results.facebook.ok}`, "media-publish");
    } else if (target === "instagram") {
      const firstVideo = videos[0];
      const firstImage = images[0];
      const pick = firstVideo ?? firstImage;
      if (!pick) {
        results.instagram = { ok: false, message: "Instagram needs at least one photo or reel." };
        continue;
      }
      // Instagram pulls the bytes from our public URL, so publish BEFORE cleanup.
      results.instagram = await publishToInstagram(input.caption, [
        { url: publicPaths[localPaths.indexOf(pick)], video: Boolean(firstVideo) },
      ]);
      log(`Media->Instagram ok=${results.instagram.ok}`, "media-publish");
    } else if (target === "tiktok") {
      if (videos.length === 0) {
        results.tiktok = { ok: false, message: "TikTok needs a video file (MP4/MOV)." };
        continue;
      }
      results.tiktok = await publishToTikTok(input.caption, videos[0]);
      log(`Media->TikTok ok=${results.tiktok.ok}`, "media-publish");
    }
  }

  // Media files are transit copies only — never stored. Forward, then wipe.
  removeUploads(localPaths.map((p) => `/uploads/${path.basename(p)}`));

  return {
    files: input.filenames.map((f) => `/uploads/${path.basename(f)}`),
    results,
  };
}

export const mediaService = { publishMedia, facebookReady, instagramReady, tiktokReady };
