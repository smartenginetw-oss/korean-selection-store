"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireProcurement } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

const currencies = ["KRW", "TWD", "USD", "CNY"] as const;
const purchaseOrderStatuses = ["draft", "ordered", "partial_received", "received", "cancelled"] as const;

const PurchaseOrderFormSchema = z.object({
  supplierId: z.string().uuid(),
  quotationId: z.string().uuid().optional(),
  poNumber: z.string().trim().min(1).max(80),
  orderedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "下單日期格式不正確。"),
  expectedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "預計到貨日期格式不正確。").optional(),
  currency: z.enum(currencies),
  exchangeRate: z.coerce.number().positive().max(100000000),
  status: z.enum(purchaseOrderStatuses),
  shippingCost: z.coerce.number().min(0).max(100000000),
  otherCost: z.coerce.number().min(0).max(100000000),
  note: z.string().trim().max(2000).optional(),
});

const PurchaseOrderItemFormSchema = z.object({
  productId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  tempProductName: z.string().trim().max(160).optional(),
  variantName: z.string().trim().max(160).optional(),
  unitCost: z.coerce.number().positive().max(100000000),
  quantity: z.coerce.number().int().positive().max(1000000),
});

function redirectToOrders(status: "created" | "updated" | "error", message?: string): never {
  const params = new URLSearchParams({ status });
  if (message) params.set("message", message);
  redirect(`/admin/purchase-orders?${params.toString()}`);
}

function optionalUuid(value: FormDataEntryValue | null | undefined) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function optionalText(value: FormDataEntryValue | null | undefined) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function createPurchaseOrderAction(formData: FormData) {
  await requireProcurement();
  const parsed = PurchaseOrderFormSchema.safeParse({
    supplierId: formData.get("supplierId"),
    quotationId: optionalUuid(formData.get("quotationId")),
    poNumber: formData.get("poNumber"),
    orderedDate: formData.get("orderedDate"),
    expectedDate: optionalText(formData.get("expectedDate")),
    currency: formData.get("currency"),
    exchangeRate: formData.get("exchangeRate"),
    status: formData.get("status"),
    shippingCost: formData.get("shippingCost"),
    otherCost: formData.get("otherCost"),
    note: optionalText(formData.get("note")),
  });
  if (!parsed.success || !validDate(parsed.success ? parsed.data.orderedDate : "") || (parsed.success && parsed.data.expectedDate && !validDate(parsed.data.expectedDate))) {
    redirectToOrders("error", "請確認供應商、日期、成本與數量格式。");
  }

  const data = parsed.data;
  if (data.status === "partial_received" || data.status === "received" || data.status === "cancelled") {
    redirectToOrders("error", "建立採購單時只能使用草稿或已下單狀態；到貨狀態請建立後再更新。");
  }
  if (data.expectedDate && data.expectedDate < data.orderedDate) {
    redirectToOrders("error", "預計到貨日不能早於下單日。");
  }

  const supabase = await createClient();
  const { data: supplier } = await supabase.from("suppliers").select("id").eq("id", data.supplierId).eq("is_active", true).maybeSingle();
  if (!supplier) redirectToOrders("error", "供應商不存在或已停用，請重新選擇。");

  const productIds = formData.getAll("productId");
  const variantIds = formData.getAll("variantId");
  const tempProductNames = formData.getAll("tempProductName");
  const variantNames = formData.getAll("variantName");
  const unitCosts = formData.getAll("unitCost");
  const quantities = formData.getAll("quantity");
  const lineCount = Math.max(productIds.length, variantIds.length, tempProductNames.length, variantNames.length, unitCosts.length, quantities.length);
  if (!lineCount || lineCount > 20) redirectToOrders("error", "採購明細至少需要一筆，且單張採購單最多 20 筆。");

  const itemInputs: Array<z.infer<typeof PurchaseOrderItemFormSchema>> = [];
  for (let index = 0; index < lineCount; index += 1) {
    const parsedItem = PurchaseOrderItemFormSchema.safeParse({
      productId: optionalUuid(productIds[index]),
      variantId: optionalUuid(variantIds[index]),
      tempProductName: optionalText(tempProductNames[index]),
      variantName: optionalText(variantNames[index]),
      unitCost: unitCosts[index],
      quantity: quantities[index],
    });
    if (!parsedItem.success) redirectToOrders("error", `第 ${index + 1} 筆採購明細的成本或數量格式不正確。`);
    itemInputs.push(parsedItem.data);
  }

  const resolvedItems: Array<{
    product_id: string | null;
    variant_id: string | null;
    product_name: string;
    variant_name: string | null;
    sku: string | null;
    unit_cost: number;
    quantity: number;
    currency: typeof currencies[number];
  }> = [];
  for (const [index, item] of itemInputs.entries()) {
    let productId = item.productId ?? null;
    const variantId = item.variantId ?? null;
    let productName = item.tempProductName ?? "";
    let sku: string | null = null;
    let variantName = item.variantName ?? null;

    if (variantId) {
      const { data: variant } = await supabase.from("product_variants").select("id,product_id,sku").eq("id", variantId).eq("status", "active").maybeSingle();
      if (!variant) redirectToOrders("error", `第 ${index + 1} 筆規格不存在或已停用。`);
      if (productId && variant.product_id !== productId) redirectToOrders("error", `第 ${index + 1} 筆商品與規格不一致。`);
      productId = variant.product_id;
      sku = variant.sku;
      if (!variantName) variantName = variant.sku;
    }

    if (productId) {
      const { data: product } = await supabase.from("products").select("id,name").eq("id", productId).eq("status", "active").maybeSingle();
      if (!product) redirectToOrders("error", `第 ${index + 1} 筆商品不存在或尚未上架。`);
      productName = product.name;
    }
    if (!productName) redirectToOrders("error", `第 ${index + 1} 筆請選擇既有商品，或填寫暫存商品名稱。`);
    resolvedItems.push({
      product_id: productId,
      variant_id: variantId,
      product_name: productName,
      variant_name: variantName,
      sku,
      unit_cost: item.unitCost,
      quantity: item.quantity,
      currency: data.currency,
    });
  }

  let quotationSupplierId: string | null = null;
  if (data.quotationId) {
    const { data: quotation } = await supabase.from("supplier_quotations").select("id,supplier_id,status").eq("id", data.quotationId).maybeSingle();
    if (!quotation) redirectToOrders("error", "所選報價單不存在。");
    quotationSupplierId = quotation.supplier_id;
    if (quotation.supplier_id !== data.supplierId) redirectToOrders("error", "報價單與供應商不一致。");
    if (quotation.status !== "approved") redirectToOrders("error", "只有已核准的報價單可以轉成採購單，請先更新報價單狀態。");
  }

  const { data: purchaseOrder, error: purchaseOrderError } = await supabase.from("purchase_orders").insert({
    supplier_id: data.supplierId,
    quotation_id: data.quotationId ?? null,
    po_number: data.poNumber,
    ordered_date: data.orderedDate,
    expected_date: data.expectedDate ?? null,
    currency: data.currency,
    exchange_rate: data.exchangeRate,
    status: "draft",
    shipping_cost: data.shippingCost,
    other_cost: data.otherCost,
    note: data.note ?? null,
  }).select("id").single();

  if (purchaseOrderError || !purchaseOrder) {
    console.error("[admin/purchase-orders] create header failed", purchaseOrderError?.message);
    if (purchaseOrderError?.code === "23505") redirectToOrders("error", "採購單號已存在，請換一組編號。");
    redirectToOrders("error", "採購單尚未建立，請稍後再試。");
  }

  const { error: itemError } = await supabase.from("purchase_order_items").insert(resolvedItems.map((item) => ({
    purchase_order_id: purchaseOrder.id,
    ...item,
  })));

  if (itemError) {
    console.error("[admin/purchase-orders] create item failed", itemError.message);
    await supabase.from("purchase_orders").delete().eq("id", purchaseOrder.id);
    redirectToOrders("error", "採購明細尚未建立，採購單已取消，請檢查商品與成本資料。");
  }

  if (data.status !== "draft") {
    const { error: statusError } = await supabase.from("purchase_orders").update({ status: data.status }).eq("id", purchaseOrder.id);
    if (statusError) {
      console.error("[admin/purchase-orders] initial status update failed", statusError.message);
      redirectToOrders("error", "採購明細已建立，但狀態更新失敗，請在列表中重新更新。");
    }
  }
  if (quotationSupplierId && data.quotationId) {
    const { error: quotationError } = await supabase.from("supplier_quotations").update({ status: "converted" }).eq("id", data.quotationId).in("status", ["draft", "received", "approved"]);
    if (quotationError) console.error("[admin/purchase-orders] quotation conversion failed", quotationError.message);
  }

  revalidatePath("/admin/purchase-orders");
  revalidatePath("/admin/quotations");
  redirectToOrders("created");
}

export async function updatePurchaseOrderStatusAction(formData: FormData) {
  await requireProcurement();
  const id = z.string().uuid().safeParse(formData.get("id"));
  const status = z.enum(purchaseOrderStatuses).safeParse(formData.get("status"));
  if (!id.success || !status.success) redirectToOrders("error", "採購單狀態資料不正確。");

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_orders").update({ status: status.data }).eq("id", id.data);
  if (error) {
    console.error("[admin/purchase-orders] status update failed", error.message);
    redirectToOrders("error", "採購單狀態尚未更新。");
  }
  revalidatePath("/admin/purchase-orders");
  redirectToOrders("updated");
}

export async function recordPurchaseReceiptAction(formData: FormData) {
  await requireProcurement();
  const purchaseOrderId = z.string().uuid().safeParse(formData.get("purchaseOrderId"));
  const receiptNumber = z.string().trim().min(1).max(80).safeParse(formData.get("receiptNumber"));
  const receivedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(formData.get("receivedDate"));
  const note = z.string().trim().max(2000).optional().safeParse(optionalText(formData.get("note")));
  if (!purchaseOrderId.success || !receiptNumber.success || !receivedDate.success || !note.success || !validDate(receivedDate.data)) {
    redirectToOrders("error", "請確認到貨單號、到貨日期與備註格式。");
  }

  const items: Array<{ purchaseOrderItemId: string; quantity: number; damagedQuantity: number }> = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity_")) continue;
    const itemId = z.string().uuid().safeParse(key.slice("quantity_".length));
    const quantity = z.coerce.number().int().min(0).max(1000000).safeParse(value);
    const damagedQuantity = z.coerce.number().int().min(0).max(1000000).safeParse(formData.get(`damaged_${key.slice("quantity_".length)}`) ?? 0);
    if (!itemId.success || !quantity.success || !damagedQuantity.success) redirectToOrders("error", "到貨良品／損耗數量格式不正確。");
    if (quantity.data + damagedQuantity.data > 1000000) redirectToOrders("error", "單一明細的良品與損耗合計不可超過 1,000,000。");
    if (quantity.data + damagedQuantity.data > 0) {
      items.push({ purchaseOrderItemId: itemId.data, quantity: quantity.data, damagedQuantity: damagedQuantity.data });
    }
  }
  if (!items.length) redirectToOrders("error", "請至少輸入一筆良品到貨或損耗數量。");

  const supabase = await createClient();
  const { error } = await supabase.rpc("receive_purchase_order", {
    p_purchase_order_id: purchaseOrderId.data,
    p_receipt_number: receiptNumber.data,
    p_received_date: receivedDate.data,
    p_note: note.data ?? null,
    p_items: items,
  });
  if (error) {
    console.error("[admin/purchase-orders] receive failed", error.message);
    if (error.code === "23505") redirectToOrders("error", "到貨單號已存在，請換一組編號。");
    redirectToOrders("error", "到貨驗收尚未完成，請確認採購單狀態、規格與剩餘數量。");
  }

  revalidatePath("/admin/purchase-orders");
  revalidatePath(`/admin/purchase-orders/${purchaseOrderId.data}/receive`);
  revalidatePath("/admin/inventory");
  redirectToOrders("updated");
}
