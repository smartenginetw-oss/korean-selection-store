"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteProductAction } from "./actions";

type ProductStatus = "draft" | "active" | "archived";

export function DeleteProductButton({ productId, status }: { productId: string; status: ProductStatus }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const canDelete = status !== "active";

  function handleDelete() {
    if (!canDelete) return;
    if (!window.confirm("確定刪除這項商品？有訂單或庫存紀錄的商品會被保護並改用封存。")) return;
    setMessage(null);
    startTransition(async () => {
      const result = await deleteProductAction(productId);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      router.refresh();
    });
  }

  return <span>
    <button
      className="button button-secondary button-small"
      type="button"
      onClick={handleDelete}
      disabled={pending || !canDelete}
      title={canDelete ? "刪除商品" : "請先封存商品，再評估是否刪除"}
    >
      {pending ? "刪除中…" : "刪除"}
    </button>
    {message && <small role="alert" style={{ display: "block", marginTop: 6, color: "#8b4136", maxWidth: 180 }}>{message}</small>}
  </span>;
}
