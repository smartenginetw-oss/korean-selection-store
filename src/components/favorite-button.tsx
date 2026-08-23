"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";
import styles from "./favorite-button.module.css";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function HeartIcon({ filled }: { filled: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 8.7c0 5.4-8.8 10.1-8.8 10.1S3.2 14.1 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z" /></svg>;
}

export function FavoriteButton({ productId, returnTo, compact = false }: { productId: string; returnTo: string; compact?: boolean }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [ready, setReady] = useState(() => !UUID_PATTERN.test(productId));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!UUID_PATTERN.test(productId)) {
      return;
    }

    const supabase = createClient();
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) {
        setReady(true);
        return;
      }
      setSignedIn(true);
      const { data } = await supabase.from("favorites").select("product_id").eq("product_id", productId).maybeSingle();
      if (!active) return;
      setFavorite(Boolean(data));
      setReady(true);
    })();

    return () => { active = false; };
  }, [productId]);

  async function toggleFavorite() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    setPending(true);
    const supabase = createClient();
    const result = favorite
      ? await supabase.from("favorites").delete().eq("product_id", productId)
      : await supabase.from("favorites").insert({ product_id: productId, user_id: (await supabase.auth.getUser()).data.user?.id ?? "" });
    if (!result.error) setFavorite((value) => !value);
    setPending(false);
  }

  return <button className={`${styles.button} ${compact ? styles.compact : ""}`} type="button" onClick={toggleFavorite} disabled={!ready || pending} aria-label={favorite ? "取消收藏" : "加入收藏"} aria-pressed={favorite} title={favorite ? "取消收藏" : "加入收藏"}><HeartIcon filled={favorite} /></button>;
}
