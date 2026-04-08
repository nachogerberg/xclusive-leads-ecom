export interface ShopifyData {
  status: "live" | "pending_token" | "error";
  error?: string;
  revenue: number;
  orderCount: number;
  aov: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  dailyRevenue: Array<{ date: string; revenue: number }>;
}

// Module-level token cache
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getShopifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken;
  }

  const clientId = process.env.SHOPIFY_CLIENT_ID!;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET!;
  const domain = process.env.SHOPIFY_SHOP_DOMAIN!;

  const res = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`,
  });

  if (!res.ok) {
    throw new Error(`Shopify token request failed ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = json.access_token;
  // Default 24h if expires_in not provided, minus 60s buffer
  const expiresIn = (json.expires_in || 86400) - 60;
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  return cachedToken;
}

function dateRange(range: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (range === "7d") start.setDate(end.getDate() - 7);
  else if (range === "90d") start.setDate(end.getDate() - 90);
  else start.setDate(end.getDate() - 30);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function fetchShopify(range: string = "30d"): Promise<ShopifyData> {
  const clientId = process.env.SHOPIFY_CLIENT_ID;
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;

  if (!clientId || !clientSecret || !domain) {
    return { status: "pending_token", revenue: 0, orderCount: 0, aov: 0, topProducts: [], dailyRevenue: [] };
  }

  const { start, end } = dateRange(range);

  try {
    const token = await getShopifyToken();

    const res = await fetch(
      `https://${domain}/admin/api/2024-01/orders.json?status=any&created_at_min=${start}&created_at_max=${end}&limit=250`,
      {
        headers: {
          "X-Shopify-Access-Token": token,
          "Content-Type": "application/json",
        },
      }
    );

    if (res.status === 401 || res.status === 403) {
      cachedToken = null;
      tokenExpiresAt = 0;
      return { status: "pending_token", revenue: 0, orderCount: 0, aov: 0, topProducts: [], dailyRevenue: [] };
    }

    if (!res.ok) {
      throw new Error(`Shopify API ${res.status}: ${await res.text()}`);
    }

    const { orders } = (await res.json()) as {
      orders: Array<{
        total_price: string;
        created_at: string;
        line_items: Array<{ title: string; quantity: number; price: string }>;
      }>;
    };

    const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);
    const orderCount = orders.length;
    const aov = orderCount > 0 ? revenue / orderCount : 0;

    // Top products
    const productMap = new Map<string, { quantity: number; revenue: number }>();
    for (const order of orders) {
      for (const item of order.line_items) {
        const existing = productMap.get(item.title) || { quantity: 0, revenue: 0 };
        existing.quantity += item.quantity;
        existing.revenue += parseFloat(item.price) * item.quantity;
        productMap.set(item.title, existing);
      }
    }
    const topProducts = Array.from(productMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Daily revenue
    const dailyMap = new Map<string, number>();
    for (const order of orders) {
      const day = order.created_at.slice(0, 10);
      dailyMap.set(day, (dailyMap.get(day) || 0) + parseFloat(order.total_price));
    }
    const dailyRevenue = Array.from(dailyMap.entries())
      .map(([date, rev]) => ({ date, revenue: rev }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { status: "live", revenue, orderCount, aov, topProducts, dailyRevenue };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", error: message, revenue: 0, orderCount: 0, aov: 0, topProducts: [], dailyRevenue: [] };
  }
}
