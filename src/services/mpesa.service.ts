import axios from "axios";
import { env } from "../config/env";

export interface StkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: string;
  Amount: string;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

class MpesaService {
  private accessToken: string | null = null;
  private tokenExpiryTime = 0;

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiryTime > now + 30 * 60 * 1000) {
      return this.accessToken;
    }

    const { consumerKey, consumerSecret } = env.mpesa;
    if (!consumerKey || !consumerSecret) {
      throw new Error("MPESA_CONSUMER_KEY / MPESA_CONSUMER_SECRET are not set.");
    }

    try {
      const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
      console.log("Attempting to get M-Pesa access token...");
      const response = await axios.get(env.mpesa.authUrl, {
        headers: { Authorization: `Basic ${auth}` },
        timeout: 30000,
      });

      this.accessToken = response.data.access_token;
      this.tokenExpiryTime = now + response.data.expires_in * 1000;
      console.log("Successfully obtained M-Pesa access token.");
      return this.accessToken!;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error during token fetch:", error.message);
        console.error("Response status:", error.response?.status);
        console.error("Response data:", error.response?.data);
      } else {
        console.error("Unexpected error fetching M-Pesa access token:", error);
      }
      throw new Error("Failed to get M-Pesa access token.");
    }
  }

  public async sendStkPush(
    phone: string,
    amount: number,
    accountReference: string
  ): Promise<any> {
    try {
      console.log("sendStkPush parameters:", { phone, amount, accountReference });

      if (!phone || !amount || !accountReference) {
        throw new Error("Missing required parameters for STK push");
      }

      const token = await this.getAccessToken();
      const businessShortCode = env.mpesa.paybillNumber;
      const passkey = env.mpesa.passkey;
      if (!passkey) {
        throw new Error("MPESA_PASSKEY is not set.");
      }

      // Generate timestamp and password (sandbox for now)
      const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, -3);
      const password = Buffer.from(
        `${businessShortCode}${passkey}${timestamp}`
      ).toString("base64");

      const stkRequest: StkPushRequest = {
        BusinessShortCode: businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount.toString(),
        PartyA: phone,
        PartyB: businessShortCode,
        PhoneNumber: phone,
        CallBackURL: env.mpesa.callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: "Church Offering",
      };

      console.log(`Sending STK Push request to: ${env.mpesa.apiUrl}`);
      console.log("STK Push Request Details:", {
        phoneNumber: stkRequest.PhoneNumber,
        amount: stkRequest.Amount,
        accountReference: stkRequest.AccountReference,
        businessShortCode: stkRequest.BusinessShortCode,
        callbackURL: stkRequest.CallBackURL,
      });

      const response = await axios.post(env.mpesa.apiUrl, stkRequest, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 30000,
      });

      console.log("STK Push Success:", response.data);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error("Axios error sending STK Push request:", error.message);
        console.error("Response status:", error.response?.status);
        console.error("Response data:", error.response?.data);
        return {
          ResponseCode: error.response?.status?.toString() || "500",
          ResponseDescription:
            error.response?.statusText || "Failed to communicate with M-Pesa API.",
          errorMessage: error.message,
          requestId: (error.response?.data as any)?.requestId,
        };
      } else {
        console.error("Unexpected error sending STK Push request:", error);
        return {
          ResponseCode: "500",
          ResponseDescription: "An unexpected error occurred.",
          errorMessage: (error as Error).message,
        };
      }
    }
  }

  /**
   * Query the status of an STK push via Daraja's STK push query API.
   * Used as a fallback when the callback is delayed or missed
   * (e.g. server asleep on free-tier hosting).
   */
  public async queryTransactionStatus(checkoutRequestId: string): Promise<any> {
    if (!checkoutRequestId) {
      throw new Error("CheckoutRequestID is required");
    }

    const token = await this.getAccessToken();
    const businessShortCode = env.mpesa.paybillNumber;
    const passkey = env.mpesa.passkey;
    if (!passkey) {
      throw new Error("MPESA_PASSKEY is not set.");
    }

    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, -3);
    const password = Buffer.from(
      `${businessShortCode}${passkey}${timestamp}`
    ).toString("base64");

    const response = await axios.post(
      env.mpesa.queryUrl,
      {
        BusinessShortCode: businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    return response.data;
  }
}

export const mpesaService = new MpesaService();
