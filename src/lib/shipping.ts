export const shippingMethods = ["home_delivery", "cvs_711", "cvs_family"] as const;

export type ShippingMethod = (typeof shippingMethods)[number];

export type ShippingFees = {
  shippingFee: number;
  cvs711Fee: number;
  cvsFamilyFee: number;
};

export const defaultShippingFees: ShippingFees = {
  shippingFee: 80,
  cvs711Fee: 60,
  cvsFamilyFee: 60,
};

export const shippingOptions: ReadonlyArray<{ value: ShippingMethod; label: string }> = [
  { value: "home_delivery", label: "宅配（台灣）" },
  { value: "cvs_711", label: "7-ELEVEN 超商取貨" },
  { value: "cvs_family", label: "全家超商取貨" },
];

export function isShippingMethod(value: string): value is ShippingMethod {
  return (shippingMethods as readonly string[]).includes(value);
}

export function shippingMethodLabel(value: string | null | undefined) {
  return shippingOptions.find((option) => option.value === value)?.label ?? "配送方式";
}

export function shippingFeeFor(method: ShippingMethod, fees: ShippingFees) {
  if (method === "cvs_711") return fees.cvs711Fee;
  if (method === "cvs_family") return fees.cvsFamilyFee;
  return fees.shippingFee;
}

export function isConvenienceStoreMethod(method: ShippingMethod) {
  return method === "cvs_711" || method === "cvs_family";
}
