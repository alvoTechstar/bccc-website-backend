import { prisma } from "../config/prisma";
import type { InsertNewsletterSubscriber } from "../validators/schemas";

export const newsletterService = {
  /** Idempotent subscribe: returns { subscriber, created }. */
  async subscribe(data: InsertNewsletterSubscriber) {
    const email = data.email.trim().toLowerCase();
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email },
    });
    if (existing) return { subscriber: existing, created: false };

    const subscriber = await prisma.newsletterSubscriber.create({
      data: {
        email,
        name: data.name,
        source: data.source ?? "website",
      },
    });
    return { subscriber, created: true };
  },

  async list() {
    return prisma.newsletterSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    });
  },
};
