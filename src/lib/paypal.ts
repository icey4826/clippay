// Minimal PayPal REST client (Orders v2 + Payments v2).
// Uses only fetch, so it runs in Node scripts, Next.js routes and Cloudflare Workers.

export type PayPalEnv = "sandbox" | "live";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  env?: PayPalEnv;
}

export interface Money {
  currency_code: string;
  value: string; // PayPal wants decimal strings, e.g. "12.00"
}

export interface CreateOrderInput {
  amount: Money;
  description?: string;
  referenceId?: string; // our internal order id
  returnUrl: string;
  cancelUrl: string;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public debugId: string | undefined,
    public details: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

const BASE_URLS: Record<PayPalEnv, string> = {
  sandbox: "https://api-m.sandbox.paypal.com",
  live: "https://api-m.paypal.com",
};

export function toMoney(amount: number, currency = "USD"): Money {
  return { currency_code: currency, value: amount.toFixed(2) };
}

export class PayPalClient {
  private baseUrl: string;
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private config: PayPalConfig) {
    if (!config.clientId || !config.clientSecret) {
      throw new Error("PayPal client id and secret are required");
    }
    this.baseUrl = BASE_URLS[config.env ?? "sandbox"];
  }

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;

    const basic = btoa(`${this.config.clientId}:${this.config.clientSecret}`);
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const body = await res.json();
    if (!res.ok) {
      throw new PayPalError(
        `OAuth failed: ${body.error_description ?? body.error ?? res.statusText}`,
        res.status,
        res.headers.get("paypal-debug-id") ?? undefined,
        body,
      );
    }
    // Refresh a minute early.
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in - 60) * 1000 };
    return this.token.value;
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    requestId?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${await this.accessToken()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    };
    // Makes POSTs idempotent: retrying with the same id never double-refunds.
    if (requestId) headers["PayPal-Request-Id"] = requestId;

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const issue = json.details?.[0];
      const reason = issue ? `${issue.issue}: ${issue.description}` : json.message ?? res.statusText;
      throw new PayPalError(
        `${method} ${path} failed (${res.status}) ${reason}`,
        res.status,
        json.debug_id ?? res.headers.get("paypal-debug-id") ?? undefined,
        json,
      );
    }
    return json as T;
  }

  createOrder(input: CreateOrderInput) {
    return this.request<PayPalOrder>("POST", "/v2/checkout/orders", {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: input.referenceId,
          description: input.description,
          amount: input.amount,
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
            user_action: "PAY_NOW",
            shipping_preference: "NO_SHIPPING",
          },
        },
      },
    });
  }

  getOrder(orderId: string) {
    return this.request<PayPalOrder>("GET", `/v2/checkout/orders/${orderId}`);
  }

  captureOrder(orderId: string) {
    return this.request<PayPalOrder>("POST", `/v2/checkout/orders/${orderId}/capture`, {}, `capture-${orderId}`);
  }

  getCapture(captureId: string) {
    return this.request<PayPalCapture>("GET", `/v2/payments/captures/${captureId}`);
  }

  /**
   * Partial (or full) refund of a captured payment.
   * `requestId` should be stable per claim (e.g. `refund-${claimId}`) so retries are safe.
   */
  refundCapture(captureId: string, amount: Money, requestId: string, noteToPayer?: string) {
    return this.request<PayPalRefund>(
      "POST",
      `/v2/payments/captures/${captureId}/refund`,
      { amount, note_to_payer: noteToPayer },
      requestId,
    );
  }
}

export function approveLink(order: PayPalOrder): string | undefined {
  return order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
}

export function firstCapture(order: PayPalOrder): PayPalCapture | undefined {
  return order.purchase_units?.[0]?.payments?.captures?.[0];
}

export function payPalFromEnv(env: Record<string, string | undefined> = process.env): PayPalClient {
  return new PayPalClient({
    clientId: env.PAYPAL_CLIENT_ID ?? "",
    clientSecret: env.PAYPAL_CLIENT_SECRET ?? "",
    env: env.PAYPAL_ENV === "live" ? "live" : "sandbox",
  });
}

// Response shapes (only the fields we use).

export interface PayPalLink {
  href: string;
  rel: string;
  method?: string;
}

export interface PayPalCapture {
  id: string;
  status: "COMPLETED" | "PENDING" | "DECLINED" | "PARTIALLY_REFUNDED" | "REFUNDED" | "FAILED";
  amount: Money;
  create_time?: string;
  seller_receivable_breakdown?: {
    gross_amount: Money;
    paypal_fee?: Money;
    net_amount?: Money;
  };
}

export interface PayPalOrder {
  id: string;
  status: "CREATED" | "SAVED" | "APPROVED" | "VOIDED" | "COMPLETED" | "PAYER_ACTION_REQUIRED";
  links?: PayPalLink[];
  purchase_units?: {
    reference_id?: string;
    amount?: Money;
    payments?: { captures?: PayPalCapture[] };
  }[];
}

export interface PayPalRefund {
  id: string;
  status: "CANCELLED" | "FAILED" | "PENDING" | "COMPLETED";
  amount: Money;
  seller_payable_breakdown?: {
    gross_amount?: Money;
    paypal_fee?: Money;
    net_amount?: Money;
    total_refunded_amount?: Money;
  };
}
