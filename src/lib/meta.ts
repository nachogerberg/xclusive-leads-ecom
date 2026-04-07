const BASE = "https://graph.facebook.com/v19.0";

interface MetaInsight {
  spend: string;
  impressions: string;
  clicks: string;
  ctr: string;
  cpc: string;
  cpm: string;
  actions?: Array<{ action_type: string; value: string }>;
  action_values?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
  campaign_name?: string;
}

export interface MetaData {
  status: "live" | "error";
  error?: string;
  summary: {
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    cpc: number;
    cpm: number;
    purchases: number;
    purchaseValue: number;
    costPerPurchase: number;
    roas: number;
  };
  campaigns: Array<{
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    purchases: number;
    purchaseValue: number;
    roas: number;
  }>;
  daily: Array<{
    date: string;
    spend: number;
  }>;
}

function datePreset(range: string): string {
  if (range === "7d") return "last_7d";
  if (range === "90d") return "last_90d";
  return "last_30d";
}

function extractPurchases(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const p = actions.find(
    (a) => a.action_type === "purchase" || a.action_type === "omni_purchase"
  );
  return p ? parseFloat(p.value) : 0;
}

function extractPurchaseValue(actionValues?: Array<{ action_type: string; value: string }>): number {
  if (!actionValues) return 0;
  const p = actionValues.find(
    (a) => a.action_type === "purchase" || a.action_type === "omni_purchase"
  );
  return p ? parseFloat(p.value) : 0;
}

function extractCostPerPurchase(costPerAction?: Array<{ action_type: string; value: string }>): number {
  if (!costPerAction) return 0;
  const p = costPerAction.find(
    (a) => a.action_type === "purchase" || a.action_type === "omni_purchase"
  );
  return p ? parseFloat(p.value) : 0;
}

async function metaFetch(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("access_token", process.env.META_ACCESS_TOKEN!);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Meta API ${res.status}: ${text}`);
  }
  return res.json();
}

export async function fetchMeta(range: string = "30d"): Promise<MetaData> {
  const accountId = process.env.META_AD_ACCOUNT_ID!;
  const preset = datePreset(range);
  const fields = "spend,impressions,clicks,ctr,cpc,cpm,actions,action_values,cost_per_action_type";

  try {
    const [summaryRes, campaignRes, dailyRes] = await Promise.all([
      metaFetch(`/act_${accountId}/insights`, {
        fields,
        date_preset: preset,
      }),
      metaFetch(`/act_${accountId}/insights`, {
        fields: fields + ",campaign_name",
        date_preset: preset,
        level: "campaign",
        limit: "50",
      }),
      metaFetch(`/act_${accountId}/insights`, {
        fields: "spend",
        date_preset: preset,
        time_increment: "1",
        limit: "100",
      }),
    ]) as [
      { data: MetaInsight[] },
      { data: MetaInsight[] },
      { data: (MetaInsight & { date_start: string })[] }
    ];

    const s = summaryRes.data?.[0];
    const spend = s ? parseFloat(s.spend) : 0;
    const purchases = s ? extractPurchases(s.actions) : 0;
    const purchaseValue = s ? extractPurchaseValue(s.action_values) : 0;

    const summary = {
      spend,
      impressions: s ? parseInt(s.impressions) : 0,
      clicks: s ? parseInt(s.clicks) : 0,
      ctr: s ? parseFloat(s.ctr) : 0,
      cpc: s ? parseFloat(s.cpc) : 0,
      cpm: s ? parseFloat(s.cpm) : 0,
      purchases,
      purchaseValue,
      costPerPurchase: s ? extractCostPerPurchase(s.cost_per_action_type) : 0,
      roas: spend > 0 ? purchaseValue / spend : 0,
    };

    const campaigns = (campaignRes.data || []).map((c) => {
      const cSpend = parseFloat(c.spend);
      const cPurchaseValue = extractPurchaseValue(c.action_values);
      return {
        name: c.campaign_name || "Unknown",
        spend: cSpend,
        impressions: parseInt(c.impressions),
        clicks: parseInt(c.clicks),
        ctr: parseFloat(c.ctr),
        purchases: extractPurchases(c.actions),
        purchaseValue: cPurchaseValue,
        roas: cSpend > 0 ? cPurchaseValue / cSpend : 0,
      };
    });

    const daily = (dailyRes.data || []).map((d) => ({
      date: d.date_start,
      spend: parseFloat(d.spend),
    }));

    return { status: "live", summary, campaigns, daily };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      error: message,
      summary: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, purchases: 0, purchaseValue: 0, costPerPurchase: 0, roas: 0 },
      campaigns: [],
      daily: [],
    };
  }
}
