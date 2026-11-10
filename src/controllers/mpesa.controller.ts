import type { Request, Response } from "express";
import { givingService } from "../services/giving.service";
import { mpesaService } from "../services/mpesa.service";
import { sendThankYouEmail } from "../services/mailer.service";

function ack(res: Response, checkoutRequestID?: string) {
  return res.status(200).json({
    ResponseCode: "000000",
    ResponseDescription: "Callback received successfully",
    CheckoutRequestID: checkoutRequestID,
  });
}

export const mpesaController = {
  async callback(req: Request, res: Response) {
    const mpesaCallbackData = req.body;
    console.log("M-Pesa callback received:", JSON.stringify(mpesaCallbackData, null, 2));

    try {
      const stkCallback = mpesaCallbackData?.Body?.stkCallback;
      if (!stkCallback) {
        // Always ack Daraja even for malformed payloads (avoids retry storms)
        return ack(res);
      }

      const resultCode = stkCallback.ResultCode;
      const checkoutRequestID: string | undefined = stkCallback.CheckoutRequestID;

      let accountReference = "";
      let mpesaReceiptNumber = "";

      if (stkCallback.CallbackMetadata?.Item) {
        const items = stkCallback.CallbackMetadata.Item;

        const accountRefItem = items.find((item: any) => item.Name === "AccountReference");
        if (accountRefItem) accountReference = accountRefItem.Value;

        const receiptItem = items.find((item: any) => item.Name === "MpesaReceiptNumber");
        if (receiptItem) mpesaReceiptNumber = receiptItem.Value;
      }

      // Prefer CheckoutRequestID lookup (exact Daraja reference),
      // fall back to the account reference (our giving record id).
      let record = checkoutRequestID
        ? await givingService.getByCheckoutRequestId(checkoutRequestID)
        : undefined;
      if (!record && accountReference) {
        record = await givingService.getById(accountReference);
      }

      if (!record) {
        console.error(
          "M-Pesa callback for unknown record.",
          JSON.stringify({ checkoutRequestID, accountReference })
        );
        return ack(res, checkoutRequestID);
      }

      const newStatus = resultCode === 0 ? "completed" : "failed";
      const wasCompleted = record.status === "completed";
      await givingService.updateStatus(record.id, newStatus, mpesaReceiptNumber || undefined);

      console.log(`Updated record ${record.id} to status: ${newStatus}`);

      // Thank-you email on first transition to completed (never blocks the ack)
      if (newStatus === "completed" && !wasCompleted && record.email) {
        void sendThankYouEmail({
          to: record.email,
          amount: record.amount,
          givingType: record.givingType,
          receipt: mpesaReceiptNumber || record.transactionId,
        });
      }

      return ack(res, checkoutRequestID);
    } catch (error) {
      console.error("Error processing M-Pesa callback:", error);
      // Still ack so Daraja does not keep retrying a poison payload
      return ack(res);
    }
  },

  /**
   * Fallback when the callback is delayed or missed.
   * GET /api/mpesa/status/:id  (id = giving record id)
   * Queries Daraja directly with the stored CheckoutRequestID and syncs the record.
   */
  async queryStatus(req: Request, res: Response) {
    try {
      const record = await givingService.getById(req.params.id);
      if (!record) {
        return res.status(404).json({ message: "Giving record not found" });
      }

      if (!record.checkoutRequestId) {
        return res.status(200).json({
          status: record.status,
          transactionId: record.transactionId,
          mpesaStatus: null,
          message: "No CheckoutRequestID stored for this record yet",
        });
      }

      try {
        const queryResponse = await mpesaService.queryTransactionStatus(
          record.checkoutRequestId
        );

        // Daraja ResultCode: 0 = success, 1032 = cancelled, 1037 = timeout, 1 = failed.
        // Anything still pending leaves our status untouched.
        const darajaCode = String(queryResponse?.ResultCode ?? "");
        let synced:
          | Awaited<ReturnType<typeof givingService.getById>>
          | undefined = record;
        if (darajaCode === "0") {
          const wasCompleted = record.status === "completed";
          synced = await givingService.updateStatus(
            record.id,
            "completed",
            record.transactionId ?? undefined
          );
          if (!wasCompleted && synced?.email) {
            void sendThankYouEmail({
              to: synced.email,
              amount: synced.amount,
              givingType: synced.givingType,
              receipt: synced.transactionId,
            });
          }
        } else if (["1", "1032", "1037"].includes(darajaCode)) {
          synced = await givingService.updateStatus(
            record.id,
            "failed",
            record.transactionId ?? undefined
          );
        }

        return res.status(200).json({
          status: synced?.status ?? record.status,
          transactionId: synced?.transactionId ?? record.transactionId,
          mpesaStatus: queryResponse,
        });
      } catch (queryError) {
        console.warn(
          "Could not query M-Pesa status, returning local status:",
          (queryError as Error).message
        );
        return res.status(200).json({
          status: record.status,
          transactionId: record.transactionId,
          mpesaStatus: null,
          message: "Using local giving status",
        });
      }
    } catch (error) {
      console.error("Error checking M-Pesa status:", error);
      res.status(500).json({ message: "Failed to check M-Pesa status" });
    }
  },
};
