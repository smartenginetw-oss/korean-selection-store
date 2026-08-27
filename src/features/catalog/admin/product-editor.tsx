"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import { createProductAction, deleteProductImageAction, registerProductImagesAction, updateProductAction, updateProductDetailsAction, updateProductFinancialsAction, updateProductImageAction, updateProductTagsAction } from "@/app/admin/products/actions";
import { RoundedSelect } from "@/components/rounded-select";
import type { AdminCategoryOption, AdminProductEditorData } from "./server";
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

const categoryOptions: { value: string; label: string }[] = [
  { value: "tops", label: "上衣" },
  { value: "bottoms", label: "下身" },
  { value: "outerwear", label: "外套" },
  { value: "accessories", label: "配件" },
];
const fulfillmentOptions = [{ value: "in_stock", label: "現貨" }, { value: "preorder", label: "預購" }] as const;
const productStateOptions = [{ value: "draft", label: "草稿" }, { value: "active", label: "上架" }] as const;

function combinationKey(options: Record<string, string>) {
  return Object.entries(options).sort(([left], [right]) => left.localeCompare(right)).map(([name, value]) => `${name}:${value}`).join("|");
}

export function ProductEditor({ initialProduct, categories = [] }: { initialProduct?: AdminProductEditorData; categories?: AdminCategoryOption[] }) {
  const router = useRouter();
  const [name, setName] = useState(initialProduct?.name ?? "韓國針織上衣");
  const [slug, setSlug] = useState(initialProduct?.slug ?? "soft-oversize-knit");
  const [description, setDescription] = useState(initialProduct?.description ?? "柔軟細緻的針織面料，帶有恰好的寬鬆輪廓。");
  const [category, setCategory] = useState(initialProduct?.category ?? categories[0]?.slug ?? "tops");
  const [status, setStatus] = useState<"draft" | "active" | "archived">(initialProduct?.status ?? "draft");
  const [tags, setTags] = useState(initialProduct?.tags.filter((tag) => tag !== initialProduct.category).join(", ") ?? "");
  const [salePrice, setSalePrice] = useState(String(initialProduct?.salePrice ?? 890));
  const [originalPrice, setOriginalPrice] = useState(initialProduct?.originalPrice == null ? "" : String(initialProduct.originalPrice));
  const [costPrice, setCostPrice] = useState(initialProduct?.costPrice == null ? "" : String(initialProduct.costPrice));
  const [rentCost, setRentCost] = useState(String(initialProduct?.allocatedRentCost ?? 0));
  const [shippingCost, setShippingCost] = useState(String(initialProduct?.allocatedShippingCost ?? 0));
  const [advertisingCost, setAdvertisingCost] = useState(String(initialProduct?.allocatedAdCost ?? 0));
  const [packagingCost, setPackagingCost] = useState(String(initialProduct?.allocatedPackagingCost ?? 0));
  const [otherOperatingCost, setOtherOperatingCost] = useState(String(initialProduct?.allocatedOtherCost ?? 0));
  const [material, setMaterial] = useState(initialProduct?.material ?? "");
  const [sizeGuide, setSizeGuide] = useState(initialProduct?.sizeGuide ?? "");
  const [modelInfo, setModelInfo] = useState(initialProduct?.modelInfo ?? "");
  const [origin, setOrigin] = useState(initialProduct?.origin ?? "韓國");
  const [careInstructions, setCareInstructions] = useState(initialProduct?.careInstructions ?? "");
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
    if (initialProduct?.status === "archived") {
      setMessage({ type: "error", text: "封存商品目前不可直接儲存，請先回到商品列表恢復草稿。" });
      return;
    }
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

    const detailsResult = await updateProductDetailsAction(result.product.id, { material, sizeGuide, modelInfo, origin, careInstructions });
    if (!detailsResult.ok) {
      setMessage({ type: "error", text: detailsResult.message });
      setPending(false);
      return;
    }

    const tagValues = Array.from(new Set(tags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
    const tagsResult = await updateProductTagsAction({ productId: result.product.id, tags: tagValues });
    if (!tagsResult.ok) {
      setMessage({ type: "error", text: `商品已儲存，但${tagsResult.message}` });
      setPending(false);
      return;
    }

    const financialsResult = await updateProductFinancialsAction(result.product.id, {
      rentCost: Number(rentCost || 0),
      shippingCost: Number(shippingCost || 0),
      advertisingCost: Number(advertisingCost || 0),
      packagingCost: Number(packagingCost || 0),
      otherOperatingCost: Number(otherOperatingCost || 0),
    });
    if (!financialsResult.ok) {
      setMessage({ type: "error", text: `商品已儲存，但${financialsResult.message}` });
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

  async function handleUpdateExistingImage(image: AdminProductEditorData["images"][number], next: Partial<AdminProductEditorData["images"][number]>) {
    if (!initialProduct) return;
    setPending(true);
    const result = await updateProductImageAction({
      productId: initialProduct.id,
      imageId: image.id,
      altText: next.altText ?? image.altText,
      sortOrder: next.sortOrder ?? image.sortOrder,
      isPrimary: next.isPrimary ?? image.isPrimary,
    });
    if (result.ok) {
      setExistingImages((current) => current.map((item) => ({ ...item, ...(item.id === image.id ? next : next.isPrimary ? { isPrimary: false } : {}) })));
      setMessage({ type: "info", text: "圖片設定已更新。" });
    } else setMessage({ type: "error", text: result.message });
    setPending(false);
  }

  const availableCategories = categories.length ? categories : categoryOptions.map((option) => ({ id: option.value, name: option.label, slug: option.value }));

  const parsedSalePrice = Number(salePrice);
  const parsedCostPrice = costPrice.trim() === "" ? null : Number(costPrice);
  const operatingExpenseTotal = [rentCost, shippingCost, advertisingCost, packagingCost, otherOperatingCost]
    .reduce((total, value) => total + (Number.isFinite(Number(value)) ? Number(value) : 0), 0);
  const grossProfit = parsedCostPrice == null || !Number.isFinite(parsedCostPrice) ? null : parsedSalePrice - parsedCostPrice;
  const grossMarginRate = grossProfit == null || parsedSalePrice <= 0 ? null : (grossProfit / parsedSalePrice) * 100;
  const netProfit = grossProfit == null ? null : grossProfit - operatingExpenseTotal;
  const netMarginRate = netProfit == null || parsedSalePrice <= 0 ? null : (netProfit / parsedSalePrice) * 100;
  const formatFinancialAmount = (value: number | null) => value == null || !Number.isFinite(value) ? "—" : `NT$${Math.round(value).toLocaleString("zh-TW")}`;
  const formatFinancialRate = (value: number | null) => value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(1)}%`;

  return <div className={styles.editor}>
    <div className={styles.main}>
      <section><h2>基本資料</h2><div className={`${styles.fields} ${styles.basicFields}`}>
        <div className="field"><label htmlFor="product-name">商品名稱</label><input className="input" id="product-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
        <div className="field"><label htmlFor="product-slug">Slug</label><input className="input" id="product-slug" value={slug} onChange={(event) => setSlug(event.target.value)} /></div>
        <div className="field"><label htmlFor="description">商品描述</label><textarea className="input" id="description" rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="field"><label htmlFor="product-category">分類</label><RoundedSelect id="product-category" options={availableCategories.map((option) => ({ value: option.slug, label: option.name }))} value={category} onValueChange={setCategory} ariaLabel="商品分類" /></div>
        <div className="field"><label htmlFor="product-tags">商品標籤</label><input className="input" id="product-tags" value={tags} onChange={(event) => setTags(event.target.value)} maxLength={480} placeholder="例如：new, essential, pre-order" /><p className={styles.fieldHint}>以逗號分隔；標籤會轉成小寫，分類會由系統保留。</p></div>
      </div></section>
      <section><h2>商品資訊</h2><p className={styles.sectionHint}>這些資訊會直接呈現在商品詳細頁，請填寫實際商品資料。</p><div className={styles.fields}>
        <div className="field"><label htmlFor="material">材質</label><textarea className="input" id="material" rows={3} maxLength={2000} value={material} onChange={(event) => setMaterial(event.target.value)} placeholder="例如：韓國進口棉混紡，柔軟親膚。" /><p className={styles.fieldHint}>請填寫實際面料與觸感，前台會顯示在「材質與保養」。</p></div>
        <div className="field"><label htmlFor="size-guide">尺寸表／尺寸資訊</label><textarea className="input" id="size-guide" rows={5} maxLength={4000} value={sizeGuide} onChange={(event) => setSizeGuide(event.target.value)} placeholder={'建議每行一個尺寸，例如：\nS｜肩寬 54｜胸寬 58｜衣長 68 cm\nM｜肩寬 56｜胸寬 60｜衣長 70 cm'} /><p className={styles.fieldHint}>可直接貼上韓國供應商的平量尺寸表；前台會保留換行。</p></div>
        <div className="field"><label htmlFor="model-info">Model 穿著資訊</label><textarea className="input" id="model-info" rows={3} maxLength={1000} value={modelInfo} onChange={(event) => setModelInfo(event.target.value)} placeholder="例如：Model 178 cm／68 kg，穿著 M；版型偏寬鬆。" /><p className={styles.fieldHint}>只填已確認的身高、體重與穿著尺寸，避免讓客人誤解。</p></div>
        <div className="field"><label htmlFor="origin">產地</label><input className="input" id="origin" maxLength={200} value={origin} onChange={(event) => setOrigin(event.target.value)} /></div>
        <div className="field"><label htmlFor="care-instructions">洗滌方式</label><textarea className="input" id="care-instructions" rows={2} maxLength={2000} value={careInstructions} onChange={(event) => setCareInstructions(event.target.value)} placeholder="例如：反面冷水手洗，平放陰乾。" /></div>
      </div></section>
      <section><div className={styles.sectionHead}><div><h2>商品圖片</h2><p className={styles.sectionHint}>第一張會作為商品主圖，可直接修改排序、替代文字與移除。</p></div><label className={styles.uploadButton + " button button-secondary button-small"} htmlFor="product-images">＋ 選擇照片<input className={styles.fileInput} id="product-images" type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={(event) => { const files = Array.from(event.target.files ?? []); const allowed = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]); const valid = files.filter((file) => allowed.has(file.type) && file.size <= 5 * 1024 * 1024); setImageFiles(valid.slice(0, 8)); setMessage(valid.length === files.length && files.length <= 8 ? null : { type: "error", text: "僅接受 JPG、PNG、WebP、AVIF；單張上限 5 MB，最多 8 張。" }); event.currentTarget.value = ""; }} /></label></div>{existingImages.length > 0 && <div className={styles.imageGrid}>{existingImages.map((image) => <div className={styles.imageCard} key={image.id}><Image src={image.url} alt={image.altText || `${name} 已上傳商品圖片`} width={320} height={320} /><span className={styles.imageLabel}>{image.isPrimary ? "主圖" : "已上傳"}</span><button className={styles.removeImage} type="button" aria-label="刪除已上傳商品圖片" onClick={() => handleDeleteExistingImage(image.id)} disabled={pending}>×</button><div className={styles.imageControls}><label>替代文字<input className="input" value={image.altText} maxLength={200} onChange={(event) => setExistingImages((current) => current.map((item) => item.id === image.id ? { ...item, altText: event.target.value } : item))} /></label><label>排序<input className="input" type="number" min={0} max={100} value={image.sortOrder} onChange={(event) => setExistingImages((current) => current.map((item) => item.id === image.id ? { ...item, sortOrder: Number(event.target.value) } : item))} /></label><div className={styles.imageActions}><button className="button button-secondary button-small" type="button" onClick={() => handleUpdateExistingImage(image, { altText: image.altText, sortOrder: image.sortOrder, isPrimary: image.isPrimary })} disabled={pending}>儲存設定</button><button className="button button-secondary button-small" type="button" onClick={() => handleUpdateExistingImage(image, { altText: image.altText, sortOrder: image.sortOrder, isPrimary: true })} disabled={pending || image.isPrimary}>設為主圖</button></div></div></div>)}</div>}{imagePreviews.length > 0 ? <div className={styles.imageGrid}>{imagePreviews.map(({ file, url }, imageIndex) => <div className={styles.imageCard} key={file.name + file.size + file.lastModified}><Image src={url} alt={`${name} 新增商品圖片 ${imageIndex + 1}`} width={320} height={320} unoptimized /><span className={styles.imageLabel}>{existingImages.length === 0 && imageIndex === 0 ? "主圖" : "待上傳"}</span><button className={styles.removeImage} type="button" aria-label={`移除第 ${imageIndex + 1} 張新增圖片`} onClick={() => setImageFiles((current) => current.filter((_, index) => index !== imageIndex))}>×</button></div>)}</div> : existingImages.length === 0 && <label className={styles.compactDropzone} htmlFor="product-images"><span>尚未選擇照片</span><small>點此選擇商品圖片，最多 8 張</small></label>}<p className={styles.helper}>可上傳 JPG、PNG、WebP 或 AVIF；單張上限 5 MB，最多 8 張。</p></section>
      <section><div className={styles.sectionHead}><h2>通用規格</h2><button className="button button-secondary button-small" type="button" onClick={generateVariants}>產生 Variant</button></div>
        {options.map((option, index) => <OptionEditor key={`${option.name}-${index}`} option={option} onChange={(nextOption) => setOptions((current) => current.map((item, itemIndex) => itemIndex === index ? nextOption : item))} onRemove={options.length > 1 ? () => setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index)) : undefined} />)}<button className="button button-secondary button-small" type="button" onClick={() => setOptions((current) => [...current, { name: `規格 ${current.length + 1}`, values: ["選項 1"] }])}>＋ 新增規格</button>
        {generated.length > 0 && <div className={styles.variantWrap}><table><thead><tr><th>規格</th><th>SKU</th><th>模式</th><th>庫存</th></tr></thead><tbody>{generated.map((variant) => <tr key={variant.key}><td>{Object.values(variant.options).join("／")}</td><td><input className="input" value={variant.sku} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, sku: event.target.value } : item))} /></td><td><RoundedSelect options={fulfillmentOptions} value={variant.fulfillmentMode} onValueChange={(value) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, fulfillmentMode: value as FulfillmentMode } : item))} ariaLabel={`${variant.sku} 庫存模式`} /></td><td><input className="input" type="number" min="0" value={variant.stock} onChange={(event) => setGenerated((current) => current.map((item) => item.key === variant.key ? { ...item, stock: Number(event.target.value) } : item))} /></td></tr>)}</tbody></table></div>}
      </section>
    </div>
    <aside className={styles.side}>
      <section><h2>商品狀態</h2>{status === "archived" ? <><span className="badge badge-preorder">封存</span><p className={styles.fieldHint}>封存商品不會出現在商城。若要修改並重新上架，請回到商品列表先恢復草稿。</p></> : <RoundedSelect options={productStateOptions} value={status} onValueChange={(value) => setStatus(value as "draft" | "active")} ariaLabel="商品狀態" />}</section>
      <section><h2>定價與利潤</h2><div className={styles.fields}><div className="field"><label htmlFor="sale-price">售價 NT$</label><input className="input" id="sale-price" type="number" min="1" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} /></div><div className="field"><label htmlFor="original-price">原價 NT$（選填）</label><input className="input" id="original-price" type="number" min="0" value={originalPrice} onChange={(event) => setOriginalPrice(event.target.value)} /></div><div className="field"><label htmlFor="cost-price">進貨成本 NT$</label><input className="input" id="cost-price" type="number" min="0" value={costPrice} onChange={(event) => setCostPrice(event.target.value)} /><p className={styles.fieldHint}>用於毛利與淨利計算；未填寫時不會假設成本為 0。</p></div></div><div className={styles.expenseBlock}><div className={styles.expenseHeading}><strong>營業費用（單件分攤）</strong><span>用於淨利估算</span></div><div className={styles.expenseGrid}><label>租金分攤<input className="input" type="number" min="0" value={rentCost} onChange={(event) => setRentCost(event.target.value)} /></label><label>運費成本<input className="input" type="number" min="0" value={shippingCost} onChange={(event) => setShippingCost(event.target.value)} /></label><label>廣告成本<input className="input" type="number" min="0" value={advertisingCost} onChange={(event) => setAdvertisingCost(event.target.value)} /></label><label>包材成本<input className="input" type="number" min="0" value={packagingCost} onChange={(event) => setPackagingCost(event.target.value)} /></label><label>其他營業費用<input className="input" type="number" min="0" value={otherOperatingCost} onChange={(event) => setOtherOperatingCost(event.target.value)} /></label></div><p className={styles.fieldHint}>請填每件商品應分攤的金額；例如每月租金 ÷ 預估銷量。</p></div><div className={styles.financialSummary} aria-live="polite"><div className={styles.financialMetric}><span>毛利</span><strong>{formatFinancialAmount(grossProfit)}</strong><small>毛利率 {formatFinancialRate(grossMarginRate)}</small></div><div className={styles.financialMetric}><span>營業費用合計</span><strong>{formatFinancialAmount(operatingExpenseTotal)}</strong><small>單件分攤</small></div><div className={styles.financialMetric}><span>淨利</span><strong>{formatFinancialAmount(netProfit)}</strong><small>售價 − 成本 − 費用</small></div><div className={styles.financialMetric}><span>淨利率</span><strong>{formatFinancialRate(netMarginRate)}</strong><small>淨利 ÷ 售價</small></div></div></section>
      {message && <p className={message.type === "error" ? styles.error : styles.info} role={message.type === "error" ? "alert" : undefined}>{message.text}</p>}
      <button className="button button-primary" type="button" onClick={handleSave} disabled={pending || status === "archived"}>{pending ? "儲存中…" : status === "archived" ? "封存中不可儲存" : "儲存商品"}</button><p className={styles.helper}>儲存會建立商品、規格、Variant、庫存與審計紀錄。</p>
    </aside>
  </div>;
}

function OptionEditor({ option, onChange, onRemove }: { option: DraftOption; onChange: (option: DraftOption) => void; onRemove?: () => void }) {
  const [draft, setDraft] = useState("");
  return <div className={styles.option}><div className={styles.optionHead}><input className="input" value={option.name} onChange={(event) => onChange({ ...option, name: event.target.value })} aria-label="規格名稱" /><button className={styles.removeOption} type="button" onClick={onRemove} disabled={!onRemove}>移除規格</button></div><div className={styles.chips}>{option.values.map((value) => <button type="button" key={value} onClick={() => onChange({ ...option, values: option.values.filter((item) => item !== value) })}>{value} ×</button>)}</div><div className={styles.addOption}><input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`新增${option.name || "規格"}`} /><button className="button button-secondary button-small" type="button" onClick={() => { const value = draft.trim(); if (value && !option.values.includes(value)) onChange({ ...option, values: [...option.values, value] }); setDraft(""); }}>加入</button></div></div>;
}
