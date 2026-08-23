"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createProductAction, registerProductImagesAction } from "@/app/admin/products/actions";
import type { ProductCategory } from "@/features/catalog/data";
import { createClient } from "@/lib/supabase/client";
import styles from "./product-editor.module.css";

type FulfillmentMode = "in_stock" | "preorder";
type DraftVariant = { key: string; color: string; size: string; sku: string; stock: number; fulfillmentMode: FulfillmentMode };

async function uploadProductImages(productId: string, productName: string, files: File[]) {
  const supabase = createClient();
  const storage = supabase.storage.from("product-images");
  const uploadedPaths: string[] = [];

  for (const [index, file] of files.entries()) {
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "image";
    const path = "products/" + productId + "/" + crypto.randomUUID() + "-" + safeName;
    const { error } = await storage.upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
    if (error) {
      if (uploadedPaths.length) await storage.remove(uploadedPaths);
      return { ok: false as const, message: "商品已建立，但圖片上傳失敗，請確認檔案格式與大小。" };
    }
    uploadedPaths.push(path);
    if (index === files.length - 1) {
      const registered = await registerProductImagesAction({
        productId,
        images: uploadedPaths.map((uploadedPath, imageIndex) => ({
          path: uploadedPath,
          altText: productName + " 商品圖片 " + (imageIndex + 1),
          sortOrder: imageIndex,
        })),
      });
      if (!registered.ok) {
        await storage.remove(uploadedPaths);
        return registered;
      }
      return registered;
    }
  }

  return { ok: true as const, count: 0 };
}

const categoryOptions: { value: ProductCategory; label: string }[] = [
  { value: "tops", label: "上衣" },
  { value: "bottoms", label: "下身" },
  { value: "outerwear", label: "外套" },
  { value: "accessories", label: "配件" },
];

export function ProductEditor() {
  const router = useRouter();
  const [name, setName] = useState("韓國針織上衣");
  const [slug, setSlug] = useState("soft-oversize-knit");
  const [description, setDescription] = useState("柔軟細緻的針織面料，帶有恰好的寬鬆輪廓。");
  const [category, setCategory] = useState<ProductCategory>("tops");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [salePrice, setSalePrice] = useState("890");
  const [originalPrice, setOriginalPrice] = useState("1080");
  const [costPrice, setCostPrice] = useState("450");
  const [colors, setColors] = useState(["奶茶", "灰色"]);
  const [sizes, setSizes] = useState(["S", "M", "L"]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [generated, setGenerated] = useState<DraftVariant[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const combinations = useMemo(() => colors.flatMap((color) => sizes.map((size) => ({ color, size }))), [colors, sizes]);

  function generateVariants() {
    setGenerated((current) => combinations.map(({ color, size }, index) => {
      const key = `${color}:${size}`;
      return current.find((item) => item.key === key) ?? { key, color, size, sku: `GYEOT-${String(index + 1).padStart(2, "0")}`, stock: 3, fulfillmentMode: "in_stock" };
    }));
    setMessage(null);
  }

  async function handleSave() {
    if (!generated.length) {
      setMessage({ type: "error", text: "請先產生至少一組 Variant，再儲存商品。" });
      return;
    }

    setPending(true);
    setMessage(null);
    const result = await createProductAction({
      name,
      slug,
      description,
      category,
      status,
      salePrice: Number(salePrice),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      costPrice: costPrice ? Number(costPrice) : null,
      options: [{ name: "顏色", values: colors }, { name: "尺寸", values: sizes }],
      variants: generated.map((variant) => ({ sku: variant.sku, stock: variant.stock, fulfillmentMode: variant.fulfillmentMode, options: { 顏色: variant.color, 尺寸: variant.size } })),
    });

    if (!result.ok) {
      setMessage({ type: "error", text: result.message });
      setPending(false);
      return;
    }

    if (imageFiles.length) {
      const imageResult = await uploadProductImages(result.product.id, result.product.name, imageFiles);
      if (!imageResult.ok) {
        setMessage({ type: "error", text: imageResult.message });
        setPending(false);
        return;
      }
    }

    router.push(`/admin/products?created=${encodeURIComponent(result.product.slug)}${imageFiles.length ? `&images=${imageFiles.length}` : ""}`);
    router.refresh();
  }

  const margin = Number(salePrice) - Number(costPrice || 0);
  const marginRate = Number(salePrice) > 0 ? (margin / Number(salePrice)) * 100 : 0;

  return <div className={styles.editor}>
    <div className={styles.main}>
      <section><h2>基本資料</h2><div className={styles.fields}>
        <div className="field"><label htmlFor="product-name">商品名稱</label><input className="input" id="product-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="field"><label htmlFor="product-slug">Slug</label><input className="input" id="product-slug" value={slug} onChange={(event) => setSlug(event.target.value)} /></div>
        <div className="field"><label htmlFor="description">商品描述</label><textarea className="input" id="description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="field"><label htmlFor="product-category">分類</label><select className="input" id="product-category" value={category} onChange={(event) => setCategory(event.target.value as ProductCategory)}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      </div></section>
      <section><h2>商品圖片</h2><label className={styles.upload + " button button-secondary"} htmlFor="product-images">＋ 選擇商品圖片</label><input className={styles.fileInput} id="product-images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]); const valid = files.filter((file) => allowed.has(file.type) && file.size <= 5 * 1024 * 1024); setImageFiles(valid.slice(0, 8)); setMessage(valid.length === files.length && files.length <= 8 ? null : { type: "error", text: "僅接受 JPG、PNG、WebP、AVIF；單張上限 5 MB，最多 8 張。" }); }} />{imageFiles.length > 0 && <ul className={styles.fileList}>{imageFiles.map((file) => <li key={file.name + file.lastModified}>{file.name}</li>)}</ul>}<p className={styles.helper}>可上傳 JPG、PNG、WebP 或 AVIF；單張上限 5 MB，最多 8 張。</p></section>
      <section><div className={styles.sectionHead}><h2>通用規格</h2><button className="button button-secondary button-small" type="button" onClick={generateVariants}>產生 Variant</button></div>
        <OptionEditor label="顏色" values={colors} setValues={setColors} /><OptionEditor label="尺寸" values={sizes} setValues={setSizes} />
        {generated.length > 0 && <div className={styles.variantWrap}><table><thead><tr><th>規格</th><th>SKU</th><th>模式</th><th>庫存</th></tr></thead><tbody>{generated.map((variant) => <tr key={variant.key}><td>{variant.color}／{variant.size}</td><td><input className="input" value={variant.sku} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, sku: event.target.value } : item))} /></td><td><select className="input" value={variant.fulfillmentMode} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, fulfillmentMode: event.target.value as FulfillmentMode } : item))}><option value="in_stock">現貨</option><option value="preorder">預購</option></select></td><td><input className="input" type="number" min="0" value={variant.stock} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, stock: Number(event.target.value) } : item))} /></td></tr>)}</tbody></table></div>}
      </section>
    </div>
    <aside className={styles.side}>
      <section><h2>商品狀態</h2><select className="input" value={status} onChange={(event) => setStatus(event.target.value as "draft" | "active")}><option value="draft">草稿</option><option value="active">上架</option></select></section>
      <section><h2>定價</h2><div className={styles.fields}><div className="field"><label htmlFor="sale-price">售價 NT$</label><input className="input" id="sale-price" type="number" min="1" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></div><div className="field"><label htmlFor="original-price">原價 NT$（選填）</label><input className="input" id="original-price" type="number" min="0" value={originalPrice} onChange={(event) => setOriginalPrice(event.target.value)} /></div><div className="field"><label htmlFor="cost-price">成本 NT$（選填）</label><input className="input" id="cost-price" type="number" min="0" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} /></div><p className={styles.margin}>預估毛利：NT${Number.isFinite(margin) ? margin : 0}（{Number.isFinite(marginRate) ? marginRate.toFixed(1) : "0.0"}%）</p></div></section>
      {message && <p className={message.type === "error" ? styles.error : styles.info} role={message.type === "error" ? "alert" : undefined}>{message.text}</p>}
      <button className="button button-primary" type="button" onClick={handleSave} disabled={pending}>{pending ? "儲存中…" : "儲存商品"}</button><p className={styles.helper}>儲存會建立商品、規格、Variant、庫存與審計紀錄。</p>
    </aside>
  </div>;
}

function OptionEditor({ label, values, setValues }: { label: string; values: string[]; setValues: React.Dispatch<React.SetStateAction<string[]>> }) {
  const [draft, setDraft] = useState("");
  return <div className={styles.option}><strong>{label}</strong><div className={styles.chips}>{values.map((value) => <button type="button" key={value} onClick={() => setValues((current) => current.filter((item) => item !== value))}>{value} ×</button>)}</div><div className={styles.addOption}><input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`新增${label}`} /><button className="button button-secondary button-small" type="button" onClick={() => { const value = draft.trim(); if (value && !values.includes(value)) setValues((current) => [...current, value]); setDraft(""); }}>加入</button></div></div>;
}
