import type { Request, Response } from "express";
import { z } from "zod";
import { newsletterService } from "../services/newsletter.service";
import { sendWelcomeEmail } from "../services/mailer.service";
import { insertNewsletterSubscriberSchema } from "../validators/schemas";

export const newsletterController = {
  async subscribe(req: Request, res: Response) {
    try {
      const validatedData = insertNewsletterSubscriberSchema.parse(req.body);
      const { subscriber, created } = await newsletterService.subscribe(
        validatedData
      );

      if (created) {
        // Non-blocking welcome email; subscribe succeeds regardless
        void sendWelcomeEmail({ to: subscriber.email, name: subscriber.name ?? undefined });
      }

      res.status(created ? 201 : 200).json({
        message: created
          ? "Subscribed successfully. Karibu!"
          : "This email is already subscribed.",
        id: subscriber.id,
        created,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid email address", errors: error.errors });
      } else {
        console.error("Error subscribing email:", error);
        res.status(500).json({ message: "Failed to subscribe" });
      }
    }
  },

  async list(_req: Request, res: Response) {
    try {
      const subscribers = await newsletterService.list();
      res.json(subscribers);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
      res.status(500).json({ message: "Failed to fetch subscribers" });
    }
  },
};
