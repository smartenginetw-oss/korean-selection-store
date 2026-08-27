import { ProductEditor } from "@/features/catalog/admin/product-editor";
import { getAdminCategories } from "@/features/catalog/admin/server";
import styles from "../../admin.module.css";

export default async function NewProductPage() {
  const categories = await getAdminCategories();
  return <><div className={styles.titleRow}><div><div className="eyebrow">商品</div><h1 className="serif">新增商品</h1></div></div><ProductEditor categories={categories} /></>;
}
