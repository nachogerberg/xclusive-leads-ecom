import { fetchMeta, type MetaData } from "./meta";
import { fetchShopify, type ShopifyData } from "./shopify";
import { fetchKlaviyo, type KlaviyoData } from "./klaviyo";

export interface DashboardPayload {
  range: string;
  syncedAt: string;
  meta: MetaData;
  shopify: ShopifyData;
  klaviyo: KlaviyoData;
}

export async function buildPayload(range: string = "30d"): Promise<DashboardPayload> {
  const [meta, shopify, klaviyo] = await Promise.all([
    fetchMeta(range),
    fetchShopify(range),
    fetchKlaviyo(range),
  ]);

  return {
    range,
    syncedAt: new Date().toISOString(),
    meta,
    shopify,
    klaviyo,
  };
}
