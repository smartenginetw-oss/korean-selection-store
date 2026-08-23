import { getStoreSettings } from "@/lib/store-settings";
import CartPage from "./cart-page";

export const dynamic = "force-dynamic";

export default async function CartRoute() {
  const settings = await getStoreSettings();
  return <CartPage shippingFee={settings.shippingFee} />;
}
