import { formatTwd } from "@/lib/money";
import styles from "../admin.module.css";

export default function AdminOrdersPage() {
  return <><div className={styles.titleRow}><div><div className="eyebrow">Orders · Demo data</div><h1 className="serif">訂單管理</h1></div><button className="button button-secondary" type="button">篩選訂單</button></div><section className={styles.panel}><table className={styles.table}><thead><tr><th>訂單</th><th>顧客</th><th>類型</th><th>付款</th><th>履約</th><th>金額</th></tr></thead><tbody><tr><td>KR260822-A7K4P</td><td>王＊＊<br /><small>jo***@example.com</small></td><td>現貨</td><td><span className="badge badge-stock">已付款</span></td><td>待處理</td><td>{formatTwd(970)}</td></tr><tr><td>KR260822-C2M8Q</td><td>林＊＊<br /><small>li***@example.com</small></td><td><span className="badge badge-preorder">混合</span></td><td>待付款</td><td>未處理</td><td>{formatTwd(1370)}</td></tr></tbody></table></section></>;
}
