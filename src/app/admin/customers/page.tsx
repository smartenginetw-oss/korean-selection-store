import { getAdminCustomers } from "@/features/customers/admin/server";
import { formatTwd } from "@/lib/money";
import styles from "../admin.module.css";

export default async function AdminCustomersPage() {
  const { customers, metrics, error } = await getAdminCustomers();

  return <>
    <div className={styles.titleRow}>
      <div><div className="eyebrow">顧客・隱私防護</div><h1 className="serif">顧客管理</h1></div>
      {metrics && <div className={styles.inventorySummary}><span>顧客 {metrics.customerCount}</span><span>有效訂單 {metrics.orderCount}</span><span>累積訂單額 {formatTwd(metrics.totalSpent)}</span></div>}
    </div>
    {error && <div className={styles.notice}>{error}</div>}
    <section className={styles.panel}>
      <p className={styles.panelIntro}>列表只顯示遮罩後的聯絡資訊；完整個資僅在必要的訂單履約流程中由授權人員查看。</p>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr><th>顧客（已遮罩）</th><th>電話（已遮罩）</th><th>訂單數</th><th>累積金額</th><th>最近訂單</th></tr></thead>
          <tbody>{customers.map((customer) => <tr key={`${customer.email}-${customer.phone}`}>
            <td><strong>{customer.name}</strong><br /><small>{customer.email}</small></td>
            <td>{customer.phone}</td>
            <td>{customer.orderCount}</td>
            <td>{formatTwd(customer.totalSpent)}</td>
            <td>{new Date(customer.lastOrderAt).toLocaleDateString("zh-TW")}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {!customers.length && !error && <p className={styles.empty}>目前尚無顧客訂單資料。</p>}
    </section>
  </>;
}
