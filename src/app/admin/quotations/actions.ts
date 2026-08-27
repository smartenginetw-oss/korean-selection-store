"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProcurement } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const currencyValues = ["KRW", "TWD", "USD", "CNY"] as const;
const quotationStatuses = ["draft", "received", "approved", "rejected", "converted"] as const;

const QuotationFormSchema = z.object({
  supplierId: z.string().uuid(),
  quoteNumber: z.string().trim().min(1).max(80),
  quoteDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "報價日期格式不正確。"),
  currency: z.enum(currencyValues),
  exchangeRate: z.coerce.number().positive().max(100000000),
  status: z.enum(quotationStatuses),
  note: z.string().trim().max(2000).optional(),
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  tempProductName: z.string().trim().max(160).optional(),
  variantName: z.string().trim().max(160).optional(),
  unitCost: z.coerce.number().positive().max(100000000),
  moq: z.coerce.number().int().positive().max(1000000),
  quantity: z.coerce.number().int().positive().max(1000000),
});

function quotationRedirect(status: "created" | "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/quotations?${params.toString()}`);
}

function optionalUuid(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function createQuotationAction(formData: FormData) {
  await requireProcurement();
  const parsed = QuotationFormSchema.safeParse({
    supplierId: formData.get("supplierId"),
    quoteNumber: formData.get("quoteNumber"),
    quoteDate: formData.get("quoteDate"),
    currency: formData.get("currency"),
    exchangeRate: formData.get("exchangeRate"),
    status: formData.get("status"),
    note: optionalText(formData.get("note")),
    productId: optionalUuid(formData.get("productId")),
    variantId: optionalUuid(formData.get("variantId")),
    tempProductName: optionalText(formData.get("tempProductName")),
    variantName: optionalText(formData.get("variantName")),
    unitCost: formData.get("unitCost"),
    moq: formData.get("moq"),
    quantity: formData.get("quantity"),
  });
  if (!parsed.success || !validDate(parsed.success ? parsed.data.quoteDate : "")) {
    quotationRedirect("error", "請確認供應商、報價日期、成本與數量格式。 ");
  }

  const data = parsed.data;
  if (data.status === "converted") quotationRedirect("error", "報價單需透過採購單流程轉換，不能直接建立為已轉採購單。 ");
  const supabase = await createClient();
  const { data: supplier } = await supabase.from("suppliers").select("id").eq("id", data.supplierId).eq("is_active", true).maybeSingle();
  if (!supplier) quotationRedirect("error", "供應商不存在或已停用，請重新選擇。 ");

  let productId = data.productId ?? null;
  const variantId = data.variantId ?? null;
  let productName = data.tempProductName ?? "";
  let sku: string | null = null;
  let variantName = data.variantName ?? null;

  if (variantId) {
    const { data: variant } = await supabase.from("product_variants").select("id,product_id,sku").eq("id", variantId).eq("status", "active").maybeSingle();
    if (!variant) quotationRedirect("error", "所選規格不存在或已停用。 ");
    if (productId && variant.product_id !== productId) quotationRedirect("error", "商品與規格不一致，請重新選擇。 ");
    productId = variant.product_id;
    sku = variant.sku;
    if (!variantName) variantName = variant.sku;
  }

  if (productId) {
    const { data: product } = await supabase.from("products").select("id,name").eq("id", productId).eq("status", "active").maybeSingle();
    if (!product) quotationRedirect("error", "所選商品不存在或尚未上架。 ");
    productName = product.name;
  }
  if (!productName) quotationRedirect("error", "請選擇既有商品，或填寫暫存商品名稱。 ");

  const { data: quotation, error: quotationError } = await supabase.from("supplier_quotations").insert({
    supplier_id: data.supplierId,
    quote_number: data.quoteNumber,
    quote_date: data.quoteDate,
    currency: data.currency,
    exchange_rate: data.exchangeRate,
    // Create the row as a draft first so the line-item RLS policy can verify
    // the parent before a later status transition.
    status: "draft",
    note: data.note ?? null,
  }).select("id").single();

  if (quotationError || !quotation) {
    console.error("[admin/quotations] create header failed", quotationError?.message);
    if (quotationError?.code === "23505") quotationRedirect("error", "報價單號已存在，請換一組編號。 ");
    quotationRedirect("error", "報價單尚未建立，請稍後再試。 ");
  }

  const { error: itemError } = await supabase.from("supplier_quotation_items").insert({
    quotation_id: quotation.id,
    product_id: productId,
    variant_id: variantId,
    product_name: productName,
    variant_name: variantName,
    sku,
    unit_cost: data.unitCost,
    moq: data.moq,
    quantity: data.quantity,
    currency: data.currency,
  });

  if (itemError) {
    console.error("[admin/quotations] create item failed", itemError.message);
    await supabase.from("supplier_quotations").delete().eq("id", quotation.id);
    quotationRedirect("error", "報價明細尚未建立，報價單已取消，請檢查商品與成本資料。 ");
  }

  if (data.status !== "draft") {
    const { error: statusError } = await supabase.from("supplier_quotations").update({ status: data.status }).eq("id", quotation.id);
    if (statusError) {
      console.error("[admin/quotations] initial status update failed", statusError.message);
      quotationRedirect("error", "報價明細已建立，但狀態更新失敗，請在列表中重新更新。 ");
    }
  }

  revalidatePath("/admin/quotations");
  quotationRedirect("created");
}

export async function updateQuotationStatusAction(formData: FormData) {
  await requireProcurement();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(quotationStatuses).safeParse(formData.get("status"));
  if (!id.success || !status.success) quotationRedirect("error", "報價單狀態資料不正確。 ");

  const supabase = await createClient();
  const { error } = await supabase.from("supplier_quotations").update({ status: status.data }).eq("id", id.data);
  if (error) {
    console.error("[admin/quotations] status update failed", error.message);
    quotationRedirect("error", "報價單狀態尚未更新。 ");
  }
  revalidatePath("/admin/quotations");
  quotationRedirect("updated");
}
