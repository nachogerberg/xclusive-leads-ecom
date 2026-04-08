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
  campaign_id?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
}

export interface MetaAdSet {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  leads: number;
  purchases: number;
  purchaseValue: number;
  cpl: number;
  cpp: number;
  roas: number;
}

export interface MetaAd {
  id: string;
  name: string;
  adsetId: string;
  adsetName: string;
  campaignId: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  leads: number;
  purchases: number;
  cpl: number;
  cpp: number;
  purchaseValue: number;
  roas: number;
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
    id?: string;
    name: string;
    spend: number;
    impressions: number;
    clicks: number;
    ctr: number;
    purchases: number;
    purchaseValue: number;
    roas: number;
    leads: number;
    cpl: number;
    cpp: number;
  }>;
  adsets: MetaAdSet[];
  ads: MetaAd[];
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

function extractLeads(actions?: Array<{ action_type: string; value: string }>): number {
  if (!actions) return 0;
  const leadTypes = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"];
  const p = actions.find((a) => leadTypes.includes(a.action_type));
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
    const [summaryRes, campaignRes, dailyRes, adsetRes, adRes] = await Promise.all([
      metaFetch(`/act_${accountId}/insights`, {
        fields,
        date_preset: preset,
      }),
      metaFetch(`/act_${accountId}/insights`, {
        fields: fields + ",campaign_name,campaign_id",
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
      metaFetch(`/act_${accountId}/insights`, {
        fields: "adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,action_values,cost_per_action_type",
        date_preset: preset,
        level: "adset",
        limit: "100",
      }),
      metaFetch(`/act_${accountId}/insights`, {
        fields: "ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,actions,action_values,cost_per_action_type",
        date_preset: preset,
        level: "ad",
        limit: "200",
      }),
    ]) as [
      { data: MetaInsight[] },
      { data: MetaInsight[] },
      { data: (MetaInsight & { date_start: string })[] },
      { data: MetaInsight[] },
      { data: MetaInsight[] }
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
      const cLeads = extractLeads(c.actions);
      return {
        id: c.campaign_id || c.campaign_name || String(Math.random()),
        name: c.campaign_name || "Unknown",
        spend: cSpend,
        impressions: parseInt(c.impressions),
        clicks: parseInt(c.clicks),
        ctr: parseFloat(c.ctr),
        purchases: extractPurchases(c.actions),
        purchaseValue: cPurchaseValue,
        roas: cSpend > 0 ? cPurchaseValue / cSpend : 0,
        leads: cLeads,
        cpl: cLeads > 0 ? cSpend / cLeads : 0,
        cpp: extractCostPerPurchase(c.cost_per_action_type),
      };
    });

    const adsets: MetaAdSet[] = (adsetRes.data || []).map((a) => {
      const aSpend = parseFloat(a.spend);
      const aPurchaseValue = extractPurchaseValue(a.action_values);
      const aLeads = extractLeads(a.actions);
      return {
        id: a.adset_id || "",
        name: a.adset_name || "Unknown",
        campaignId: a.campaign_id || "",
        campaignName: a.campaign_name || "Unknown",
        spend: aSpend,
        impressions: parseInt(a.impressions),
        clicks: parseInt(a.clicks),
        ctr: parseFloat(a.ctr),
        cpc: parseFloat(a.cpc || "0"),
        leads: aLeads,
        purchases: extractPurchases(a.actions),
        purchaseValue: aPurchaseValue,
        cpl: aLeads > 0 ? aSpend / aLeads : 0,
        cpp: extractCostPerPurchase(a.cost_per_action_type),
        roas: aSpend > 0 ? aPurchaseValue / aSpend : 0,
      };
    });

    const ads: MetaAd[] = (adRes.data || []).map((a) => {
      const aSpend = parseFloat(a.spend);
      const aPurchaseValue = extractPurchaseValue(a.action_values);
      const aLeads = extractLeads(a.actions);
      return {
        id: a.ad_id || "",
        name: a.ad_name || "Unknown",
        adsetId: a.adset_id || "",
        adsetName: a.adset_name || "Unknown",
        campaignId: a.campaign_id || "",
        campaignName: a.campaign_name || "Unknown",
        spend: aSpend,
        impressions: parseInt(a.impressions),
        clicks: parseInt(a.clicks),
        ctr: parseFloat(a.ctr),
        leads: aLeads,
        purchases: extractPurchases(a.actions),
        purchaseValue: aPurchaseValue,
        cpl: aLeads > 0 ? aSpend / aLeads : 0,
        cpp: extractCostPerPurchase(a.cost_per_action_type),
        roas: aSpend > 0 ? aPurchaseValue / aSpend : 0,
      };
    });

    const daily = (dailyRes.data || []).map((d) => ({
      date: d.date_start,
      spend: parseFloat(d.spend),
    }));

    return { status: "live", summary, campaigns, adsets, ads, daily };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: "error",
      error: message,
      summary: { spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0, purchases: 0, purchaseValue: 0, costPerPurchase: 0, roas: 0 },
      campaigns: [],
      adsets: [],
      ads: [],
      daily: [],
    };
  }
}
