import { notFound } from "next/navigation";

import { ProductEditor } from "@/features/catalog/admin/product-editor";
import { getAdminCategories, getAdminProductEditorData } from "@/features/catalog/admin/server";
import styles from "../../../admin.module.css";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ product, error }, categories] = await Promise.all([getAdminProductEditorData(id), getAdminCategories()]);
  if (!product) {
    if (error) notFound();
    notFound();
  }

  return <><div className={styles.titleRow}><div><div className="eyebrow">商品・資料庫</div><h1 className="serif">編輯商品</h1></div></div><ProductEditor initialProduct={product} categories={categories} /></>;
}
