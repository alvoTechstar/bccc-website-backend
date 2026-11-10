import type { BlogPost as PrismaBlogPost } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { InsertBlogPost } from "../validators/schemas";

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

  async create(data: InsertBlogPost) {
    const post = await prisma.blogPost.create({ data });
    return toDTO(post);
  },
};
