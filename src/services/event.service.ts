import type { Event as PrismaEvent } from "@prisma/client";
import { prisma } from "../config/prisma";
import { removeUploads } from "../middleware/upload";
import type { InsertEvent, UpdateEvent } from "../validators/schemas";

function resolveImageUrl(
  inputUrl: string | undefined,
  images: string[],
  existingUrl: string | null
): string | null {
  if (images.length > 0) {
    return existingUrl && images.includes(existingUrl) ? existingUrl : images[0];
  }
  return inputUrl ?? existingUrl;
}

export const eventService = {
  async list() {
    return prisma.event.findMany({ orderBy: { createdAt: "desc" } });
  },

  async getById(id: string) {
    return prisma.event.findUnique({ where: { id } });
  },

  async create(input: InsertEvent, images: string[] = []): Promise<PrismaEvent> {
    const imageUrl = input.imageUrl ?? images[0] ?? null;
    return prisma.event.create({ data: { ...input, images, imageUrl } });
  },

  async update(
    id: string,
    input: UpdateEvent,
    images?: string[]
  ): Promise<PrismaEvent | null> {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return null;
    const nextImages = images ?? existing.images;
    const removed = existing.images.filter((u) => !nextImages.includes(u));
    if (removed.length > 0) removeUploads(removed);
    return prisma.event.update({
      where: { id },
      data: {
        ...input,
        images: nextImages,
        imageUrl: resolveImageUrl(input.imageUrl, nextImages, existing.imageUrl),
      },
    });
  },

  async remove(id: string): Promise<boolean> {
    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return false;
    await prisma.event.delete({ where: { id } });
    removeUploads(existing.images);
    return true;
  },
};
