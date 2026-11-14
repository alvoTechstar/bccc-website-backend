import { z } from "zod";

// Keep the same public shapes as the original server so the
// frontend contract does not change.

export const userSchema = z.object({
  id: z.string(),
  username: z.string(),
  password: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["superadmin", "admin"]).default("admin"),
  active: z.boolean().default(true),
  mustSetPassword: z.boolean().default(true),
});

export const blogPostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  excerpt: z.string(),
  category: z.string(),
  author: z.string(),
  imageUrl: z.string().optional(),
  // Multiple uploaded images (first doubles as the cover).
  images: z.array(z.string()).default([]),
  published: z.boolean().default(true),
  // "local" for in-house posts, "facebook" for page-synced posts.
  source: z.string().default("local"),
  sourceUrl: z.string().optional(),
  facebookPostId: z.string().optional(),
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
  name: z.string().optional(),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email("Invalid email address").optional(),
  message: z.string().optional(),
  transactionId: z.string().optional(),
  status: z.string().default("pending"),
  createdAt: z.date(),
});

export const newsletterSubscriberSchema = z.object({
  id: z.string(),
  email: z.string().email("Invalid email address"),
  name: z.string().optional(),
  source: z.string().default("website"),
  createdAt: z.date(),
});

export const insertNewsletterSubscriberSchema = newsletterSubscriberSchema.omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = userSchema.omit({ id: true });

export const insertBlogPostSchema = blogPostSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // Server-managed: set by the Facebook sync, never by clients.
  source: true,
  sourceUrl: true,
  facebookPostId: true,
});

export const updateBlogPostSchema = insertBlogPostSchema.partial();

export const eventSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string(),
  date: z.string().min(1, "Date is required"),
  time: z.string().optional(),
  venue: z.string().optional(),
  category: z.string().default("General"),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).default([]),
  published: z.boolean().default(true),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const insertEventSchema = eventSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateEventSchema = insertEventSchema.partial();

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
export type UpdateBlogPost = z.infer<typeof updateBlogPostSchema>;
export type ChurchEvent = z.infer<typeof eventSchema>;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
export type ContactMessage = z.infer<typeof contactMessageSchema>;
export type InsertContactMessage = z.infer<typeof insertContactMessageSchema>;
export type GivingRecord = z.infer<typeof givingRecordSchema>;
export type InsertGivingRecord = z.infer<typeof insertGivingRecordSchema>;
export type NewsletterSubscriber = z.infer<typeof newsletterSubscriberSchema>;
export type InsertNewsletterSubscriber = z.infer<typeof insertNewsletterSubscriberSchema>;
