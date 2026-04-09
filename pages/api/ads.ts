import type { NextApiRequest, NextApiResponse } from "next";

interface MetaAdInsight {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  spend: string;
  impressions: string;
  clicks: string;
  reach: string;
  ctr: string;
  cpc: string;
  frequency: string;
  actions?: { action_type: string; value: string }[];
}

export interface AdRow {
  ad_name: string;
  ad_id: string;
  account_type: "wa" | "fb" | "both";
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  leads: number;
  ctr: number;
  cpc: number;
  cpl: number;
  frequency: number;
  campaign_count: number;
  campaigns: string[];
}

export interface AdsSummary {
  total_spend: number;
  total_impressions: number;
  total_clicks: number;
  total_reach: number;
  total_leads: number;
  avg_ctr: number;
  avg_cpc: number;
  avg_cpl: number;
}

function extractLeads(actions?: { action_type: string; value: string }[], isFb = false): number {
  if (!actions) return 0;
  const types = isFb
    ? ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead"]
    : ["lead", "onsite_conversion.lead_grouped"];
  for (const t of types) {
    const a = actions.find((x) => x.action_type === t);
    if (a) return parseFloat(a.value);
  }
  return 0;
}

async function fetchAccountAds(accountId: string, token: string, since: string, until: string): Promise<MetaAdInsight[]> {
  const fields = "ad_id,ad_name,campaign_name,spend,impressions,clicks,reach,ctr,cpc,frequency,actions";
  const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
  const all: MetaAdInsight[] = [];
  let nextUrl: string | null = `https://graph.facebook.com/v19.0/${accountId}/insights?fields=${fields}&time_range=${timeRange}&level=ad&limit=500&access_token=${token}`;

  while (nextUrl) {
    const resp: Response = await fetch(nextUrl);
    if (!resp.ok) break;
    const json = await resp.json();
    all.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
  }
  return all;
}

function dateRangeForRange(range: string): { since: string; until: string } {
  if (range.startsWith("custom:")) {
    const [, from, to] = range.split(":");
    return { since: from, until: to };
  }
  const until = new Date();
  const since = new Date();
  if (range === "7d") since.setDate(until.getDate() - 7);
  else if (range === "90d") since.setDate(until.getDate() - 90);
  else since.setDate(until.getDate() - 30);
  return {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const range = (req.query.range as string) || "30d";
  const token = process.env.META_ACCESS_TOKEN!;
  const waAccountId = `act_${process.env.META_WA_AD_ACCOUNT}`;
  const fbAccountId = process.env.META_FB_FORM_AD_ACCOUNT ? `act_${process.env.META_FB_FORM_AD_ACCOUNT}` : null;

  try {
    const { since, until } = dateRangeForRange(range);

    const [waAds, fbAds] = await Promise.all([
      fetchAccountAds(waAccountId, token, since, until),
      fbAccountId ? fetchAccountAds(fbAccountId, token, since, until) : Promise.resolve([]),
    ]);

    // Map + group by ad_name
    type GroupEntry = { items: Array<{ ad_id: string; account_type: "wa" | "fb"; spend: number; impressions: number; clicks: number; reach: number; leads: number; ctr: number; cpc: number; frequency: number }>; types: Set<string>; campaigns: Set<string> };
    const groups = new Map<string, GroupEntry>();

    const addInsights = (insights: MetaAdInsight[], accountType: "wa" | "fb") => {
      for (const ins of insights) {
        const name = ins.ad_name;
        if (!groups.has(name)) groups.set(name, { items: [], types: new Set(), campaigns: new Set() });
        const g = groups.get(name)!;
        const isFb = accountType === "fb";
        const leads = extractLeads(ins.actions, isFb);
        const spend = parseFloat(ins.spend || "0");
        g.items.push({ ad_id: ins.ad_id, account_type: accountType, spend, impressions: parseInt(ins.impressions || "0"), clicks: parseInt(ins.clicks || "0"), reach: parseInt(ins.reach || "0"), leads, ctr: parseFloat(ins.ctr || "0"), cpc: parseFloat(ins.cpc || "0"), frequency: parseFloat(ins.frequency || "0") });
        g.types.add(accountType);
        g.campaigns.add(ins.campaign_name);
      }
    };

    addInsights(waAds, "wa");
    addInsights(fbAds, "fb");

    const ads: AdRow[] = [];
    for (const [adName, group] of groups) {
      const spend = group.items.reduce((s, a) => s + a.spend, 0);
      const impressions = group.items.reduce((s, a) => s + a.impressions, 0);
      const clicks = group.items.reduce((s, a) => s + a.clicks, 0);
      const reach = group.items.reduce((s, a) => s + a.reach, 0);
      const leads = group.items.reduce((s, a) => s + a.leads, 0);
      const accountType = group.types.size > 1 ? "both" : (group.types.values().next().value as "wa" | "fb");
      ads.push({
        ad_name: adName, ad_id: group.items[0].ad_id, account_type: accountType,
        spend: Math.round(spend * 100) / 100, impressions, clicks, reach, leads,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 100 * 100) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
        frequency: reach > 0 ? Math.round((impressions / reach) * 100) / 100 : 0,
        campaign_count: group.campaigns.size,
        campaigns: [...group.campaigns],
      });
    }

    ads.sort((a, b) => b.spend - a.spend);

    const totalSpend = ads.reduce((s, a) => s + a.spend, 0);
    const totalLeads = ads.reduce((s, a) => s + a.leads, 0);
    const totalClicks = ads.reduce((s, a) => s + a.clicks, 0);
    const totalImpressions = ads.reduce((s, a) => s + a.impressions, 0);
    const totalReach = ads.reduce((s, a) => s + a.reach, 0);

    const summary: AdsSummary = {
      total_spend: Math.round(totalSpend * 100) / 100,
      total_impressions: totalImpressions,
      total_clicks: totalClicks,
      total_reach: totalReach,
      total_leads: totalLeads,
      avg_ctr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 100 * 100) / 100 : 0,
      avg_cpc: totalClicks > 0 ? Math.round((totalSpend / totalClicks) * 100) / 100 : 0,
      avg_cpl: totalLeads > 0 ? Math.round((totalSpend / totalLeads) * 100) / 100 : 0,
    };

    return res.status(200).json({ ads, summary, count: ads.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
