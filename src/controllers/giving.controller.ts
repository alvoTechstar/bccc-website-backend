import type { Request, Response } from "express";
import { z } from "zod";
import { givingService } from "../services/giving.service";
import { mpesaService } from "../services/mpesa.service";
import { insertGivingRecordSchema } from "../validators/schemas";
import {
  displayPhoneNumber,
  formatPhoneNumber,
  isValidPhoneNumber,
} from "../utils/phone";
import { env } from "../config/env";

export const givingController = {
  async create(req: Request, res: Response) {
    let record: Awaited<ReturnType<typeof givingService.create>> | undefined;
    try {
      console.log("Received giving request:", req.body);

      const validatedData = insertGivingRecordSchema.parse(req.body);

      if (!validatedData.phoneNumber || validatedData.phoneNumber.trim() === "") {
        return res.status(400).json({
          message: "Phone number is required",
          field: "phoneNumber",
          received: validatedData.phoneNumber || "undefined",
        });
      }

      if (!isValidPhoneNumber(validatedData.phoneNumber)) {
        return res.status(400).json({
          message:
            "Invalid phone number format. Please use a valid Kenyan phone number (e.g., 0712345678 or 254712345678).",
          field: "phoneNumber",
          received: validatedData.phoneNumber,
          examples: ["0712345678", "254712345678", "712345678"],
        });
      }

      let formattedPhoneNumber: string;
      try {
        formattedPhoneNumber = formatPhoneNumber(validatedData.phoneNumber);
      } catch (formatError) {
        return res.status(400).json({
          message: "Failed to format phone number",
          error: (formatError as Error).message,
          received: validatedData.phoneNumber,
        });
      }

      console.log(
        `Original phone: ${validatedData.phoneNumber}, Formatted: ${formattedPhoneNumber}`
      );

      record = await givingService.create(validatedData);

      const amount = validatedData.amount;
      const businessShortCode = env.mpesa.paybillNumber;
      const stkTransactionId = `GIV${Date.now()}${record.id.substring(0, 4)}`;

      console.log("Sending STK push with details:", {
        phone: formattedPhoneNumber,
        amount,
        businessShortCode,
        accountReference: record.id,
      });

      const mpesaResponse = await mpesaService.sendStkPush(
        formattedPhoneNumber,
        amount,
        record.id
      );

      if (mpesaResponse.ResponseCode === "0") {
        const checkoutRequestId: string | undefined =
          mpesaResponse.CheckoutRequestID;
        await givingService.updateStatus(
          record.id,
          "initiated",
          stkTransactionId,
          checkoutRequestId
        );
        res.status(201).json({
          message: "Giving record created. Please check your M-Pesa for a prompt.",
          id: record.id,
          transactionId: stkTransactionId,
          checkoutRequestId,
          phone: displayPhoneNumber(validatedData.phoneNumber),
          instructions:
            "You will receive an M-Pesa prompt on your phone shortly. Approve the transaction.",
        });
      } else {
        console.error("M-Pesa STK Push initiation failed:", mpesaResponse);
        await givingService.updateStatus(record.id, "failed", stkTransactionId);
        res.status(500).json({
          message: "Failed to initiate M-Pesa transaction. Please try again.",
          error:
            mpesaResponse.ResponseDescription ||
            mpesaResponse.errorMessage ||
            "Unknown M-Pesa error",
          requestId: mpesaResponse.requestId,
          responseCode: mpesaResponse.ResponseCode,
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors);

        const phoneError = error.errors.find(
          (err) => err.path.includes("phoneNumber") || err.path[0] === "phoneNumber"
        );

        if (phoneError) {
          return res.status(400).json({
            message: "Phone number validation failed",
            error: phoneError.message,
            field: "phoneNumber",
            receivedData: req.body,
            allErrors: error.errors,
          });
        }

        res.status(400).json({
          message: "Invalid form data",
          errors: error.errors,
          receivedData: req.body,
        });
      } else {
        console.error("Error creating giving record:", error);
        if (record && record.id) {
          await givingService.updateStatus(record.id, "failed");
        }
        res.status(500).json({
          message: "Failed to process giving",
          error: (error as Error).message,
        });
      }
    }
  },

  async list(_req: Request, res: Response) {
    try {
      const records = await givingService.list();
      res.json(records);
    } catch (error) {
      console.error("Error fetching giving records:", error);
      res.status(500).json({ message: "Failed to fetch giving records" });
    }
  },

  async getStatus(req: Request, res: Response) {
    try {
      const record = await givingService.getById(req.params.id);
      if (!record) {
        return res.status(404).json({ message: "Giving record not found" });
      }
      res.json({ status: record.status, transactionId: record.transactionId });
    } catch (error) {
      console.error("Error fetching giving status:", error);
      res.status(500).json({ message: "Failed to fetch giving status" });
    }
  },
};
