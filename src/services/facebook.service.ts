import axios from "axios";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { log } from "../utils/logger";

interface FacebookPost {
  id: string;
  message?: string;
  story?: string;
  created_time?: string;
  full_picture?: string;
  permalink_url?: string;
}

interface FacebookFeedResponse {
  data?: FacebookPost[];
  paging?: { next?: string };
  error?: { message: string; type: string; code: number };
}

const DEFAULT_CATEGORY = "Church News";
const DEFAULT_AUTHOR = "BCC Church";

function isConfigured(): boolean {
  return Boolean(env.facebook.pageId && env.facebook.pageAccessToken);
}

function excerptOf(text: string, max = 180): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > max ? `${singleLine.slice(0, max).trimEnd()}…` : singleLine;
}

function titleOf(text: string): string {
  const firstLine = text.split("\n")[0]?.trim() ?? "";
  if (!firstLine) return "Update from BCC Church";
  return firstLine.length > 90 ? `${firstLine.slice(0, 90).trimEnd()}…` : firstLine;
}

async function fetchPagePosts(limit = 25): Promise<FacebookPost[]> {
  const { pageId, pageAccessToken, graphVersion } = env.facebook;
  const url = `https://graph.facebook.com/${graphVersion}/${pageId}/posts`;
  const res = await axios.get<FacebookFeedResponse>(url, {
    params: {
      fields: "id,message,story,created_time,full_picture,permalink_url",
      limit,
      access_token: pageAccessToken,
    },
    timeout: 15000,
  });
  if (res.data.error) {
    throw new Error(`Facebook Graph API error: ${res.data.error.message}`);
  }
  return res.data.data ?? [];
}

/**
 * Pull the latest church Facebook page posts into blog_posts.
 * Idempotent: matches on facebookPostId, updates existing rows in place
 * (message edits / new images flow through), inserts the rest.
 */
export async function syncFacebookPosts(limit = 25): Promise<{
  fetched: number;
  created: number;
  updated: number;
}> {
  if (!isConfigured()) {
    throw new Error(
      "Facebook sync is not configured. Set FACEBOOK_PAGE_ID and FACEBOOK_PAGE_ACCESS_TOKEN."
    );
  }

  const posts = await fetchPagePosts(limit);
  let created = 0;
  let updated = 0;

  for (const fp of posts) {
    const text = (fp.message ?? fp.story ?? "").trim();
    if (!text) continue; // skip photo-only posts with no text at all

    const data = {
      title: titleOf(text),
      content: text,
      excerpt: excerptOf(text),
      category: DEFAULT_CATEGORY,
      author: DEFAULT_AUTHOR,
      imageUrl: fp.full_picture ?? null,
      published: true,
      source: "facebook",
      sourceUrl: fp.permalink_url ?? `https://www.facebook.com/${fp.id}`,
      createdAt: fp.created_time ? new Date(fp.created_time) : undefined,
    };

    const existing = await prisma.blogPost.findUnique({
      where: { facebookPostId: fp.id },
    });
    if (existing) {
      await prisma.blogPost.update({
        where: { facebookPostId: fp.id },
        data: { ...data, createdAt: undefined }, // keep original publish date
      });
      updated++;
    } else {
      await prisma.blogPost.create({
        data: {
          ...data,
          createdAt: data.createdAt ?? new Date(),
          facebookPostId: fp.id,
        },
      });
      created++;
    }
  }

  log(
    `Facebook sync complete: fetched=${posts.length} created=${created} updated=${updated}`,
    "facebook-sync"
  );
  return { fetched: posts.length, created, updated };
}

export const facebookService = { isConfigured, syncFacebookPosts };
