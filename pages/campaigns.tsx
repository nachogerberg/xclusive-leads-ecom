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
  cpl?: number;
  profit?: number;
  completado?: boolean;
  year?: number;
  type_of_service?: string;
  [key: string]: unknown;
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

function CplPill({ cpl, leads }: { cpl: number; leads: number }) {
  if (leads === 0) return <span style={{ color: "#94a3b8", background: "#1e293b", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>No leads</span>;
  const color = cpl < 10 ? "#10b981" : cpl <= 25 ? "#f59e0b" : "#ef4444";
  const bg = cpl < 10 ? "#064e3b" : cpl <= 25 ? "#451a03" : "#450a0a";
  return <span style={{ color, background: bg, fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>${cpl.toFixed(2)}</span>;
}

type SortKey = "campaign_name" | "agent_name" | "mes" | "gasto" | "ingreso" | "leads" | "cpl" | "profit" | "completado";

export default function CampaignsPage() {
  const [rows, setRows] = useState<LeadPkgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthFilter, setMonthFilter] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("mes");
  const [sortAsc, setSortAsc] = useState(true);

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

  const filtered = useMemo(() => {
    let list = rows;
    if (monthFilter > 0) list = list.filter((r) => r.mes === monthFilter);
    return [...list].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [rows, monthFilter, sortKey, sortAsc]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => ({
        gasto: acc.gasto + (r.gasto ?? 0),
        ingreso: acc.ingreso + (r.ingreso ?? 0),
        leads: acc.leads + (r.leads ?? 0),
        profit: acc.profit + (r.profit ?? 0),
      }),
      { gasto: 0, ingreso: 0, leads: 0, profit: 0 }
    );
  }, [filtered]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => (
    <th
      className="num"
      style={{ cursor: "pointer", userSelect: "none" }}
      onClick={() => handleSort(k)}
    >
      {label} {sortKey === k ? (sortAsc ? "▲" : "▼") : ""}
    </th>
  );

  return (
    <>
      <Head>
        <title>Rendimiento de Campañas — Xclusive Leads</title>
      </Head>
      <div className="dashboard">
        <div className="header">
          <div>
            <h1>Rendimiento de Campañas 2026</h1>
            <p style={{ color: "var(--muted)", fontSize: "0.85rem", marginTop: 4 }}>Solo campañas PPL — Todo el año 2026</p>
          </div>
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
          <div className="section">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <SortHeader label="Campaña" k="campaign_name" />
                    <SortHeader label="Agente" k="agent_name" />
                    <SortHeader label="Mes" k="mes" />
                    <SortHeader label="Gasto" k="gasto" />
                    <SortHeader label="Ingreso" k="ingreso" />
                    <SortHeader label="Leads" k="leads" />
                    <SortHeader label="CPL" k="cpl" />
                    <SortHeader label="Profit" k="profit" />
                    <SortHeader label="Estado" k="completado" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} style={{ color: "var(--muted)", textAlign: "center", padding: 32 }}>No hay datos de campañas</td></tr>
                  ) : (
                    filtered.map((r, i) => {
                      const profit = r.profit ?? 0;
                      const cpl = r.cpl ?? (r.leads && r.leads > 0 ? (r.gasto ?? 0) / r.leads : 0);
                      return (
                        <tr key={i}>
                          <td>{r.campaign_name}</td>
                          <td>{r.agent_name ?? "—"}</td>
                          <td className="num">{MONTHS[r.mes] ?? r.mes}</td>
                          <td className="num">{fmt(r.gasto, "currency")}</td>
                          <td className="num">{fmt(r.ingreso, "currency")}</td>
                          <td className="num">{fmt(r.leads)}</td>
                          <td className="num"><CplPill cpl={cpl} leads={r.leads ?? 0} /></td>
                          <td className="num" style={{ color: profit >= 0 ? "var(--success)" : "var(--error)" }}>
                            {fmt(profit, "currency")}
                          </td>
                          <td className="num">
                            {r.completado ? (
                              <span style={{ color: "#10b981", background: "#064e3b", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>✓ Completado</span>
                            ) : (
                              <span style={{ color: "#94a3b8", background: "#1e293b", fontSize: 11, padding: "2px 8px", borderRadius: 12 }}>Pendiente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {filtered.length > 0 && (
                    <tr style={{ fontWeight: 700, borderTop: "2px solid var(--border)" }}>
                      <td colSpan={3} style={{ textAlign: "right" }}>TOTALES</td>
                      <td className="num">{fmt(totals.gasto, "currency")}</td>
                      <td className="num">{fmt(totals.ingreso, "currency")}</td>
                      <td className="num">{fmt(totals.leads)}</td>
                      <td className="num">—</td>
                      <td className="num" style={{ color: totals.profit >= 0 ? "var(--success)" : "var(--error)" }}>
                        {fmt(totals.profit, "currency")}
                      </td>
                      <td />
                    </tr>
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
