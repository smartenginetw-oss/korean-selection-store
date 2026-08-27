import Link from "next/link";
import { formatTwd } from "@/lib/money";
import { getAdminReports, type ReportCashflow, type ReportGranularity } from "@/features/reports/admin/server";
import { MonthPicker, ReportFilters } from "./report-filters";
import { upsertOperatingExpenseAction } from "./actions";
import styles from "./reports.module.css";
import adminStyles from "../admin.module.css";

export default async function AdminReportsPage({ searchParams }: { searchParams?: Promise<{ start?: string | string[]; end?: string | string[]; granularity?: string | string[]; cashflow?: string | string[]; expenseSaved?: string | string[]; expenseError?: string | string[] }> }) {
  const params = searchParams ? await searchParams : {};
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const filters = { start: first(params.start), end: first(params.end), granularity: first(params.granularity), cashflow: first(params.cashflow) };
  const { report, error } = await getAdminReports(filters);
  const expenseSaved = first(params.expenseSaved) === "1";
  const expenseError = first(params.expenseError);
  const granularityLabel: Record<ReportGranularity, string> = { day: "每日", month: "每月", year: "每年" };
  const cashflowLabel: Record<ReportCashflow, string> = { income: "收入", expense: "支出", net: "淨收支" };

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">報表・彈性期間</div><h1 className="serif">報表分析</h1></div>{report && <div className={styles.titleActions}><span className={styles.period}>{report.periodLabel} · {granularityLabel[report.granularity]}</span><Link className="button button-secondary button-small" href={`/admin/reports/export?start=${report.startDate}&end=${report.endDate}&granularity=${report.granularity}&cashflow=${report.cashflow}`}>下載 CSV</Link></div>}</div>
    {error && <div className={adminStyles.notice}>{error}</div>}
    {expenseSaved && <div className={adminStyles.notice}>月份營業費用已更新，報表已重新計算。</div>}
    {expenseError && <div className={adminStyles.notice}>{expenseError}</div>}
    {report && <>
      <ReportFilters startDate={report.startDate} endDate={report.endDate} granularity={report.granularity} cashflow={report.cashflow} />
      <section className={styles.metricGrid} aria-label="營運摘要">
        <div className={styles.metric}><span>有效訂單</span><strong>{report.metrics.orderCount}</strong><small>近 30 天</small></div>
        <div className={styles.metric}><span>已付款訂單</span><strong>{report.metrics.paidOrderCount}</strong><small>不含取消</small></div>
        <div className={styles.metric}><span>收入</span><strong>{formatTwd(report.metrics.revenue)}</strong><small>已付款訂單含運費</small></div>
        <div className={styles.metric}><span>支出</span><strong>{formatTwd(report.metrics.expense)}</strong><small>商品成本＋營業費用</small></div>
        <div className={styles.metric}><span>營業費用</span><strong>{formatTwd(report.metrics.operatingExpense)}</strong><small>依月份分攤</small></div>
        <div className={styles.metric}><span>淨收支</span><strong>{formatTwd(report.metrics.netCashflow)}</strong><small>收入 − 全部支出</small></div>
        <div className={styles.metric}><span>平均客單價</span><strong>{formatTwd(report.metrics.averageOrderValue)}</strong><small>以已付款訂單計算</small></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>{granularityLabel[report.granularity]}{cashflowLabel[report.cashflow]}趨勢</h2><span>含商品成本與月份營業費用</span></div>
        <div className={styles.chart} aria-label={`${granularityLabel[report.granularity]}${cashflowLabel[report.cashflow]}長條圖`}>
          {report.trend.map((day) => { const value = { income: day.revenue, expense: day.expense, net: day.netCashflow }[report.cashflow]; const max = Math.max(...report.trend.map((item) => Math.abs({ income: item.revenue, expense: item.expense, net: item.netCashflow }[report.cashflow])), 1); const height = value ? Math.max(8, Math.round((Math.abs(value) / max) * 100)) : 3; return <div className={styles.barItem} key={day.date} title={`${day.label}：${formatTwd(value)}／${day.orders} 筆`}><div className={styles.barTrack}><span className={`${styles.bar} ${value < 0 ? styles.barNegative : ""}`} style={{ height: `${height}%` }} /></div><small>{day.label}</small></div>; })}
        </div>
      </section>

      <section className={styles.panel}><div className={styles.panelHeading}><div><h2>月份營業費用</h2><span>租金、運費、廣告、包材與其他支出</span></div><span>以 {report.endDate.slice(0, 7)} 為預設月份</span></div>{(() => { const month = report.endDate.slice(0, 7); const expense = report.operatingExpenses.find((item) => item.month === month); return report.canEditOperatingExpenses ? <form action={upsertOperatingExpenseAction} className={styles.expenseForm}><input type="hidden" name="return_start" value={report.startDate} /><input type="hidden" name="return_end" value={report.endDate} /><input type="hidden" name="return_granularity" value={report.granularity} /><input type="hidden" name="return_cashflow" value={report.cashflow} /><label>月份<MonthPicker name="periodMonth" value={month} /></label><label>租金<input className="input" type="number" name="rentCost" min="0" step="1" defaultValue={expense?.rentCost ?? 0} /></label><label>運費<input className="input" type="number" name="shippingCost" min="0" step="1" defaultValue={expense?.shippingCost ?? 0} /></label><label>廣告<input className="input" type="number" name="advertisingCost" min="0" step="1" defaultValue={expense?.advertisingCost ?? 0} /></label><label>包材<input className="input" type="number" name="packagingCost" min="0" step="1" defaultValue={expense?.packagingCost ?? 0} /></label><label>其他<input className="input" type="number" name="otherCost" min="0" step="1" defaultValue={expense?.otherCost ?? 0} /></label><label className={styles.expenseNotes}>備註<input className="input" type="text" name="notes" maxLength={500} defaultValue={expense?.notes ?? ""} placeholder="例如：本月廣告投放" /></label><button className="button button-primary" type="submit">儲存月份費用</button></form> : <p className={adminStyles.empty}>目前帳號可查看報表，但只有老闆／全營運員工可以修改月份營業費用。</p>})()}<p className={styles.costNote}>報表會依所選日期範圍計算；每日統計會按月份天數分攤營業費用。</p></section>

      <div className={styles.split}>
        <section className={styles.panel}><div className={styles.panelHeading}><h2>訂單組成</h2><span>依供貨模式</span></div><div className={styles.list}>{report.stockModes.map((item) => <div className={styles.listRow} key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>)}</div></section>
        <section className={styles.panel}><div className={styles.panelHeading}><h2>履約狀態</h2><span>目前有效訂單</span></div><div className={styles.list}>{report.fulfillment.length ? report.fulfillment.map((item) => <div className={styles.listRow} key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>) : <p className={adminStyles.empty}>目前沒有訂單。</p>}</div></section>
      </div>

      <section className={styles.panel}><div className={styles.panelHeading}><h2>熱賣商品</h2><span>依商品小計排序</span></div>{report.topProducts.length ? <div className={styles.productList}>{report.topProducts.map((item, index) => <div className={styles.productRow} key={item.name}><span className={styles.rank}>0{index + 1}</span><div><strong>{item.name}</strong><small>{item.quantity} 件</small></div><b>{formatTwd(item.revenue)}</b></div>)}</div> : <p className={adminStyles.empty}>目前沒有商品銷售資料。</p>}<p className={styles.costNote}>商品成本覆蓋率：{report.metrics.costCoverage}%；尚未填成本的商品不會計入支出。</p></section>
    </>}
  </>;
}
