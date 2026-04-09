import { useState, useEffect, useMemo } from "react";
import Head from "next/head";

interface LeadPkgRow {
  id?: number;
  campaign_name: string;
  agent_name?: string;
  mes: number;
  gasto?: number;
  ingreso?: number;
  leads?: number;
  leads_efectivos?: number;
  cpl?: number;
  profit?: number;
  completado?: boolean;
  year?: number;
  type_of_service?: string;
  packages?: string;
  [key: string]: unknown;
}

const RANGE_OPTIONS: { key: "7d" | "30d" | "90d"; label: string }[] = [
  { key: "7d", label: "7D" },
  { key: "30d", label: "1M" },
  { key: "90d", label: "3M" },
];

const fmt = (n: number | null | undefined, style: "currency" | "decimal" = "decimal") => {
  const v = n ?? 0;
  if (style === "currency") return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

function CplPill({ cpl, leads }: { cpl: number; leads: number }) {
  if (leads === 0) return <span style={{ color: "#94a3b8", background: "#1e293b", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>No leads</span>;
  const color = cpl < 10 ? "#10b981" : cpl <= 25 ? "#f59e0b" : "#ef4444";
  const bg = cpl < 10 ? "#064e3b" : cpl <= 25 ? "#451a03" : "#450a0a";
  return <span style={{ color, background: bg, fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>${cpl.toFixed(2)}</span>;
}

function displayAgent(agent: string | null | undefined): string {
  if (!agent) return "—";
  if (agent.startsWith("[") || agent.startsWith("{")) return "—";
  return agent;
}

function truncateName(name: string, max = 20): string {
  return name.length > max ? name.slice(0, max) + "..." : name;
}

/* ── SVG helpers ── */
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

const PIE_COLORS = ["#f97316","#22d3ee","#a78bfa","#34d399","#fb923c","#c084fc"];

const cardStyle: React.CSSProperties = { background: "#111111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 20 };
const sectionCardStyle: React.CSSProperties = { background: "#111111", border: "1px solid #1e1e1e", borderRadius: 12, padding: 24 };
const labelStyle: React.CSSProperties = { color: "#94a3b8", fontSize: 12, textTransform: "uppercase", marginBottom: 4 };
const valueStyle: React.CSSProperties = { color: "#f1f5f9", fontSize: 24, fontWeight: 700 };
const tinyHeaderStyle: React.CSSProperties = { color: "#94a3b8", fontSize: 11, textTransform: "uppercase", textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #1e1e1e" };

export default function CampaignsPage() {
  const [rows, setRows] = useState<LeadPkgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    fetch("/api/leadpkg")
      .then((r) => r.json())
      .then((json) => {
        setRows(json.data || []);
        if (json.error) setError(json.error);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const currentMonth = new Date().getMonth() + 1;

  const filtered = useMemo(() => {
    let list = rows;
    if (range === "7d") list = list.filter((r) => r.mes === currentMonth);
    else if (range === "30d") list = list.filter((r) => r.mes >= currentMonth - 1 && r.mes <= currentMonth);
    else list = list.filter((r) => r.mes >= currentMonth - 2 && r.mes <= currentMonth);
    return list;
  }, [rows, range, currentMonth]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        gasto: acc.gasto + (r.gasto ?? 0),
        ingreso: acc.ingreso + (r.ingreso ?? 0),
        leads: acc.leads + (r.leads_efectivos ?? 0),
        profit: acc.profit + ((r.ingreso ?? 0) - (r.gasto ?? 0)),
      }),
      { gasto: 0, ingreso: 0, leads: 0, profit: 0 }
    );
  }, [filtered]);

  /* ── KPI computed values ── */
  const kpi = useMemo(() => {
    const totalGasto = totals.gasto;
    const totalIngreso = totals.ingreso;
    const totalProfit = totals.profit;
    const profitMargin = totalIngreso > 0 ? (totalProfit / totalIngreso) * 100 : 0;
    const totalLeads = totals.leads;
    const avgCpl = totalLeads > 0 ? totalGasto / totalLeads : 0;
    const totalPackages = filtered.length;
    const avgPkgValue = totalPackages > 0 ? totalIngreso / totalPackages : 0;
    return { totalGasto, totalIngreso, totalProfit, profitMargin, totalLeads, avgCpl, avgPkgValue, totalPackages };
  }, [totals, filtered]);

  /* ── Top 5 / Worst 5 ── */
  const top5Profit = useMemo(() => {
    return [...filtered]
      .map((r) => ({ ...r, _profit: (r.ingreso ?? 0) - (r.gasto ?? 0), _cpl: (r.leads_efectivos ?? 0) > 0 ? (r.gasto ?? 0) / (r.leads_efectivos ?? 1) : 0 }))
      .sort((a, b) => b._profit - a._profit)
      .slice(0, 5);
  }, [filtered]);

  const worst5Cpl = useMemo(() => {
    return [...filtered]
      .filter((r) => (r.leads_efectivos ?? 0) > 0)
      .map((r) => ({ ...r, _profit: (r.ingreso ?? 0) - (r.gasto ?? 0), _cpl: (r.gasto ?? 0) / (r.leads_efectivos ?? 1) }))
      .sort((a, b) => b._cpl - a._cpl)
      .slice(0, 5);
  }, [filtered]);

  /* ── Distribución data ── */
  const serviceDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      const key = r.type_of_service || "Sin tipo";
      map[key] = (map[key] || 0) + 1;
    });
    const total = filtered.length || 1;
    return Object.entries(map).map(([name, count]) => ({ name, count, pct: (count / total) * 100 }));
  }, [filtered]);

  const packageDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      const key = r.packages || "Otro";
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => {
      const na = parseInt(a[0]) || 999;
      const nb = parseInt(b[0]) || 999;
      return na - nb;
    });
  }, [filtered]);

  /* ── Pie chart builder ── */
  const renderPie = () => {
    if (serviceDistribution.length === 0) return <p style={{ color: "#94a3b8" }}>Sin datos</p>;
    const total = serviceDistribution.reduce((s, d) => s + d.count, 0);
    let cumAngle = 0;
    const slices = serviceDistribution.map((d, i) => {
      const angle = (d.count / total) * 360;
      const startAngle = cumAngle;
      cumAngle += angle;
      return { ...d, startAngle, endAngle: cumAngle, color: PIE_COLORS[i % PIE_COLORS.length] };
    });
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg width={200} height={200} viewBox="0 0 200 200">
          {slices.map((s, i) => (
            <path key={i} d={describeArc(100, 100, 90, s.startAngle, s.endAngle)} fill={s.color} stroke="#111111" strokeWidth={1} />
          ))}
        </svg>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12, justifyContent: "center" }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#f1f5f9" }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
              {s.name} ({s.pct.toFixed(1)}%)
            </div>
          ))}
        </div>
      </div>
    );
  };

  /* ── Bar chart builder ── */
  const renderBarChart = () => {
    if (packageDistribution.length === 0) return <p style={{ color: "#94a3b8" }}>Sin datos</p>;
    const maxVal = Math.max(...packageDistribution.map(([, c]) => c), 1);
    const chartW = 300;
    const chartH = 200;
    const barGap = 8;
    const barW = Math.max(20, (chartW - barGap * (packageDistribution.length + 1)) / packageDistribution.length);
    const gridLines = [0, 0.25, 0.5, 0.75, 1];
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <svg width={chartW + 40} height={chartH + 40} viewBox={`0 0 ${chartW + 40} ${chartH + 40}`}>
          {/* gridlines */}
          {gridLines.map((pct, i) => {
            const y = chartH - pct * chartH + 10;
            return (
              <g key={i}>
                <line x1={30} y1={y} x2={chartW + 30} y2={y} stroke="#1e1e1e" strokeWidth={1} />
                <text x={26} y={y + 4} fill="#94a3b8" fontSize={9} textAnchor="end">{Math.round(pct * maxVal)}</text>
              </g>
            );
          })}
          {/* bars */}
          {packageDistribution.map(([label, count], i) => {
            const barH = (count / maxVal) * chartH;
            const x = 30 + barGap + i * (barW + barGap);
            const y = chartH - barH + 10;
            return (
              <g key={i}>
                <rect x={x} y={y} width={barW} height={barH} fill="#f97316" rx={3} />
                <text x={x + barW / 2} y={y - 4} fill="#f1f5f9" fontSize={11} textAnchor="middle" fontWeight={600}>{count}</text>
                <text x={x + barW / 2} y={chartH + 26} fill="#94a3b8" fontSize={9} textAnchor="middle">{label.length > 10 ? label.slice(0, 10) : label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  /* ── Mini table for top5/worst5 ── */
  const renderMiniTable = (data: Array<LeadPkgRow & { _profit: number; _cpl: number }>, isWorst: boolean) => (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr>
          {["Campaign", "Agent", "Gasto", "Leads", "CPL", "Profit"].map((h) => (
            <th key={h} style={tinyHeaderStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.length === 0 ? (
          <tr><td colSpan={6} style={{ color: "#94a3b8", textAlign: "center", padding: 16 }}>Sin datos</td></tr>
        ) : data.map((r, i) => (
          <tr key={i} style={{ borderBottom: "1px solid #1e1e1e" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <td style={{ padding: "6px 8px", color: "#f1f5f9" }}>{truncateName(r.campaign_name)}</td>
            <td style={{ padding: "6px 8px", color: "#f1f5f9" }}>{displayAgent(r.agent_name)}</td>
            <td style={{ padding: "6px 8px", color: "#f1f5f9", textAlign: "right" }}>{fmt(r.gasto, "currency")}</td>
            <td style={{ padding: "6px 8px", color: "#f1f5f9", textAlign: "right" }}>{r.leads_efectivos ?? 0}</td>
            <td style={{ padding: "6px 8px", textAlign: "right" }}>
              {isWorst
                ? <span style={{ color: "#ef4444", background: "#450a0a", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>${r._cpl.toFixed(2)}</span>
                : <CplPill cpl={r._cpl} leads={r.leads_efectivos ?? 0} />}
            </td>
            <td style={{ padding: "6px 8px", textAlign: "right", color: r._profit >= 0 ? "#10b981" : "#ef4444" }}>{fmt(r._profit, "currency")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const profitColor = (v: number): string => v >= 0 ? "#10b981" : "#ef4444";

  return (
    <>
      <Head>
        <title>Rendimiento de Campañas — Xclusive Leads</title>
      </Head>
      <div className="dashboard">
        {/* ── Header ── */}
        <div className="header">
          <div>
            <h1>Rendimiento de Campañas 2026</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>Solo campañas PPL — Todo el año 2026</p>
          </div>
          <div className="header-controls">
            <div className="range-selector">
              {RANGE_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  className={`range-btn ${range === o.key ? "active" : ""}`}
                  onClick={() => setRange(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid var(--error)", borderRadius: 8, padding: 16, marginBottom: 16, color: "var(--error)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            Cargando datos...
          </div>
        ) : (
          <>
            {/* ── SECTION 1: KPI Cards ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Gasto</div>
                <div style={valueStyle}>{fmt(kpi.totalGasto, "currency")}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Ingreso</div>
                <div style={valueStyle}>{fmt(kpi.totalIngreso, "currency")}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Profit</div>
                <div style={{ ...valueStyle, color: profitColor(kpi.totalProfit) }}>{fmt(kpi.totalProfit, "currency")}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Profit Margin</div>
                <div style={{ ...valueStyle, color: profitColor(kpi.profitMargin) }}>{kpi.profitMargin.toFixed(1)}%</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Leads</div>
                <div style={valueStyle}>{fmt(kpi.totalLeads)}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Avg CPL</div>
                <div style={valueStyle}>{fmt(kpi.avgCpl, "currency")}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Avg Package Value</div>
                <div style={valueStyle}>{fmt(kpi.avgPkgValue, "currency")}</div>
              </div>
              <div style={cardStyle}>
                <div style={labelStyle}>Total Packages</div>
                <div style={valueStyle}>{kpi.totalPackages}</div>
              </div>
            </div>

            {/* ── SECTION 2: Performance por Campaña ── */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Performance por Campaña</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div style={sectionCardStyle}>
                  <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Top 5 por Profit</h3>
                  {renderMiniTable(top5Profit, false)}
                </div>
                <div style={sectionCardStyle}>
                  <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Peores 5 por CPL</h3>
                  {renderMiniTable(worst5Cpl, true)}
                </div>
              </div>
            </div>

            {/* ── SECTION 3: Distribución ── */}
            <div style={{ marginBottom: 24 }}>
              <h2 style={{ color: "#f1f5f9", fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Distribución</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
                <div style={sectionCardStyle}>
                  <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginBottom: 16, textAlign: "center" }}>Distribución por Tipo de Servicio</h3>
                  {renderPie()}
                </div>
                <div style={sectionCardStyle}>
                  <h3 style={{ color: "#f1f5f9", fontSize: 14, fontWeight: 600, marginBottom: 16, textAlign: "center" }}>Paquetes por Tamaño</h3>
                  {renderBarChart()}
                </div>
              </div>
            </div>

          </>
        )}
      </div>
    </>
  );
}
