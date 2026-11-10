import type { Request, Response } from "express";
import { z } from "zod";
import { contactService } from "../services/contact.service";
import { insertContactMessageSchema } from "../validators/schemas";

export const contactController = {
  async create(req: Request, res: Response) {
    try {
      const validatedData = insertContactMessageSchema.parse(req.body);
      const message = await contactService.create(validatedData);
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
