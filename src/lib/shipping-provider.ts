import type { ShippingMethod } from "@/lib/shipping";

/**
 * Shipment lifecycle values shared by the mock adapter and future carrier
 * integrations. The database keeps these values as text so a provider can
 * add metadata without changing the checkout contract.
 */
export const shipmentStatuses = [
  "pending",
  "ready",
  "preparing",
  "shipped",
  "in_transit",
  "delivered",
  "returned",
  "cancelled",
  "exception",
] as const;

export type ShipmentStatus = (typeof shipmentStatuses)[number];

export type ShipmentRequest = {
  orderId: string;
  shippingMethod: ShippingMethod;
  recipientName?: string;
  recipientPhone?: string;
  postalCode?: string;
  city?: string;
  district?: string;
  addressLine?: string;
  storeCode?: string;
  storeName?: string;
  storeAddress?: string;
};

export type ShipmentRecord = {
  provider: string;
  trackingNumber: string | null;
  status: ShipmentStatus;
};

export interface ShippingProvider {
  createShipment(request: ShipmentRequest): Promise<ShipmentRecord>;
  cancelShipment(trackingNumber: string): Promise<ShipmentRecord>;
  getShipmentStatus(trackingNumber: string): Promise<ShipmentStatus>;
  getTrackingInfo(trackingNumber: string): Promise<ShipmentRecord>;
}

/**
 * V1 provider. It intentionally does not call a carrier API: it gives the
 * application a stable contract and deterministic tracking numbers for local
 * checkout and admin-flow tests. Replace this class with ECPay/CVS adapters
 * when their credentials and official APIs are enabled.
 */
export class MockShippingProvider implements ShippingProvider {
  async createShipment(request: ShipmentRequest): Promise<ShipmentRecord> {
    return {
      provider: "mock",
      trackingNumber: `MOCK-${request.orderId.replaceAll("-", "").slice(0, 12).toUpperCase()}`,
      status: "pending",
    };
  }

  async cancelShipment(trackingNumber: string): Promise<ShipmentRecord> {
    return { provider: "mock", trackingNumber, status: "cancelled" };
  }

  async getShipmentStatus(): Promise<ShipmentStatus> {
    return "pending";
  }

  async getTrackingInfo(trackingNumber: string): Promise<ShipmentRecord> {
    return { provider: "mock", trackingNumber, status: "pending" };
  }
}

export const mockShippingProvider = new MockShippingProvider();
