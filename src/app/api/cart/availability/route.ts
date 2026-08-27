import { z } from "zod";
import { getPublicVariantStatuses } from "@/features/catalog/server";

const CartAvailabilityRequestSchema = z.object({
  variantIds: z.array(z.string().uuid()).min(1).max(50),
});

function errorResponse(message: string, status: number, code: string) {
  return Response.json({ error: { code, message } }, { status });
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof CartAvailabilityRequestSchema>;
  try {
    parsed = CartAvailabilityRequestSchema.parse(await request.json());
  } catch {
    return errorResponse("購物車檢查資料格式不正確。", 400, "invalid_request");
  }

  try {
    const statuses = await getPublicVariantStatuses([...new Set(parsed.variantIds)]);
    if (!statuses) return errorResponse("目前無法同步商品狀態，請稍後再試。", 503, "availability_unavailable");
    return Response.json({ statuses }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[cart-availability] public status check failed", error instanceof Error ? error.message : "unknown error");
    return errorResponse("目前無法同步商品狀態，請稍後再試。", 503, "availability_unavailable");
  }
}
