"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createProductAction, deleteProductImageAction, registerProductImagesAction, updateProductAction } from "@/app/admin/products/actions";
import type { ProductCategory } from "@/features/catalog/data";
import type { AdminProductEditorData } from "./server";
import { createClient } from "@/lib/supabase/client";
import styles from "./product-editor.module.css";

type FulfillmentMode = "in_stock" | "preorder";
type DraftOption = { name: string; values: string[] };
type DraftVariant = { key: string; id?: string; sku: string; stock: number; fulfillmentMode: FulfillmentMode; options: Record<string, string> };

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

function combinationKey(options: Record<string, string>) {
  return Object.entries(options).sort(([left], [right]) => left.localeCompare(right)).map(([name, value]) => `${name}:${value}`).join("|");
}

export function ProductEditor({ initialProduct }: { initialProduct?: AdminProductEditorData }) {
  const router = useRouter();
  const [name, setName] = useState(initialProduct?.name ?? "韓國針織上衣");
  const [slug, setSlug] = useState(initialProduct?.slug ?? "soft-oversize-knit");
  const [description, setDescription] = useState(initialProduct?.description ?? "柔軟細緻的針織面料，帶有恰好的寬鬆輪廓。");
  const [category, setCategory] = useState<ProductCategory>(initialProduct?.category ?? "tops");
  const [status, setStatus] = useState<"draft" | "active">(initialProduct?.status ?? "draft");
  const [salePrice, setSalePrice] = useState(String(initialProduct?.salePrice ?? 890));
  const [originalPrice, setOriginalPrice] = useState(initialProduct?.originalPrice == null ? "" : String(initialProduct.originalPrice));
  const [costPrice, setCostPrice] = useState(initialProduct?.costPrice == null ? "" : String(initialProduct.costPrice));
  const [options, setOptions] = useState<DraftOption[]>(initialProduct?.options.length ? initialProduct.options : [{ name: "顏色", values: ["奶茶", "灰色"] }, { name: "尺寸", values: ["S", "M", "L"] }]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState(initialProduct?.images ?? []);
  const [generated, setGenerated] = useState<DraftVariant[]>(initialProduct?.variants.map((variant) => ({ ...variant, key: combinationKey(variant.options) })) ?? []);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "info"; text: string } | null>(null);
  const combinations = useMemo(() => {
    if (!options.length || options.some((option) => !option.name.trim() || !option.values.length)) return [];
    return options.reduce<Record<string, string>[]>((current, option) => current.flatMap((combination) => option.values.map((value) => ({ ...combination, [option.name]: value }))), [{}]);
  }, [options]);
  const imagePreviews = useMemo(() => imageFiles.map((file) => ({ file, url: URL.createObjectURL(file) })), [imageFiles]);

  useEffect(() => () => {
    imagePreviews.forEach(({ url }) => URL.revokeObjectURL(url));
  }, [imagePreviews]);

  function generateVariants() {
    setGenerated((current) => combinations.map((optionValues, index) => {
      const key = combinationKey(optionValues);
      return current.find((item) => item.key === key) ?? { key, sku: `GYEOT-${String(index + 1).padStart(2, "0")}`, stock: 3, fulfillmentMode: "in_stock", options: optionValues };
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
    const payload = {
      name,
      slug,
      description,
      category,
      status,
      salePrice: Number(salePrice),
      originalPrice: originalPrice ? Number(originalPrice) : null,
      costPrice: costPrice ? Number(costPrice) : null,
      options,
      variants: generated.map((variant) => ({ id: variant.id, sku: variant.sku, stock: variant.stock, fulfillmentMode: variant.fulfillmentMode, options: variant.options })),
    };
    const result = initialProduct ? await updateProductAction(initialProduct.id, payload) : await createProductAction(payload);

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

    router.push(`/admin/products?${initialProduct ? "updated" : "created"}=${encodeURIComponent(result.product.slug)}${imageFiles.length ? `&images=${imageFiles.length}` : ""}`);
    router.refresh();
  }

  async function handleDeleteExistingImage(imageId: string) {
    if (!initialProduct) return;
    setPending(true);
    const result = await deleteProductImageAction({ productId: initialProduct.id, imageId });
    if (result.ok) {
      setExistingImages((current) => current.filter((image) => image.id !== imageId));
      setMessage({ type: "info", text: "商品圖片已刪除。" });
    } else {
      setMessage({ type: "error", text: result.message });
    }
    setPending(false);
  }

  const margin = Number(salePrice) - Number(costPrice || 0);
  const marginRate = Number(salePrice) > 0 ? (margin / Number(salePrice)) * 100 : 0;

  return <div className={styles.editor}>
    <div className={styles.main}>
      <section><h2>基本資料</h2><div className={`${styles.fields} ${styles.basicFields}`}>
        <div className="field"><label htmlFor="product-name">商品名稱</label><input className="input" id="product-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="field"><label htmlFor="product-slug">Slug</label><input className="input" id="product-slug" value={slug} onChange={(event) => setSlug(event.target.value)} /></div>
        <div className="field"><label htmlFor="description">商品描述</label><textarea className="input" id="description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="field"><label htmlFor="product-category">分類</label><select className="input" id="product-category" value={category} onChange={(event) => setCategory(event.target.value as ProductCategory)}>{categoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
      </div></section>
      <section><div className={styles.sectionHead}><div><h2>商品圖片</h2><p className={styles.sectionHint}>第一張會作為商品主圖，可直接預覽與移除。</p></div><label className={styles.uploadButton + " button button-secondary button-small"} htmlFor="product-images">＋ 選擇照片<input className={styles.fileInput} id="product-images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]); const valid = files.filter((file) => allowed.has(file.type) && file.size <= 5 * 1024 * 1024); setImageFiles(valid.slice(0, 8)); setMessage(valid.length === files.length && files.length <= 8 ? null : { type: "error", text: "僅接受 JPG、PNG、WebP、AVIF；單張上限 5 MB，最多 8 張。" }); event.currentTarget.value = ""; }} /></label></div>{existingImages.length > 0 && <div className={styles.imageGrid}>{existingImages.map((image) => <div className={styles.imageCard} key={image.id}><Image src={image.url} alt={`${name} 已上傳商品圖片`} width={320} height={320} unoptimized /><span className={styles.imageLabel}>{image.isPrimary ? "主圖" : "已上傳"}</span><button className={styles.removeImage} type="button" aria-label="刪除已上傳商品圖片" onClick={() => handleDeleteExistingImage(image.id)} disabled={pending}>×</button></div>)}</div>}{imagePreviews.length > 0 ? <div className={styles.imageGrid}>{imagePreviews.map(({ file, url }, imageIndex) => <div className={styles.imageCard} key={file.name + file.size + file.lastModified}><Image src={url} alt={`${name} 新增商品圖片 ${imageIndex + 1}`} width={320} height={320} unoptimized /><span className={styles.imageLabel}>{existingImages.length === 0 && imageIndex === 0 ? "主圖" : "待上傳"}</span><button className={styles.removeImage} type="button" aria-label={`移除第 ${imageIndex + 1} 張新增圖片`} onClick={() => setImageFiles((current) => current.filter((_, index) => index !== imageIndex))}>×</button></div>)}</div> : existingImages.length === 0 && <label className={styles.compactDropzone} htmlFor="product-images"><span>尚未選擇照片</span><small>點此選擇商品圖片，最多 8 張</small></label>}<p className={styles.helper}>可上傳 JPG、PNG、WebP 或 AVIF；單張上限 5 MB，最多 8 張。</p></section>
      <section><div className={styles.sectionHead}><h2>通用規格</h2><button className="button button-secondary button-small" type="button" onClick={generateVariants}>產生 Variant</button></div>
        {options.map((option, index) => <OptionEditor key={`${option.name}-${index}`} option={option} onChange={(nextOption) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? nextOption : item))} onRemove={options.length > 1 ? () => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index)) : undefined} />)}<button className="button button-secondary button-small" type="button" onClick={() => setOptions((current) => [...current, { name: `規格 ${current.length + 1}`, values: ["選項 1"] }])}>＋ 新增規格</button>
        {generated.length > 0 && <div className={styles.variantWrap}><table><thead><tr><th>規格</th><th>SKU</th><th>模式</th><th>庫存</th></tr></thead><tbody>{generated.map((variant) => <tr key={variant.key}><td>{Object.values(variant.options).join("／")}</td><td><input className="input" value={variant.sku} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, sku: event.target.value } : item))} /></td><td><select className="input" value={variant.fulfillmentMode} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, fulfillmentMode: event.target.value as FulfillmentMode } : item))}><option value="in_stock">現貨</option><option value="preorder">預購</option></select></td><td><input className="input" type="number" min="0" value={variant.stock} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, stock: Number(event.target.value) } : item))} /></td></tr>)}</tbody></table></div>}
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

function OptionEditor({ option, onChange, onRemove }: { option: DraftOption; onChange: (option: DraftOption) => void; onRemove?: () => void }) {
  const [draft, setDraft] = useState("");
  return <div className={styles.option}><div className={styles.optionHead}><input className="input" value={option.name} onChange={(event) => onChange({ ...option, name: event.target.value })} aria-label="規格名稱" /><button className={styles.removeOption} type="button" onClick={onRemove} disabled={!onRemove}>移除規格</button></div><div className={styles.chips}>{option.values.map((value) => <button type="button" key={value} onClick={() => onChange({ ...option, values: option.values.filter((item) => item !== value) })}>{value} ×</button>)}</div><div className={styles.addOption}><input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`新增${option.name || "規格"}`} /><button className="button button-secondary button-small" type="button" onClick={() => { const value = draft.trim(); if (value && !option.values.includes(value)) onChange({ ...option, values: [...option.values, value] }); setDraft(""); }}>加入</button></div></div>;
}
