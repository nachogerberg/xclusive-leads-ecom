import { useState, useEffect, useMemo } from "react";
import Head from "next/head";

interface LeadPkgRow {
  campaign_name: string;
  agent_name?: string;
  mes: number;
  gasto?: number;
  ingreso?: number;
  leads?: number;
  profit?: number;
  completado?: boolean;
  [key: string]: unknown;
}

interface ClientSummary {
  name: string;
  months: LeadPkgRow[];
  activeMonths: number;
  ltv: number;
  totalGasto: number;
  totalProfit: number;
  isActive: boolean;
}

const MONTHS = [
  "Todos", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = (n: number | null | undefined, style: "currency" | "decimal" = "decimal") => {
  const v = n ?? 0;
  if (style === "currency") return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

// Current month (April 2026 = 4)
const CURRENT_MONTH = 4;

function buildClients(rows: LeadPkgRow[]): ClientSummary[] {
  const grouped = new Map<string, LeadPkgRow[]>();
  for (const r of rows) {
    const key = r.campaign_name;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(r);
  }

  return Array.from(grouped.entries()).map(([name, months]) => {
    const activeMonths = new Set(months.map((m) => m.mes)).size;
    const ltv = months.reduce((s, m) => s + (m.ingreso ?? 0), 0);
    const totalGasto = months.reduce((s, m) => s + (m.gasto ?? 0), 0);
    const totalProfit = months.reduce((s, m) => s + (m.profit ?? 0), 0);
    const maxMonth = Math.max(...months.map((m) => m.mes));
    const isActive = maxMonth >= CURRENT_MONTH - 1;
    return { name, months: months.sort((a, b) => a.mes - b.mes), activeMonths, ltv, totalGasto, totalProfit, isActive };
  });
}

type Tab = "todos" | "recurrentes" | "inactivos";

export default function ClientsPage() {
  const [rows, setRows] = useState<LeadPkgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("todos");
  const [monthFilter, setMonthFilter] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const clients = useMemo(() => {
    let filtered = rows;
    if (monthFilter > 0) filtered = filtered.filter((r) => r.mes === monthFilter);
    const all = buildClients(filtered);
    if (tab === "recurrentes") return all.filter((c) => c.activeMonths >= 2);
    if (tab === "inactivos") return all.filter((c) => !c.isActive);
    return all;
  }, [rows, tab, monthFilter]);

  const kpis = useMemo(() => {
    const allClients = buildClients(rows);
    const active = allClients.filter((c) => c.isActive);
    const avgLtv = allClients.length > 0 ? allClients.reduce((s, c) => s + c.ltv, 0) / allClients.length : 0;
    const churn = allClients.length > 0 ? ((allClients.length - active.length) / allClients.length * 100) : 0;
    return { total: allClients.length, active: active.length, avgLtv, churn };
  }, [rows]);

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "recurrentes", label: "Recurrentes (≥2 meses)" },
    { key: "inactivos", label: "Inactivos" },
  ];

  return (
    <>
      <Head>
        <title>Clientes 2026 — Xclusive Leads</title>
      </Head>
      <div className="dashboard">
        <div className="header">
          <h1>Clientes 2026</h1>
          <div className="header-controls">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(Number(e.target.value))}
              style={{
                background: "var(--card)", color: "var(--text)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 16px", fontSize: "0.85rem",
              }}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPI Summary */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-label">Total Clientes</div>
            <div className="kpi-value">{kpis.total}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Clientes Activos</div>
            <div className="kpi-value" style={{ color: "var(--success)" }}>{kpis.active}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">LTV Promedio</div>
            <div className="kpi-value">{fmt(kpis.avgLtv, "currency")}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Churn Rate</div>
            <div className="kpi-value" style={{ color: kpis.churn > 30 ? "var(--error)" : "var(--warning)" }}>
              {kpis.churn.toFixed(1)}%
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid var(--error)", borderRadius: 8, padding: 16, marginBottom: 16, color: "var(--error)", fontSize: "0.85rem" }}>
            {error}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24, background: "var(--card)", borderRadius: 8, padding: 4, width: "fit-content" }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`range-btn ${tab === t.key ? "active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="loading-overlay">
            <div className="spinner" />
            Cargando clientes...
          </div>
        ) : (
          <div className="section">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left" }}>Cliente</th>
                    <th className="num">Paquetes</th>
                    <th className="num">Meses Activos</th>
                    <th className="num">LTV ($)</th>
                    <th className="num">Gasto Total</th>
                    <th className="num">Profit Total</th>
                    <th className="num">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.length === 0 ? (
                    <tr><td colSpan={7} style={{ color: "var(--muted)", textAlign: "center", padding: 32 }}>No hay clientes</td></tr>
                  ) : (
                    clients.map((c) => {
                      const isExp = expanded.has(c.name);
                      return [
                        <tr
                          key={c.name}
                          style={{ cursor: "pointer", background: isExp ? "#161616" : undefined }}
                          onClick={() => toggleExpand(c.name)}
                        >
                          <td style={{ padding: "10px 12px" }}>
                            <span style={{ color: "#f97316", marginRight: 8 }}>{isExp ? "▼" : "▶"}</span>
                            {c.name}
                          </td>
                          <td className="num">{c.months.length}</td>
                          <td className="num">{c.activeMonths}</td>
                          <td className="num">{fmt(c.ltv, "currency")}</td>
                          <td className="num">{fmt(c.totalGasto, "currency")}</td>
                          <td className="num" style={{ color: c.totalProfit >= 0 ? "var(--success)" : "var(--error)" }}>
                            {fmt(c.totalProfit, "currency")}
                          </td>
                          <td className="num">
                            {c.isActive ? (
                              <span style={{ color: "#10b981", background: "#064e3b", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>Activo</span>
                            ) : (
                              <span style={{ color: "#94a3b8", background: "#1e293b", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>Inactivo</span>
                            )}
                          </td>
                        </tr>,
                        ...(isExp ? c.months.map((m, mi) => (
                          <tr key={`${c.name}-${mi}`} style={{ background: "#0d0d0d", fontSize: "0.85rem" }}>
                            <td style={{ paddingLeft: 36, color: "var(--muted)" }}>{MONTHS[m.mes] ?? m.mes}</td>
                            <td className="num">1</td>
                            <td className="num">—</td>
                            <td className="num">{fmt(m.ingreso, "currency")}</td>
                            <td className="num">{fmt(m.gasto, "currency")}</td>
                            <td className="num" style={{ color: (m.profit ?? 0) >= 0 ? "var(--success)" : "var(--error)" }}>
                              {fmt(m.profit, "currency")}
                            </td>
                            <td className="num">
                              {m.completado ? (
                                <span style={{ color: "#10b981", fontSize: 11 }}>✓</span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>
                              )}
                            </td>
                          </tr>
                        )) : []),
                      ];
                    }).flat()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
