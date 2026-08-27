import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type StoreSettings = {
  brandName: string;
  supportEmail: string;
  shippingFee: number;
  cvs711Fee: number;
  cvsFamilyFee: number;
  reservationMinutes: number;
  preorderEnabled: boolean;
  instagramUrl: string | null;
  threadsUrl: string | null;
  facebookUrl: string | null;
  lineOfficialUrl: string | null;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  brandName: "GYEOT",
  supportEmail: "gyeot.official@gmail.com",
  shippingFee: 80,
  cvs711Fee: 60,
  cvsFamilyFee: 60,
  reservationMinutes: 15,
  preorderEnabled: true,
  instagramUrl: null,
  threadsUrl: null,
  facebookUrl: null,
  lineOfficialUrl: null,
};

function normaliseSettings(value: unknown): StoreSettings {
  if (!value || typeof value !== "object") return DEFAULT_STORE_SETTINGS;
  const record = value as Record<string, unknown>;
  const shippingFee = typeof record.shippingFee === "number" && Number.isInteger(record.shippingFee) && record.shippingFee >= 0 ? record.shippingFee : DEFAULT_STORE_SETTINGS.shippingFee;
  const cvs711Fee = typeof record.cvs711Fee === "number" && Number.isInteger(record.cvs711Fee) && record.cvs711Fee >= 0 ? record.cvs711Fee : DEFAULT_STORE_SETTINGS.cvs711Fee;
  const cvsFamilyFee = typeof record.cvsFamilyFee === "number" && Number.isInteger(record.cvsFamilyFee) && record.cvsFamilyFee >= 0 ? record.cvsFamilyFee : DEFAULT_STORE_SETTINGS.cvsFamilyFee;
  const reservationMinutes = typeof record.reservationMinutes === "number" && Number.isInteger(record.reservationMinutes) && record.reservationMinutes >= 1 ? record.reservationMinutes : DEFAULT_STORE_SETTINGS.reservationMinutes;
  return {
    brandName: typeof record.brandName === "string" && record.brandName.trim() ? record.brandName.trim() : DEFAULT_STORE_SETTINGS.brandName,
    supportEmail: typeof record.supportEmail === "string" && record.supportEmail.trim() ? record.supportEmail.trim() : DEFAULT_STORE_SETTINGS.supportEmail,
    shippingFee,
    cvs711Fee,
    cvsFamilyFee,
    reservationMinutes,
    preorderEnabled: typeof record.preorderEnabled === "boolean" ? record.preorderEnabled : DEFAULT_STORE_SETTINGS.preorderEnabled,
    instagramUrl: typeof record.instagramUrl === "string" && record.instagramUrl.trim() ? record.instagramUrl.trim() : null,
    threadsUrl: typeof record.threadsUrl === "string" && record.threadsUrl.trim() ? record.threadsUrl.trim() : null,
    facebookUrl: typeof record.facebookUrl === "string" && record.facebookUrl.trim() ? record.facebookUrl.trim() : null,
    lineOfficialUrl: typeof record.lineOfficialUrl === "string" && record.lineOfficialUrl.trim() ? record.lineOfficialUrl.trim() : null,
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return DEFAULT_STORE_SETTINGS;

  // Store settings are intentionally public storefront data. Use a client
  // without request cookies so the app only uses the RPC's anonymous,
  // read-only execution grant.
  const supabase = createSupabaseClient<Database>(url, publishableKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
  const { data, error } = await supabase.rpc("get_store_settings");
  if (error) {
    console.error("[store-settings] read failed", error.message);
    return DEFAULT_STORE_SETTINGS;
  }
  return normaliseSettings(data);
}
