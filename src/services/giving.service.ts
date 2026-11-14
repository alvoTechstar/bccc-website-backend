import type { GivingRecord as PrismaGivingRecord } from "@prisma/client";
import { prisma } from "../config/prisma";
import type { InsertGivingRecord } from "../validators/schemas";

function toDTO(record: PrismaGivingRecord) {
  return { ...record, amount: Number(record.amount) };
}

export type GivingRecordDTO = ReturnType<typeof toDTO>;

export const givingService = {
  async create(data: InsertGivingRecord): Promise<GivingRecordDTO> {
    const record = await prisma.givingRecord.create({
      data: {
        amount: data.amount,
        givingType: data.givingType,
        name: data.name,
        phoneNumber: data.phoneNumber,
        email: data.email,
        message: data.message,
      },
    });
    return toDTO(record);
  },

  async list(): Promise<GivingRecordDTO[]> {
    const records = await prisma.givingRecord.findMany({
      orderBy: { createdAt: "desc" },
    });
    return records.map(toDTO);
  },

  async getById(id: string): Promise<GivingRecordDTO | undefined> {
    const record = await prisma.givingRecord.findUnique({ where: { id } });
    return record ? toDTO(record) : undefined;
  },

  async getByCheckoutRequestId(
    checkoutRequestId: string
  ): Promise<GivingRecordDTO | undefined> {
    const record = await prisma.givingRecord.findUnique({
      where: { checkoutRequestId },
    });
    return record ? toDTO(record) : undefined;
  },

  async updateStatus(
    id: string,
    status: string,
    transactionId?: string,
    checkoutRequestId?: string
  ): Promise<GivingRecordDTO | undefined> {
    const record = await prisma.givingRecord.update({
      where: { id },
      data: {
        status,
        ...(transactionId ? { transactionId } : {}),
        ...(checkoutRequestId ? { checkoutRequestId } : {}),
      },
    });
    return toDTO(record);
  },
};
