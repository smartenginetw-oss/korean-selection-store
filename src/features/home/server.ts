import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export type HomeCollection = Omit<Pick<
  Tables<"store_home_collections">,
  "id" | "slug" | "eyebrow" | "title" | "description" | "href" | "tone" | "sort_order" | "is_published" | "updated_at" | "updated_by"
>, "updated_at"> & { updated_at: string | null };

const localEyebrows: Record<HomeCollection["slug"], string> = {
  "new-arrivals": "新到選品",
  "in-stock": "現貨即出",
  preorder: "預購選品",
};

const legacyEyebrows: Record<HomeCollection["slug"], string> = {
  "new-arrivals": "JUST ARRIVED",
  "in-stock": "READY TO SHIP",
  preorder: "TAKE YOUR TIME",
};

export function localizeHomeCollection(collection: HomeCollection): HomeCollection {
  return collection.eyebrow.trim().toUpperCase() === legacyEyebrows[collection.slug]
    ? { ...collection, eyebrow: localEyebrows[collection.slug] }
    : collection;
}

function getPublicClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient<Database>(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
  });
}

export async function getHomeCollections() {
  const client = getPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from("store_home_collections")
    .select("id,slug,eyebrow,title,description,href,tone,sort_order,is_published,updated_at,updated_by")
    .eq("is_published", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[home] collection read failed.", error.message);
    return [];
  }
  return (data ?? []).map((collection) => localizeHomeCollection(collection as HomeCollection));
}
