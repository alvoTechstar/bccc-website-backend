import type { Request, Response } from "express";
import { givingService } from "../services/giving.service";

export const mpesaController = {
  async callback(req: Request, res: Response) {
    const mpesaCallbackData = req.body;
    console.log("M-Pesa callback received:", JSON.stringify(mpesaCallbackData, null, 2));

    try {
      const resultCode = mpesaCallbackData.Body.stkCallback.ResultCode;
      const checkoutRequestID = mpesaCallbackData.Body.stkCallback.CheckoutRequestID;

      let accountReference = "";
      let mpesaReceiptNumber = "";

      if (
        mpesaCallbackData.Body.stkCallback.CallbackMetadata &&
        mpesaCallbackData.Body.stkCallback.CallbackMetadata.Item
      ) {
        const items = mpesaCallbackData.Body.stkCallback.CallbackMetadata.Item;

        const accountRefItem = items.find((item: any) => item.Name === "AccountReference");
        if (accountRefItem) accountReference = accountRefItem.Value;

        const receiptItem = items.find((item: any) => item.Name === "MpesaReceiptNumber");
        if (receiptItem) mpesaReceiptNumber = receiptItem.Value;
      }

      if (!accountReference) {
        console.error("M-Pesa callback received without account reference.");
        return res.status(400).json({ message: "Callback missing account reference." });
      }

      const newStatus = resultCode === 0 ? "completed" : "failed";
      await givingService.updateStatus(accountReference, newStatus, mpesaReceiptNumber);

      console.log(`Updated record ${accountReference} to status: ${newStatus}`);

      res.status(200).json({
        ResponseCode: "000000",
        ResponseDescription: "Callback received successfully",
        CheckoutRequestID: checkoutRequestID,
      });
    } catch (error) {
      console.error("Error processing M-Pesa callback:", error);
      res.status(500).json({
        ResponseCode: "000001",
        ResponseDescription: "Callback processing failed",
      });
    }
  },
};
