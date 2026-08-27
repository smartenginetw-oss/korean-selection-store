"use client";

import { useState } from "react";

import { adjustInventoryAction } from "./actions";
import type { AdminInventoryRow } from "@/features/inventory/admin/server";
import styles from "../admin.module.css";

export function InventoryTable({ rows }: { rows: AdminInventoryRow[] }) {
  const [drafts, setDrafts] = useState(() => new Map(rows.map((row) => [row.variantId, { onHand: String(row.onHand), threshold: String(row.lowStockThreshold), reason: "例行盤點" }])));
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<{ variantId: string; type: "success" | "error"; text: string } | null>(null);

  function updateDraft(variantId: string, patch: Partial<{ onHand: string; threshold: string; reason: string }>) {
    setDrafts((current) => new Map(current).set(variantId, { ...(current.get(variantId) ?? { onHand: "0", threshold: "3", reason: "例行盤點" }), ...patch }));
  }

  async function save(row: AdminInventoryRow) {
    const draft = drafts.get(row.variantId);
    if (!draft) return;
    setSaving(row.variantId);
    setMessage(null);
    const result = await adjustInventoryAction({ variantId: row.variantId, onHand: Number(draft.onHand), lowStockThreshold: Number(draft.threshold), reason: draft.reason });
    setMessage({ variantId: row.variantId, type: result.ok ? "success" : "error", text: result.ok ? "已更新庫存。" : result.message });
    setSaving(null);
  }

  return <div className={styles.inventoryTableWrap}><table className={styles.table + " " + styles.inventoryTable}><thead><tr><th>商品／SKU</th><th>現有</th><th>保留</th><th>可售</th><th>供貨狀態</th><th>低庫存門檻</th><th>調整原因</th><th>操作</th></tr></thead><tbody>{rows.map((row) => { const draft = drafts.get(row.variantId); const isSoldOut = row.fulfillmentMode === "in_stock" && row.available <= 0; const isLow = !isSoldOut && row.fulfillmentMode === "in_stock" && row.available <= row.lowStockThreshold; const statusLabel = row.fulfillmentMode === "preorder" ? "預購" : isSoldOut ? "售罄" : isLow ? "低庫存" : "可售"; const statusClass = row.fulfillmentMode === "preorder" ? "badge badge-preorder" : isSoldOut || isLow ? "badge badge-preorder" : "badge badge-stock"; return <tr key={row.variantId}><td><strong>{row.productName}</strong><br /><small>{row.sku}</small></td><td><input className="input" type="number" min="0" value={draft?.onHand ?? row.onHand} onChange={(event) => updateDraft(row.variantId, { onHand: event.target.value })} /></td><td>{row.reserved}</td><td><span className={isSoldOut || isLow ? "badge badge-preorder" : "badge badge-stock"}>{row.available}</span></td><td><span className={statusClass}>{statusLabel}</span></td><td><input className="input" type="number" min="0" value={draft?.threshold ?? row.lowStockThreshold} onChange={(event) => updateDraft(row.variantId, { threshold: event.target.value })} /></td><td><input className="input" value={draft?.reason ?? "例行盤點"} maxLength={240} onChange={(event) => updateDraft(row.variantId, { reason: event.target.value })} /></td><td><button className="button button-secondary button-small" type="button" onClick={() => save(row)} disabled={saving === row.variantId}>{saving === row.variantId ? "儲存中…" : "儲存"}</button>{message?.variantId === row.variantId && <small className={message.type === "success" ? styles.inlineSuccess : styles.inlineError}>{message.text}</small>}</td></tr>; })}</tbody></table>{!rows.length && <p className={styles.empty}>目前尚無庫存資料。</p>}</div>;
}
