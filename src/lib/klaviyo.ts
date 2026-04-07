export interface KlaviyoData {
  status: "live" | "pending_token" | "error";
  error?: string;
  received: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  placedOrder: number;
  openRate: number;
  clickRate: number;
}

function dateRange(range: string): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  if (range === "7d") start.setDate(end.getDate() - 7);
  else if (range === "90d") start.setDate(end.getDate() - 90);
  else start.setDate(end.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export async function fetchKlaviyo(range: string = "30d"): Promise<KlaviyoData> {
  const apiKey = process.env.KLAVIYO_API_KEY;
  if (!apiKey) {
    return emptyData("pending_token");
  }

  const { start, end } = dateRange(range);

  try {
    const metrics = ["received", "opened", "clicked", "bounced", "unsubscribed", "placed_order"];
    const results = await Promise.all(
      metrics.map((metric) => fetchMetric(apiKey, metric, start, end))
    );

    const received = results[0];
    const opened = results[1];
    const clicked = results[2];
    const bounced = results[3];
    const unsubscribed = results[4];
    const placedOrder = results[5];

    return {
      status: "live",
      received,
      opened,
      clicked,
      bounced,
      unsubscribed,
      placedOrder,
      openRate: received > 0 ? (opened / received) * 100 : 0,
      clickRate: received > 0 ? (clicked / received) * 100 : 0,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.includes("403")) {
      return emptyData("pending_token");
    }
    return { ...emptyData("error"), error: message };
  }
}

async function fetchMetric(apiKey: string, metric: string, start: string, end: string): Promise<number> {
  const url = new URL("https://a.klaviyo.com/api/metric-aggregates");

  const body = {
    data: {
      type: "metric-aggregate",
      attributes: {
        metric_id: metric,
        measurements: ["count"],
        interval: "day",
        filter: [`greater-or-equal(datetime,${start}T00:00:00)`, `less-than(datetime,${end}T23:59:59)`],
        page_size: 500,
      },
    },
  };

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Klaviyo-API-Key ${apiKey}`,
      "Content-Type": "application/json",
      revision: "2024-02-15",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`Klaviyo ${res.status}`);
  }

  if (!res.ok) {
    throw new Error(`Klaviyo API ${res.status}: ${await res.text()}`);
  }

  const json = (await res.json()) as {
    data?: {
      attributes?: {
        data?: Array<{ measurements?: { count?: number[] } }>;
      };
    };
  };

  const dataPoints = json.data?.attributes?.data || [];
  return dataPoints.reduce((sum, d) => {
    const counts = d.measurements?.count || [];
    return sum + counts.reduce((s, c) => s + c, 0);
  }, 0);
}

function emptyData(status: "pending_token" | "error"): KlaviyoData {
  return {
    status,
    received: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    unsubscribed: 0,
    placedOrder: 0,
    openRate: 0,
    clickRate: 0,
  };
}
