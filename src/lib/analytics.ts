export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_variant?: string;
};

type AnalyticsParams = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: string, eventName: string, params?: AnalyticsParams) => void;
  }
}

export function trackEvent(eventName: string, params: AnalyticsParams = {}) {
  if (typeof window === "undefined") return;
  if (typeof window.gtag === "function") {
    window.gtag("event", eventName, params);
    return;
  }
  // Keep events queued during the short gap before the optional GA script loads.
  if (Array.isArray(window.dataLayer)) window.dataLayer.push(["event", eventName, params]);
}

export function toAnalyticsItem(item: { id: string; name: string; price: number; quantity?: number; variant?: string }): AnalyticsItem {
  return {
    item_id: item.id,
    item_name: item.name,
    price: item.price,
    quantity: item.quantity ?? 1,
    ...(item.variant ? { item_variant: item.variant } : {}),
  };
}
