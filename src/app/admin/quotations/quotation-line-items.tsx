"use client";

import { useRef, useState } from "react";

import { RoundedSelect } from "@/components/rounded-select";

import styles from "./quotations.module.css";

const MAX_LINES = 20;

type Product = { id: string; name: string };
type Variant = { id: string; product_id: string; sku: string };
type LineItem = {
  key: string;
  productId: string;
  variantId: string;
  tempProductName: string;
  variantName: string;
  unitCost: string;
  moq: string;
  quantity: string;
};

function createLineItem(sequence: number): LineItem {
  return {
    key: `quotation-line-${sequence}`,
    productId: "",
    variantId: "",
    tempProductName: "",
    variantName: "",
    unitCost: "",
    moq: "1",
    quantity: "1",
  };
}

export function QuotationLineItems({ products, variants }: { products: Product[]; variants: Variant[] }) {
  const sequence = useRef(1);
  const [lines, setLines] = useState<LineItem[]>([createLineItem(0)]);

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    if (lines.length >= MAX_LINES) return;
    const next = sequence.current;
    sequence.current += 1;
    setLines((current) => [...current, createLineItem(next)]);
  }

  function removeLine(key: string) {
    if (lines.length === 1) return;
    setLines((current) => current.filter((line) => line.key !== key));
  }

  const productOptions = [{ value: "", label: "暫存商品／下方自行填寫" }, ...products.map((product) => ({ value: product.id, label: product.name }))];

  return (
    <section className={styles.lineItems} aria-labelledby="quotation-line-items-title">
      <div className={styles.lineItemsHeading}>
        <div>
          <h3 id="quotation-line-items-title">報價明細</h3>
          <p>每筆明細可指定商品／規格，或先以暫存商品名稱記錄；最多 20 筆。</p>
        </div>
        <button className={styles.addLineButton} type="button" onClick={addLine} disabled={lines.length >= MAX_LINES}>＋ 新增商品明細</button>
      </div>
      <div className={styles.lineItemsList}>
        {lines.map((line, index) => {
          const availableVariants = line.productId ? variants.filter((variant) => variant.product_id === line.productId) : variants;
          const variantOptions = [{ value: "", label: "不指定規格" }, ...availableVariants.map((variant) => ({ value: variant.id, label: `${products.find((product) => product.id === variant.product_id)?.name ?? "商品"} · ${variant.sku}` }))];
          return (
            <fieldset className={styles.lineItem} key={line.key}>
              <legend className={styles.lineItemLegend}>明細 {index + 1}</legend>
              {lines.length > 1 && <button className={styles.lineItemRemove} type="button" onClick={() => removeLine(line.key)}>移除明細</button>}
              <div className={styles.lineItemGrid}>
                <label>商品（選填）<RoundedSelect id={`${line.key}-product`} name="productId" value={line.productId} options={productOptions} onValueChange={(value) => updateLine(line.key, { productId: value, variantId: "" })} ariaLabel={`明細 ${index + 1} 商品`} /></label>
                <label>規格（選填）<RoundedSelect id={`${line.key}-variant`} name="variantId" value={line.variantId} options={variantOptions} onValueChange={(value) => {
                  const selected = variants.find((variant) => variant.id === value);
                  updateLine(line.key, { variantId: value, productId: selected?.product_id ?? line.productId });
                }} ariaLabel={`明細 ${index + 1} 規格`} /></label>
                <label>暫存商品名稱（選填）<input className="input" name="tempProductName" value={line.tempProductName} onChange={(event) => updateLine(line.key, { tempProductName: event.target.value })} maxLength={160} placeholder="未建檔商品才需要填寫" /></label>
                <label>規格備註（選填）<input className="input" name="variantName" value={line.variantName} onChange={(event) => updateLine(line.key, { variantName: event.target.value })} maxLength={160} placeholder="例如：黑色／M" /></label>
                <label>單件成本<input className="input" name="unitCost" value={line.unitCost} onChange={(event) => updateLine(line.key, { unitCost: event.target.value })} type="number" min="0.01" step="0.01" required placeholder="例如：18500" /></label>
                <label>MOQ<input className="input" name="moq" value={line.moq} onChange={(event) => updateLine(line.key, { moq: event.target.value })} type="number" min="1" step="1" required /></label>
                <label>報價數量<input className="input" name="quantity" value={line.quantity} onChange={(event) => updateLine(line.key, { quantity: event.target.value })} type="number" min="1" step="1" required /></label>
              </div>
            </fieldset>
          );
        })}
      </div>
    </section>
  );
}
