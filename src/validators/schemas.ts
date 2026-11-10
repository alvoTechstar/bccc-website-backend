import { z } from "zod";

// Keep the same public shapes as the original server so the
// frontend contract does not change.

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string(),
});

export const blogPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string(),
  category: z.string(),
  author: z.string(),
  imageUrl: z.string().optional(),
  published: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const contactMessageSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  subject: z.string(),
  message: z.string(),
  newsletter: z.boolean().default(false),
  createdAt: z.date(),
});

export const givingRecordSchema = z.object({
  id: z.string(),
  amount: z.union([z.string(), z.number()]).transform((val) => {
    if (typeof val === "string") {
      const parsed = parseFloat(val);
      if (isNaN(parsed) || parsed <= 0) {
        throw new Error("Amount must be a positive number");
      }
      return parsed;
    }
    if (val <= 0) {
      throw new Error("Amount must be a positive number");
    }
    return val;
  }),
  givingType: z.string(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  message: z.string().optional(),
  transactionId: z.string().optional(),
  status: z.string().default("pending"),
  createdAt: z.date(),
});

export const insertUserSchema = userSchema.omit({ id: true });

export const insertBlogPostSchema = blogPostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactMessageSchema = contactMessageSchema.omit({
  id: true,
  createdAt: true,
});

export const insertGivingRecordSchema = givingRecordSchema.omit({
  id: true,
  createdAt: true,
  transactionId: true,
  status: true,
});

export type User = z.infer<typeof userSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type BlogPost = z.infer<typeof blogPostSchema>;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type ContactMessage = z.infer<typeof contactMessageSchema>;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type GivingRecord = z.infer<typeof givingRecordSchema>;
export type InsertGivingRecord = z.infer<typeof insertGivingRecordSchema>;
