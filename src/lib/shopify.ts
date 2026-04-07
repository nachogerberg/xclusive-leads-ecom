export interface ShopifyData {
  status: "live" | "pending_token" | "error";
  error?: string;
  revenue: number;
  orderCount: number;
  aov: number;
  topProducts: Array<{ name: string; quantity: number; revenue: number }>;
  dailyRevenue: Array<{ date: string; revenue: number }>;
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
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;

  if (!token || !domain || token === "PENDING_NEW_ADMIN_TOKEN") {
    return { status: "pending_token", revenue: 0, orderCount: 0, aov: 0, topProducts: [], dailyRevenue: [] };
  }

  const { start, end } = dateRange(range);

  try {
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
