import type { Request, Response } from "express";
import { z } from "zod";
import { contactService } from "../services/contact.service";
import { newsletterService } from "../services/newsletter.service";
import { sendWelcomeEmail } from "../services/mailer.service";
import { insertContactMessageSchema } from "../validators/schemas";

export const contactController = {
  async create(req: Request, res: Response) {
    try {
      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await contactService.create(validatedData);

      // Auto-subscribe when the visitor opted into the newsletter (best-effort).
      // Sends the same welcome email as a direct subscribe, but only for
      // genuinely new subscribers (subscribe() is idempotent).
      if (validatedData.newsletter) {
        try {
          const { created } = await newsletterService.subscribe({
            email: validatedData.email,
            name: `${validatedData.firstName} ${validatedData.lastName}`.trim(),
            source: "contact-form",
          });
          if (created) {
            void sendWelcomeEmail({
              to: validatedData.email,
              name: validatedData.firstName,
            });
          }
        } catch (error) {
          console.error("Auto-subscribe from contact form failed:", error);
        }
      }

      res.status(201).json({ message: "Message sent successfully", id: message.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid form data", errors: error.errors });
      } else {
        console.error("Error creating contact message:", error);
        res.status(500).json({ message: "Failed to send message" });
      }
    }
  },

  async list(_req: Request, res: Response) {
    try {
      const messages = await contactService.list();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching contact messages:", error);
      res.status(500).json({ message: "Failed to fetch contact messages" });
    }
  },
};
