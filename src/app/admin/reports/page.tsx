import { formatTwd } from "@/lib/money";
import { getAdminReports, type ReportGranularity } from "@/features/reports/admin/server";
import { ReportFilters } from "./report-filters";
import styles from "./reports.module.css";
import adminStyles from "../admin.module.css";

export default async function AdminReportsPage({ searchParams }: { searchParams?: Promise<{ start?: string | string[]; end?: string | string[]; granularity?: string | string[] }> }) {
  const params = searchParams ? await searchParams : {};
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const filters = { start: first(params.start), end: first(params.end), granularity: first(params.granularity) };
  const { report, error } = await getAdminReports(filters);
  const granularityLabel: Record<ReportGranularity, string> = { day: "每日", month: "每月", year: "每年" };

  return <>
    <div className={adminStyles.titleRow}><div><div className="eyebrow">Reports · Flexible period</div><h1 className="serif">報表分析</h1></div>{report && <span className={styles.period}>{report.periodLabel} · {granularityLabel[report.granularity]}</span>}</div>
    {error && <div className={adminStyles.notice}>{error}</div>}
    {report && <>
      <ReportFilters startDate={report.startDate} endDate={report.endDate} granularity={report.granularity} />
      <section className={styles.metricGrid} aria-label="營運摘要">
        <div className={styles.metric}><span>有效訂單</span><strong>{report.metrics.orderCount}</strong><small>近 30 天</small></div>
        <div className={styles.metric}><span>已付款訂單</span><strong>{report.metrics.paidOrderCount}</strong><small>不含取消</small></div>
        <div className={styles.metric}><span>已付款營收</span><strong>{formatTwd(report.metrics.revenue)}</strong><small>測試付款資料</small></div>
        <div className={styles.metric}><span>平均客單價</span><strong>{formatTwd(report.metrics.averageOrderValue)}</strong><small>以已付款訂單計算</small></div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeading}><h2>{granularityLabel[report.granularity]}營收趨勢</h2><span>以已付款訂單計算</span></div>
        <div className={styles.chart} aria-label={`${granularityLabel[report.granularity]}營收長條圖`}>
          {report.trend.map((day) => { const max = Math.max(...report.trend.map((item) => item.revenue), 1); const height = day.revenue ? Math.max(8, Math.round((day.revenue / max) * 100)) : 3; return <div className={styles.barItem} key={day.date} title={`${day.label}：${formatTwd(day.revenue)}／${day.orders} 筆`}><div className={styles.barTrack}><span className={styles.bar} style={{ height: `${height}%` }} /></div><small>{day.label}</small></div>; })}
        </div>
      </section>

      <div className={styles.split}>
        <section className={styles.panel}><div className={styles.panelHeading}><h2>訂單組成</h2><span>依供貨模式</span></div><div className={styles.list}>{report.stockModes.map((item) => <div className={styles.listRow} key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>)}</div></section>
        <section className={styles.panel}><div className={styles.panelHeading}><h2>履約狀態</h2><span>目前有效訂單</span></div><div className={styles.list}>{report.fulfillment.length ? report.fulfillment.map((item) => <div className={styles.listRow} key={item.label}><span>{item.label}</span><strong>{item.count}</strong></div>) : <p className={adminStyles.empty}>目前沒有訂單。</p>}</div></section>
      </div>

      <section className={styles.panel}><div className={styles.panelHeading}><h2>熱賣商品</h2><span>依商品小計排序</span></div>{report.topProducts.length ? <div className={styles.productList}>{report.topProducts.map((item, index) => <div className={styles.productRow} key={item.name}><span className={styles.rank}>0{index + 1}</span><div><strong>{item.name}</strong><small>{item.quantity} 件</small></div><b>{formatTwd(item.revenue)}</b></div>)}</div> : <p className={adminStyles.empty}>目前沒有商品銷售資料。</p>}</section>
    </>}
  </>;
}
