"use client";

import { useState } from "react";
import { RoundedSelect } from "@/components/rounded-select";
import type { ShippingMethod } from "@/lib/shipping";
import styles from "./convenience-store-selector.module.css";

type Store = { code: string; name: string; address: string };

const stores: Record<"cvs_711" | "cvs_family", Store[]> = {
  cvs_711: [
    { code: "711-000001", name: "信義門市", address: "台北市信義區松仁路100號" },
    { code: "711-000002", name: "中山門市", address: "台北市中山區南京東路二段20號" },
    { code: "711-000003", name: "板橋門市", address: "新北市板橋區文化路一段10號" },
  ],
  cvs_family: [
    { code: "FM-000001", name: "台北車站店", address: "台北市中正區北平西路3號" },
    { code: "FM-000002", name: "松江店", address: "台北市中山區松江路88號" },
    { code: "FM-000003", name: "新埔店", address: "新北市板橋區民生路三段15號" },
  ],
};

export function ConvenienceStoreSelector({ method, onChange }: { method: ShippingMethod; onChange: (store: Store) => void }) {
  if (method !== "cvs_711" && method !== "cvs_family") return null;
  return <StorePicker method={method} onChange={onChange} />;
}

function StorePicker({ method, onChange }: { method: "cvs_711" | "cvs_family"; onChange: (store: Store) => void }) {
  const methodStores = stores[method];
  const options = methodStores.map((store) => ({ value: store.code, label: `${store.name}｜${store.address}` }));
  const firstStore = methodStores[0];
  const [selectedStore, setSelectedStore] = useState(firstStore);
  return <div className={styles.panel}>
    <div className={styles.heading}><strong>{method === "cvs_711" ? "7-ELEVEN" : "全家"} 取貨門市</strong><span>Mock 選店</span></div>
    <p>V1 使用測試選店器；正式串接超商 API 後會保留相同欄位。</p>
    <div className="field"><label htmlFor="storeCode">選擇門市</label><RoundedSelect id="storeCode" options={options} value={selectedStore.code} ariaLabel="取貨門市" onValueChange={(code) => { const store = methodStores.find((item) => item.code === code); if (store) { setSelectedStore(store); onChange(store); } }} /></div>
    <input type="hidden" name="storeCode" value={selectedStore.code} readOnly />
    <input type="hidden" name="storeName" value={selectedStore.name} readOnly />
    <input type="hidden" name="storeAddress" value={selectedStore.address} readOnly />
  </div>;
}
