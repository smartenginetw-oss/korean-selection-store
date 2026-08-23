export const BACKOFFICE_ROLES = ["admin", "staff", "catalog_staff", "order_staff"] as const;
export type BackofficeRole = (typeof BACKOFFICE_ROLES)[number];

export const EMPLOYEE_ROLES = ["staff", "catalog_staff", "order_staff"] as const;
export type EmployeeRole = (typeof EMPLOYEE_ROLES)[number];

export type BackofficeCapability = "catalog" | "inventory" | "orders" | "customers" | "coupons" | "content" | "reports" | "settings" | "staff";

export function isBackofficeRole(value: unknown): value is BackofficeRole {
  return typeof value === "string" && (BACKOFFICE_ROLES as readonly string[]).includes(value);
}

export function isEmployeeRole(value: unknown): value is EmployeeRole {
  return typeof value === "string" && (EMPLOYEE_ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: BackofficeRole) {
  if (role === "admin") return "老闆";
  if (role === "staff") return "全營運員工";
  if (role === "catalog_staff") return "商品／庫存";
  return "訂單／客服";
}

export function roleDescription(role: BackofficeRole) {
  if (role === "admin") return "全部後台與團隊管理";
  if (role === "staff") return "商品、訂單、顧客、優惠碼、內容與報表";
  if (role === "catalog_staff") return "商品上架、商品圖片與庫存";
  return "訂單履約、顧客、優惠碼與報表";
}

export function canAccess(role: BackofficeRole, capability: BackofficeCapability) {
  if (role === "admin") return true;
  if (role === "staff") return capability !== "settings" && capability !== "staff";
  if (role === "catalog_staff") return capability === "catalog" || capability === "inventory";
  return capability === "orders" || capability === "customers" || capability === "coupons" || capability === "reports";
}
