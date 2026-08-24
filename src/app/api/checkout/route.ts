import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CheckoutRequestSchema = z.object({
  idempotencyKey: z.string().min(16).max(128).regex(/^[a-zA-Z0-9:_-]+$/),
  paymentProvider: z.literal("test"),
  shippingMethod: z.literal("home_delivery").default("home_delivery"),
  consentVersion: z.string().min(1).max(40).default("terms-v1"),
  couponCode: z.string().trim().max(40).optional(),
  customer: z.object({
    email: z.string().email().max(254),
    phone: z.string().regex(/^09[0-9]{8}$/),
    recipientName: z.string().trim().min(1).max(80),
    postalCode: z.string().trim().min(3).max(10),
    city: z.string().trim().min(1).max(30),
    district: z.string().trim().min(1).max(30),
    addressLine: z.string().trim().min(1).max(160),
    customerNote: z.string().trim().max(500).optional(),
  }),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(50),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { code, message } }, { status });
}

function mapCheckoutError(code?: string, fallbackStatus = 500, detail?: string) {
  if (code === "P0001") return errorResponse("商品庫存或規格已變更，請返回購物車重新確認。", 409, "inventory_conflict");
  if (code === "coupon_invalid") return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
  if (code === "22023" && detail?.toLowerCase().includes("coupon")) return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
  if (code === "22023") return errorResponse("結帳資料無法驗證，請重新確認。", 400, "validation_error");
  return errorResponse("目前無法建立訂單，請稍後再試。", fallbackStatus, "checkout_failed");
}

async function createCheckoutViaEdgeFunction(payload: z.infer<typeof CheckoutRequestSchema>, accessToken?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const functionUrl = process.env.SUPABASE_CHECKOUT_FUNCTION_URL || (baseUrl ? `${baseUrl}/functions/v1/checkout` : undefined);

  if (!functionUrl || !publishableKey) {
    return errorResponse("Checkout server 尚未設定安全金鑰。", 503, "checkout_not_configured");
  }

  let response: Response;
  try {
    response = await fetch(functionUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Publishable keys belong in apikey only. New Supabase keys are not JWTs.
        apikey: publishableKey,
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[checkout] Edge Function request failed", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法建立訂單，請稍後再試。", 503, "checkout_unavailable");
  }

  let body: { order?: unknown; error?: { code?: string; message?: string } } = {};
  try {
    body = await response.json();
  } catch {
    return errorResponse("目前無法建立訂單，請稍後再試。", 502, "checkout_unavailable");
  }

  if (!response.ok || !body.order) {
    return mapCheckoutError(body.error?.code, response.status >= 500 ? 503 : response.status);
  }

  return Response.json({ order: body.order });
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof CheckoutRequestSchema>;
  try {
    parsed = CheckoutRequestSchema.parse(await request.json());
  } catch {
    return errorResponse("結帳資料格式不正確，請重新確認。", 400, "invalid_request");
  }

  // Resolve the member session on the server. The Edge Function validates the
  // forwarded token again; guests continue through the same checkout path with
  // no member identity attached.
  const supabase = await createClient();
  const [{ data: { user } }, { data: { session } }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);
  const memberProfileId = user?.id ?? null;
  const accessToken = session?.access_token;

  // Prefer the local server-role path when explicitly configured. Otherwise
  // use the deployed Edge Function, whose server-only key never reaches Next
  // or the browser.
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createCheckoutViaEdgeFunction(parsed, accessToken);
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("create_checkout_order_for_member", {
      p_payload: parsed,
      p_idempotency_key: parsed.idempotencyKey,
      p_profile_id: memberProfileId,
    });

    if (error) {
      console.error("[checkout] RPC failed", error.message);
      return mapCheckoutError(error.code, 500, error.message);
    }

    return Response.json({ order: data });
  } catch (error) {
    console.error("[checkout] server checkout failed", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法建立訂單，請稍後再試。", 500, "checkout_failed");
  }
}
