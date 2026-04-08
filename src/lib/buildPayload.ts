import { fetchMeta, type MetaData } from "./meta";
import { fetchShopify, type ShopifyData } from "./shopify";
import { fetchGHL, type GHLData } from "./ghl";

export interface DashboardPayload {
  range: string;
  syncedAt: string;
  meta: MetaData;
  shopify: ShopifyData;
  ghl: GHLData;
}

export async function buildPayload(range: string = "30d"): Promise<DashboardPayload> {
  const [meta, shopify, ghl] = await Promise.all([
    fetchMeta(range),
    fetchShopify(range),
    fetchGHL(range),
  ]);

  return {
    range,
    syncedAt: new Date().toISOString(),
    meta,
    shopify,
    ghl,
  };
}
