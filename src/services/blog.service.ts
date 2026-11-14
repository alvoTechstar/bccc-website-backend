import type { BlogPost as PrismaBlogPost } from "@prisma/client";
import { prisma } from "../config/prisma";
import { removeUploads } from "../middleware/upload";
import type {
  InsertBlogPost,
  UpdateBlogPost,
} from "../validators/schemas";

export type BlogPostDTO = Omit<PrismaBlogPost, "imageUrl"> & { imageUrl?: string };

function toDTO(post: PrismaBlogPost): BlogPostDTO {
  return { ...post, imageUrl: post.imageUrl ?? undefined };
}

export const blogService = {
  async list(limit?: number) {
    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: "desc" },
      ...(limit && limit > 0 ? { take: limit } : {}),
    });
    return posts.map(toDTO);
  },

  async getById(id: string) {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    return post ? toDTO(post) : undefined;
  },

  async listByCategory(category: string) {
    const posts = await prisma.blogPost.findMany({
      where: { category },
      orderBy: { createdAt: "desc" },
    });
    return posts.map(toDTO);
  },

  async create(input: InsertBlogPost, images: string[] = []) {
    const imageUrl = input.imageUrl ?? images[0] ?? null;
    const post = await prisma.blogPost.create({
      data: { ...input, images, imageUrl, source: "local" },
    });
    return toDTO(post);
  },

  async update(id: string, input: UpdateBlogPost, images?: string[]) {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return undefined;
    const nextImages = images ?? existing.images;
    const removed = existing.images.filter((u) => !nextImages.includes(u));
    if (removed.length > 0) removeUploads(removed);
    const imageUrl =
      nextImages.length > 0
        ? (existing.imageUrl && nextImages.includes(existing.imageUrl)
            ? existing.imageUrl
            : nextImages[0])
        : (input.imageUrl ?? null);
    const post = await prisma.blogPost.update({
      where: { id },
      data: { ...input, images: nextImages, imageUrl },
    });
    return toDTO(post);
  },

  async remove(id: string) {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) return false;
    await prisma.blogPost.delete({ where: { id } });
    removeUploads(existing.images);
    return true;
  },
};
