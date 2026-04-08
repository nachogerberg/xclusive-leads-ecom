const BASE = "https://services.leadconnectorhq.com";

export interface GHLData {
  status: "live" | "pending_token" | "error";
  error?: string;
  totalLeads: number;
  newContacts: number;
  pipelineValue: number;
  wonDeals: number;
  wonRevenue: number;
  stageBreakdown: Array<{ stage: string; count: number; value: number }>;
}

function emptyData(status: "pending_token" | "error", error?: string): GHLData {
  return {
    status,
    error,
    totalLeads: 0,
    newContacts: 0,
    pipelineValue: 0,
    wonDeals: 0,
    wonRevenue: 0,
    stageBreakdown: [],
  };
}

async function ghlFetch(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Version: "2021-07-28",
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error(`GHL ${res.status}: Unauthorized`);
  }

  if (!res.ok) {
    throw new Error(`GHL API ${res.status}: ${await res.text()}`);
  }

  return res.json();
}

export async function fetchGHL(range: string = "30d"): Promise<GHLData> {
  const apiKey = process.env.GHL_API_KEY;
  const locationId = process.env.GHL_LOCATION_ID;

  if (!apiKey || !locationId) {
    return emptyData("pending_token");
  }

  try {
    // Fetch opportunities and contacts in parallel
    const [oppsRes, contactsRes] = await Promise.all([
      ghlFetch(`/opportunities/search?location_id=${locationId}&limit=100`, apiKey),
      ghlFetch(`/contacts/?locationId=${locationId}&limit=100&sortBy=dateAdded&sortDirection=desc`, apiKey),
    ]) as [
      { opportunities?: Array<{ status?: string; monetaryValue?: number; stageName?: string }> },
      { contacts?: Array<{ dateAdded?: string }> }
    ];

    const opportunities = oppsRes.opportunities || [];

    // Count total leads
    const totalLeads = opportunities.length;

    // Stage breakdown
    const stageMap = new Map<string, { count: number; value: number }>();
    let pipelineValue = 0;
    let wonDeals = 0;
    let wonRevenue = 0;

    for (const opp of opportunities) {
      const stage = opp.stageName || "Unknown";
      const value = opp.monetaryValue || 0;
      pipelineValue += value;

      const existing = stageMap.get(stage) || { count: 0, value: 0 };
      existing.count += 1;
      existing.value += value;
      stageMap.set(stage, existing);

      const lowerStage = stage.toLowerCase();
      if (lowerStage.includes("won") || lowerStage.includes("closed")) {
        wonDeals += 1;
        wonRevenue += value;
      }
    }

    const stageBreakdown = Array.from(stageMap.entries())
      .map(([stage, data]) => ({ stage, ...data }))
      .sort((a, b) => b.count - a.count);

    // Count new contacts based on range
    const now = new Date();
    const rangeDays = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const cutoff = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);

    const contacts = contactsRes.contacts || [];
    const newContacts = contacts.filter((c) => {
      if (!c.dateAdded) return false;
      return new Date(c.dateAdded) >= cutoff;
    }).length;

    return {
      status: "live",
      totalLeads,
      newContacts,
      pipelineValue,
      wonDeals,
      wonRevenue,
      stageBreakdown,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.includes("403")) {
      return emptyData("pending_token");
    }
    return emptyData("error", message);
  }
}
