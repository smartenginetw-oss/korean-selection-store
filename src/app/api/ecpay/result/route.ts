import { NextResponse } from "next/server";

function paymentMethod(value: string | null): "credit" | "atm" | "cvs" | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (normalized.includes("ATM")) return "atm";
  if (normalized.includes("CVS") || normalized.includes("BARCODE")) return "cvs";
  if (normalized.includes("CREDIT") || normalized.includes("CARD")) return "credit";
  return null;
}

function redirectToResult(request: Request, order: string | null, rtnCode: string | null, rawPaymentMethod: string | null) {
  // This is only the browser return page. The authoritative order state is
  // updated by the server-to-server ecpay-callback Edge Function.
  const safeOrder = order && /^[A-Za-z0-9-]{1,40}$/.test(order) ? order : "DEMO";
  const status = rtnCode === "1" ? "paid" : "pending";
  const url = new URL(`/checkout/result?order=${encodeURIComponent(safeOrder)}&provider=ecpay&status=${status}`, request.url);
  const method = paymentMethod(rawPaymentMethod);
  if (method) url.searchParams.set("method", method);
  return NextResponse.redirect(url);
}

export async function POST(request: Request) {
  const form = await request.formData();
  return redirectToResult(request, String(form.get("CustomField1") ?? ""), String(form.get("RtnCode") ?? ""), String(form.get("ChoosePayment") ?? form.get("PaymentType") ?? ""));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return redirectToResult(request, url.searchParams.get("order"), url.searchParams.get("rtnCode"), url.searchParams.get("method"));
}
