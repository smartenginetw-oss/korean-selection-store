export {};

declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): void;
};

const MAX_BODY_BYTES = 32 * 1024;
const responseHeaders = { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };

function ok() {
  // ECPay retries a callback when this exact acknowledgement is not returned.
  return new Response("1|OK", { status: 200, headers: responseHeaders });
}

function retry() {
  return new Response("0|RETRY", { status: 500, headers: responseHeaders });
}

function databaseKey(): { key: string; isNewSecret: boolean } | null {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys) as Record<string, unknown>;
      const key = parsed.default;
      if (typeof key === "string" && key.length > 0) return { key, isNewSecret: key.startsWith("sb_secret_") };
    } catch {
      // Fall through to the legacy service-role variable.
    }
  }
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  return legacy ? { key: legacy, isNewSecret: false } : null;
}

function ecpayEncode(raw: string) {
  return encodeURIComponent(raw)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7e")
    .replace(/'/g, "%27")
    .toLowerCase()
    .replace(/%2d/g, "-")
    .replace(/%5f/g, "_")
    .replace(/%2e/g, ".")
    .replace(/%21/g, "!")
    .replace(/%2a/g, "*")
    .replace(/%28/g, "(")
    .replace(/%29/g, ")");
}

async function checkMacValue(fields: Record<string, string>, hashKey: string, hashIv: string) {
  const sorted = Object.entries(fields)
    .filter(([key]) => key !== "CheckMacValue")
    .sort(([left], [right]) => left.toLowerCase().localeCompare(right.toLowerCase()));
  const raw = `HashKey=${hashKey}&${sorted.map(([key, value]) => `${key}=${value}`).join("&")}&HashIV=${hashIv}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ecpayEncode(raw)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function handle(request: Request) {
  if (request.method !== "POST") return ok();
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return ok();

  const hashKey = Deno.env.get("ECPAY_HASH_KEY")?.trim();
  const hashIv = Deno.env.get("ECPAY_HASH_IV")?.trim();
  if (!hashKey || !hashIv) {
    console.error("[ecpay-payment-info] missing ECPAY_HASH_KEY or ECPAY_HASH_IV");
    return ok();
  }

  const form = new URLSearchParams(rawBody);
  const fields = Object.fromEntries(form.entries());
  const configuredMerchantId = Deno.env.get("ECPAY_MERCHANT_ID")?.trim();
  if (!configuredMerchantId || fields.MerchantID?.trim() !== configuredMerchantId) {
    console.error("[ecpay-payment-info] MerchantID verification failed");
    return ok();
  }

  const received = fields.CheckMacValue?.toUpperCase() ?? "";
  let computed = "";
  try {
    computed = await checkMacValue(fields, hashKey, hashIv);
  } catch (error) {
    console.error("[ecpay-payment-info] CheckMacValue calculation failed", error instanceof Error ? error.message : "unknown");
    return ok();
  }
  if (!safeEqual(computed, received)) {
    console.error("[ecpay-payment-info] CheckMacValue verification failed");
    return ok();
  }

  const merchantTradeNo = fields.MerchantTradeNo?.trim() ?? "";
  const rtnCode = fields.RtnCode?.trim() ?? "";
  const tradeAmount = Number.parseInt(fields.TradeAmt ?? "", 10);
  if (!/^[A-Za-z0-9]{1,20}$/.test(merchantTradeNo) || !Number.isInteger(tradeAmount)) {
    console.error("[ecpay-payment-info] callback fields are invalid");
    return ok();
  }

  const baseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
  const secret = databaseKey();
  if (!baseUrl || !secret) {
    console.error("[ecpay-payment-info] database credentials are missing");
    return ok();
  }

  const headers: Record<string, string> = { "content-type": "application/json", apikey: secret.key };
  if (!secret.isNewSecret) headers.authorization = `Bearer ${secret.key}`;
  try {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/record_ecpay_payment_info`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_merchant_trade_no: merchantTradeNo,
        p_trade_no: fields.TradeNo?.trim() || null,
        p_rtn_code: rtnCode,
        p_rtn_msg: fields.RtnMsg?.trim() || null,
        p_trade_amt: tradeAmount,
        p_payment_type: fields.PaymentType?.trim() || null,
        p_payment_no: fields.PaymentNo?.trim() || null,
        p_bank_code: fields.BankCode?.trim() || null,
        p_vaccount: fields.vAccount?.trim() || null,
        p_expire_date: fields.ExpireDate?.trim() || null,
      }),
    });
    if (!response.ok) {
      console.error("[ecpay-payment-info] database callback RPC failed", response.status);
      return retry();
    }
  } catch (error) {
    console.error("[ecpay-payment-info] database callback request failed", error instanceof Error ? error.message : "unknown");
    return retry();
  }
  return ok();
}

Deno.serve((request) => handle(request).catch((error) => {
  console.error("[ecpay-payment-info] unexpected error", error instanceof Error ? error.message : "unknown");
  return retry();
}));
