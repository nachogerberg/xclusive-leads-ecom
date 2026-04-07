import { useState, useEffect, useCallback } from "react";
import Head from "next/head";

interface MetaSummary {
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
}

interface Campaign {
  name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  purchases: number;
  purchaseValue: number;
  roas: number;
}

interface DailySpend {
  date: string;
  spend: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

interface DashboardData {
  range: string;
  syncedAt: string;
  source?: string;
  meta: {
    status: "live" | "error";
    error?: string;
    summary: MetaSummary;
    campaigns: Campaign[];
    daily: DailySpend[];
  };
  shopify: {
    status: "live" | "pending_token" | "error";
    error?: string;
    revenue: number;
    orderCount: number;
    aov: number;
    topProducts: TopProduct[];
    dailyRevenue: DailyRevenue[];
  };
  klaviyo: {
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
  };
}

const fmt = (n: number, style: "currency" | "decimal" | "percent" = "decimal", decimals = 2) => {
  if (style === "currency") return "$" + n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (style === "percent") return n.toFixed(decimals) + "%";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
};

function Badge({ status }: { status: string }) {
  if (status === "live") return <span className="badge badge-live">Live</span>;
  if (status === "pending_token") return <span className="badge badge-pending">Pending Token</span>;
  return <span className="badge badge-error">Error</span>;
}

function SpendRevenueChart({ daily, dailyRevenue }: { daily: DailySpend[]; dailyRevenue: DailyRevenue[] }) {
  if (daily.length === 0 && dailyRevenue.length === 0) {
    return <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>No daily data available</p>;
  }

  // Merge dates
  const allDates = new Set([...daily.map((d) => d.date), ...dailyRevenue.map((d) => d.date)]);
  const dates = Array.from(allDates).sort();
  const spendMap = new Map(daily.map((d) => [d.date, d.spend]));
  const revMap = new Map(dailyRevenue.map((d) => [d.date, d.revenue]));

  const maxVal = Math.max(
    ...dates.map((d) => Math.max(spendMap.get(d) || 0, revMap.get(d) || 0)),
    1
  );

  const W = Math.max(dates.length * 48, 600);
  const H = 220;
  const pad = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = Math.max(chartW / dates.length * 0.35, 4);

  return (
    <>
      <div className="chart-container">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const y = pad.top + chartH * (1 - f);
            return (
              <g key={f}>
                <line x1={pad.left} x2={W - pad.right} y1={y} y2={y} className="chart-grid" />
                <text x={pad.left - 8} y={y + 3} textAnchor="end" className="chart-label">
                  {fmt(maxVal * f, "currency", 0)}
                </text>
              </g>
            );
          })}
          {/* Bars */}
          {dates.map((date, i) => {
            const x = pad.left + (i + 0.5) * (chartW / dates.length);
            const s = spendMap.get(date) || 0;
            const r = revMap.get(date) || 0;
            const sH = (s / maxVal) * chartH;
            const rH = (r / maxVal) * chartH;
            return (
              <g key={date}>
                <rect
                  x={x - barW - 1}
                  y={pad.top + chartH - sH}
                  width={barW}
                  height={sH}
                  className="chart-bar-spend"
                  rx={2}
                />
                <rect
                  x={x + 1}
                  y={pad.top + chartH - rH}
                  width={barW}
                  height={rH}
                  className="chart-bar-revenue"
                  rx={2}
                />
                <text
                  x={x}
                  y={H - 8}
                  textAnchor="middle"
                  className="chart-label"
                  transform={`rotate(-45, ${x}, ${H - 8})`}
                >
                  {date.slice(5)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="chart-legend">
        <div className="chart-legend-item">
          <div className="chart-legend-dot" style={{ background: "var(--accent)" }} />
          Ad Spend
        </div>
        <div className="chart-legend-item">
          <div className="chart-legend-dot" style={{ background: "var(--success)" }} />
          Revenue
        </div>
      </div>
    </>
  );
}

export default function Dashboard() {
  const [range, setRange] = useState<string>("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [campaignsExpanded, setCampaignsExpanded] = useState(true);

  const fetchData = useCallback(async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard?range=${r}`);
      const json = await res.json();
      setData(json);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(range);
  }, [range, fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range }),
      });
      await fetchData(range);
    } finally {
      setSyncing(false);
    }
  };

  const meta = data?.meta;
  const shopify = data?.shopify;
  const klaviyo = data?.klaviyo;

  return (
    <>
      <Head>
        <title>Xclusive Leads Ecom Dashboard</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="dashboard">
        {/* Header */}
        <div className="header">
          <h1>🛒 Xclusive Leads Ecom</h1>
          <div className="header-controls">
            <div className="range-selector">
              {["7d", "30d", "90d"].map((r) => (
                <button
                  key={r}
                  className={`range-btn ${range === r ? "active" : ""}`}
                  onClick={() => setRange(r)}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
            <button className="sync-btn" onClick={handleSync} disabled={syncing}>
              {syncing ? "Syncing..." : "Sync Now"}
            </button>
            {data?.syncedAt && (
              <span className="synced-at">
                Last sync: {new Date(data.syncedAt).toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {loading && !data ? (
          <div className="loading-overlay">
            <div className="spinner" />
            Loading dashboard...
          </div>
        ) : (
          <>
            {/* KPI Row 1 — Meta */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Ad Spend</div>
                <div className="kpi-value">{fmt(meta?.summary.spend || 0, "currency")}</div>
                <div className="kpi-sub">{range} total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">ROAS</div>
                <div className="kpi-value" style={{ color: (meta?.summary.roas || 0) >= 2 ? "var(--success)" : "var(--warning)" }}>
                  {(meta?.summary.roas || 0).toFixed(2)}x
                </div>
                <div className="kpi-sub">Return on ad spend</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">CPA</div>
                <div className="kpi-value">{fmt(meta?.summary.costPerPurchase || 0, "currency")}</div>
                <div className="kpi-sub">Cost per purchase</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">CTR</div>
                <div className="kpi-value">{fmt(meta?.summary.ctr || 0, "percent")}</div>
                <div className="kpi-sub">{fmt(meta?.summary.clicks || 0)} clicks</div>
              </div>
            </div>

            {/* KPI Row 2 — Shopify + Klaviyo */}
            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-label">Revenue</div>
                <div className="kpi-value" style={{ color: "var(--success)" }}>
                  {shopify?.status === "pending_token" ? "Connecting..." : fmt(shopify?.revenue || 0, "currency")}
                </div>
                <div className="kpi-sub">Shopify orders</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Orders</div>
                <div className="kpi-value">
                  {shopify?.status === "pending_token" ? "—" : fmt(shopify?.orderCount || 0)}
                </div>
                <div className="kpi-sub">{range} total</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">AOV</div>
                <div className="kpi-value">
                  {shopify?.status === "pending_token" ? "—" : fmt(shopify?.aov || 0, "currency")}
                </div>
                <div className="kpi-sub">Avg order value</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-label">Email Open Rate</div>
                <div className="kpi-value">
                  {klaviyo?.status === "pending_token" ? "Connecting..." : fmt(klaviyo?.openRate || 0, "percent")}
                </div>
                <div className="kpi-sub">Klaviyo emails</div>
              </div>
            </div>

            {/* Meta Campaign Table */}
            <div className="section">
              <div className="section-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="section-title">Meta Campaigns</span>
                  <Badge status={meta?.status || "error"} />
                </div>
                <button className="collapse-toggle" onClick={() => setCampaignsExpanded(!campaignsExpanded)}>
                  {campaignsExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
              {meta?.error && <p style={{ color: "var(--error)", fontSize: "0.85rem", marginBottom: 12 }}>{meta.error}</p>}
              {campaignsExpanded && (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Campaign</th>
                      <th className="num">Spend</th>
                      <th className="num">Impressions</th>
                      <th className="num">Clicks</th>
                      <th className="num">CTR</th>
                      <th className="num">Purchases</th>
                      <th className="num">Revenue</th>
                      <th className="num">ROAS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(meta?.campaigns || []).length === 0 ? (
                      <tr><td colSpan={8} style={{ color: "var(--muted)" }}>No campaign data</td></tr>
                    ) : (
                      meta!.campaigns.map((c, i) => (
                        <tr key={i}>
                          <td>{c.name}</td>
                          <td className="num">{fmt(c.spend, "currency")}</td>
                          <td className="num">{fmt(c.impressions)}</td>
                          <td className="num">{fmt(c.clicks)}</td>
                          <td className="num">{fmt(c.ctr, "percent")}</td>
                          <td className="num">{fmt(c.purchases)}</td>
                          <td className="num">{fmt(c.purchaseValue, "currency")}</td>
                          <td className="num">{c.roas.toFixed(2)}x</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Daily Spend + Revenue Chart */}
            <div className="section">
              <div className="section-header">
                <span className="section-title">Daily Spend &amp; Revenue</span>
              </div>
              <SpendRevenueChart
                daily={meta?.daily || []}
                dailyRevenue={shopify?.dailyRevenue || []}
              />
            </div>

            {/* Shopify Summary */}
            <div className="section">
              <div className="section-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="section-title">Shopify — Top Products</span>
                  <Badge status={shopify?.status || "error"} />
                </div>
              </div>
              {shopify?.status === "pending_token" ? (
                <p style={{ color: "var(--warning)", fontSize: "0.9rem" }}>Awaiting Shopify Admin token — connect your store to see product data.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className="num">Qty Sold</th>
                      <th className="num">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(shopify?.topProducts || []).length === 0 ? (
                      <tr><td colSpan={3} style={{ color: "var(--muted)" }}>No product data</td></tr>
                    ) : (
                      shopify!.topProducts.map((p, i) => (
                        <tr key={i}>
                          <td>{p.name}</td>
                          <td className="num">{p.quantity}</td>
                          <td className="num">{fmt(p.revenue, "currency")}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            {/* Email Performance */}
            <div className="section">
              <div className="section-header">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span className="section-title">Email Performance</span>
                  <Badge status={klaviyo?.status || "error"} />
                </div>
              </div>
              {klaviyo?.status === "pending_token" ? (
                <p style={{ color: "var(--warning)", fontSize: "0.9rem" }}>Awaiting Klaviyo API key verification — email metrics will appear once connected.</p>
              ) : (
                <div className="funnel">
                  <div className="funnel-step">
                    <span className="num">{fmt(klaviyo?.received || 0)}</span>
                    <span className="label">Received</span>
                  </div>
                  <div className="funnel-step">
                    <span className="num">{fmt(klaviyo?.opened || 0)}</span>
                    <span className="label">Opened</span>
                  </div>
                  <div className="funnel-step">
                    <span className="num">{fmt(klaviyo?.clicked || 0)}</span>
                    <span className="label">Clicked</span>
                  </div>
                  <div className="funnel-step">
                    <span className="num">{fmt(klaviyo?.bounced || 0)}</span>
                    <span className="label">Bounced</span>
                  </div>
                  <div className="funnel-step">
                    <span className="num">{fmt(klaviyo?.placedOrder || 0)}</span>
                    <span className="label">Placed Order</span>
                  </div>
                </div>
              )}
            </div>

            {/* Connection Status */}
            <div className="section">
              <div className="section-header">
                <span className="section-title">Connection Status</span>
              </div>
              <div className="conn-grid">
                <div className="conn-card">
                  <div className="conn-name">Meta Ads</div>
                  <div className="conn-status">
                    <Badge status={meta?.status || "error"} />
                    {meta?.status === "live" && <span style={{ marginLeft: 8 }}>{fmt(meta.summary.spend, "currency")} spend tracked</span>}
                    {meta?.error && <span style={{ marginLeft: 8, color: "var(--error)" }}>{meta.error.slice(0, 80)}</span>}
                  </div>
                </div>
                <div className="conn-card">
                  <div className="conn-name">Shopify</div>
                  <div className="conn-status">
                    <Badge status={shopify?.status || "error"} />
                    {shopify?.status === "pending_token" && <span style={{ marginLeft: 8 }}>Admin token needed</span>}
                    {shopify?.status === "live" && <span style={{ marginLeft: 8 }}>{shopify.orderCount} orders</span>}
                  </div>
                </div>
                <div className="conn-card">
                  <div className="conn-name">Klaviyo</div>
                  <div className="conn-status">
                    <Badge status={klaviyo?.status || "error"} />
                    {klaviyo?.status === "pending_token" && <span style={{ marginLeft: 8 }}>API key pending verification</span>}
                    {klaviyo?.status === "live" && <span style={{ marginLeft: 8 }}>{fmt(klaviyo.received)} emails sent</span>}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
