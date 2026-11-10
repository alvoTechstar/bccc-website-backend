import { prisma } from "../config/prisma";
import type { InsertContactMessage } from "../validators/schemas";

export const contactService = {
  async create(data: InsertContactMessage) {
    return prisma.contactMessage.create({ data });
  },

  async list() {
    return prisma.contactMessage.findMany({ orderBy: { createdAt: "desc" } });
  },
};
