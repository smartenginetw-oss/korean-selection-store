import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const PreviewRequestSchema = z.object({
  couponCode: z.string().trim().min(1).max(40),
  shippingMethod: z.enum(["home_delivery", "cvs_711", "cvs_family"]).default("home_delivery"),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(10),
  })).min(1).max(50),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { code, message } }, { status });
}

function mapPreviewError(code?: string, detail?: string) {
  if (code === "P0001" || code === "inventory_conflict") return errorResponse("商品規格已變更，請回到購物車重新確認。", 409, "inventory_conflict");
  if (code === "rate_limited") return errorResponse("操作太頻繁，請稍後再試。", 429, "rate_limited");
  if (code === "rate_limit_unavailable") return errorResponse("目前無法驗證請求頻率，請稍後再試。", 503, "rate_limit_unavailable");
  if (code === "coupon_invalid" || (code === "22023" && detail?.toLowerCase().includes("coupon"))) {
    return errorResponse("優惠碼無效、已過期或未達使用門檻。", 400, "coupon_invalid");
  }
  if (code === "22023") return errorResponse("優惠碼資料無法驗證，請重新確認。", 400, "validation_error");
  return errorResponse("目前無法檢查優惠碼，請稍後再試。", 503, "preview_unavailable");
}

async function previewViaEdgeFunction(payload: z.infer<typeof PreviewRequestSchema>) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const functionUrl = process.env.SUPABASE_CHECKOUT_FUNCTION_URL || (baseUrl ? `${baseUrl}/functions/v1/checkout` : undefined);
  if (!functionUrl || !publishableKey) return errorResponse("優惠碼服務尚未設定安全金鑰。", 503, "preview_not_configured");

  let response: Response;
  try {
    response = await fetch(functionUrl, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: publishableKey },
      body: JSON.stringify({ action: "preview", ...payload }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("[coupon-preview] Edge Function request failed", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法檢查優惠碼，請稍後再試。", 503, "preview_unavailable");
  }

  let body: { preview?: unknown; error?: { code?: string; message?: string } } = {};
  try {
    body = await response.json();
  } catch {
    return errorResponse("目前無法檢查優惠碼，請稍後再試。", 502, "preview_unavailable");
  }
  if (!response.ok || !body.preview) return mapPreviewError(body.error?.code, body.error?.message);
  return Response.json({ preview: body.preview });
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof PreviewRequestSchema>;
  try {
    parsed = PreviewRequestSchema.parse(await request.json());
  } catch {
    return errorResponse("優惠碼資料格式不正確，請重新確認。", 400, "invalid_request");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return previewViaEdgeFunction(parsed);

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("preview_coupon_discount", { p_payload: parsed });
    if (error) {
      console.error("[coupon-preview] RPC failed", error.message);
      return mapPreviewError(error.code, error.message);
    }
    return Response.json({ preview: data });
  } catch (error) {
    console.error("[coupon-preview] server preview failed", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法檢查優惠碼，請稍後再試。", 503, "preview_unavailable");
  }
}
