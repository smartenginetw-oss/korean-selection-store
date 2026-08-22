import { ProductEditor } from "@/features/catalog/admin/product-editor";
import styles from "../../admin.module.css";

export default function NewProductPage() {
  return <><div className={styles.titleRow}><div><div className="eyebrow">Catalog</div><h1 className="serif">新增商品</h1></div></div><ProductEditor /></>;
}
