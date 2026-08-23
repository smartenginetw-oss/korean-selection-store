import { createClient } from "@/lib/supabase/server";

export type StoreSettings = {
  brandName: string;
  supportEmail: string;
  shippingFee: number;
  reservationMinutes: number;
  preorderEnabled: boolean;
};

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  brandName: "GYEOT",
  supportEmail: "smartengine.tw@gmail.com",
  shippingFee: 80,
  reservationMinutes: 15,
  preorderEnabled: true,
};

function normaliseSettings(value: unknown): StoreSettings {
  if (!value || typeof value !== "object") return DEFAULT_STORE_SETTINGS;
  const record = value as Record<string, unknown>;
  const shippingFee = typeof record.shippingFee === "number" && Number.isInteger(record.shippingFee) && record.shippingFee >= 0 ? record.shippingFee : DEFAULT_STORE_SETTINGS.shippingFee;
  const reservationMinutes = typeof record.reservationMinutes === "number" && Number.isInteger(record.reservationMinutes) && record.reservationMinutes >= 1 ? record.reservationMinutes : DEFAULT_STORE_SETTINGS.reservationMinutes;
  return {
    brandName: typeof record.brandName === "string" && record.brandName.trim() ? record.brandName.trim() : DEFAULT_STORE_SETTINGS.brandName,
    supportEmail: typeof record.supportEmail === "string" && record.supportEmail.trim() ? record.supportEmail.trim() : DEFAULT_STORE_SETTINGS.supportEmail,
    shippingFee,
    reservationMinutes,
    preorderEnabled: typeof record.preorderEnabled === "boolean" ? record.preorderEnabled : DEFAULT_STORE_SETTINGS.preorderEnabled,
  };
}

export async function getStoreSettings(): Promise<StoreSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_store_settings");
  if (error) {
    console.error("[store-settings] read failed", error.message);
    return DEFAULT_STORE_SETTINGS;
  }
  return normaliseSettings(data);
}

