"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setProductStatusAction } from "./actions";

type ProductStatus = "draft" | "active" | "archived";

export function ProductStatusButton({ productId, status }: { productId: string; status: ProductStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const restoring = status === "archived";
  const nextStatus = restoring ? "draft" : "archived";

  function handleClick() {
    const prompt = restoring
      ? "確定恢復為草稿？恢復後商品仍不會出現在商城，需編輯並重新上架。"
      : "確定封存這項商品？封存後會從商城移除，但會保留訂單與庫存歷史。";
    if (!window.confirm(prompt)) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const result = await setProductStatusAction(productId, nextStatus);
        if (!result.ok) {
          setMessage(result.message);
          return;
        }
        router.refresh();
      } catch (error) {
        console.error("[admin/products] status button failed", error);
        setMessage("商品狀態尚未更新，請重新登入後再試。");
      }
    });
  }

  return <span>
    <button
      className="button button-secondary button-small"
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-label={restoring ? "恢復商品為草稿" : "封存商品"}
    >
      {pending ? (restoring ? "恢復中…" : "封存中…") : (restoring ? "恢復草稿" : "封存")}
    </button>
    {message && <small role="alert" style={{ display: "block", marginTop: 6, color: "#8b4136", maxWidth: 180 }}>{message}</small>}
  </span>;
}
