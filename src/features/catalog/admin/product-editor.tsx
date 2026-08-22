"use client";

import { useMemo, useState } from "react";
import styles from "./product-editor.module.css";

type DraftVariant = { key: string; color: string; size: string; sku: string; stock: number };

export function ProductEditor() {
  const [colors, setColors] = useState(["奶茶", "灰色"]);
  const [sizes, setSizes] = useState(["S", "M", "L"]);
  const [generated, setGenerated] = useState<DraftVariant[]>([]);
  const combinations = useMemo(() => colors.flatMap((color) => sizes.map((size) => ({ color, size }))), [colors, sizes]);

  function generateVariants() {
    setGenerated((current) => combinations.map(({ color, size }, index) => {
      const key = `${color}:${size}`;
      return current.find((item) => item.key === key) ?? { key, color, size, sku: `KNIT-${String(index + 1).padStart(2, "0")}`, stock: 3 };
    }));
  }

  return <div className={styles.editor}><div className={styles.main}><section><h2>基本資料</h2><div className={styles.fields}><div className="field"><label htmlFor="product-name">商品名稱</label><input className="input" id="product-name" defaultValue="韓國針織上衣" /></div><div className="field"><label htmlFor="product-slug">Slug</label><input className="input" id="product-slug" defaultValue="soft-oversize-knit" /></div><div className="field"><label htmlFor="description">商品描述</label><textarea className="input" id="description" rows={5} defaultValue="柔軟細緻的針織面料，帶有恰好的寬鬆輪廓。" /></div></div></section><section><h2>商品圖片</h2><button className={`${styles.upload} button button-secondary`} type="button">＋ 選擇商品圖片</button><p className={styles.helper}>Preview 尚未連接 Supabase Storage。</p></section><section><div className={styles.sectionHead}><h2>通用規格</h2><button className="button button-secondary button-small" type="button" onClick={generateVariants}>產生 Variant</button></div><OptionEditor label="顏色" values={colors} setValues={setColors} /><OptionEditor label="尺寸" values={sizes} setValues={setSizes} />{generated.length > 0 && <div className={styles.variantWrap}><table><thead><tr><th>規格</th><th>SKU</th><th>模式</th><th>庫存</th></tr></thead><tbody>{generated.map((variant) => <tr key={variant.key}><td>{variant.color}／{variant.size}</td><td><input className="input" value={variant.sku} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, sku: event.target.value } : item))} /></td><td><select className="input" defaultValue="in_stock"><option value="in_stock">現貨</option><option value="preorder">預購</option></select></td><td><input className="input" type="number" min="0" value={variant.stock} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, stock: Number(event.target.value) } : item))} /></td></tr>)}</tbody></table></div>}</section></div><aside className={styles.side}><section><h2>商品狀態</h2><select className="input" defaultValue="draft"><option value="draft">草稿</option><option value="active">上架</option></select></section><section><h2>定價</h2><div className={styles.fields}><div className="field"><label htmlFor="sale-price">售價 NT$</label><input className="input" id="sale-price" type="number" min="1" defaultValue="890" /></div><div className="field"><label htmlFor="cost-price">成本 NT$</label><input className="input" id="cost-price" type="number" min="0" defaultValue="450" /></div><p className={styles.margin}>預估毛利：NT$440（49.4%）</p></div></section><button className="button button-primary" type="button">儲存 Preview 草稿</button><p className={styles.helper}>目前不會寫入資料庫。</p></aside></div>;
}

function OptionEditor({ label, values, setValues }: { label: string; values: string[]; setValues: React.Dispatch<React.SetStateAction<string[]>> }) {
  const [draft, setDraft] = useState("");
  return <div className={styles.option}><strong>{label}</strong><div className={styles.chips}>{values.map((value) => <button type="button" key={value} onClick={() => setValues((current) => current.filter((item) => item !== value))}>{value} ×</button>)}</div><div className={styles.addOption}><input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`新增${label}`} /><button className="button button-secondary button-small" type="button" onClick={() => { const value = draft.trim(); if (value && !values.includes(value)) setValues((current) => [...current, value]); setDraft(""); }}>加入</button></div></div>;
}
