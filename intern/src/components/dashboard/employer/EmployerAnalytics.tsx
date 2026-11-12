"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { fetchEmployerHiringFunnelAnalytics, EmployerHiringFunnelAnalytics, FunnelStageMetrics } from "../../../lib/api";
import { Icon, IconName } from "../../icons/Icons";
import { MetricCard, FunnelChart, DataTable } from "../AnalyticsUI";

export function EmployerAnalytics() {
  const { session, toast, placements } = useApp();
  const [analytics, setAnalytics] = useState<EmployerHiringFunnelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [placementId, setPlacementId] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchEmployerHiringFunnelAnalytics({
        period_start: periodStart,
        period_end: periodEnd,
        placement_id: placementId || undefined,
      });
      setAnalytics(data);
    } catch (err: any) {
      setError(err.message || "Failed to load analytics");
      toast("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (session?.role === "employer") {
      loadAnalytics();
    }
  }, [session]);

  const handleRefresh = () => loadAnalytics();

  if (loading && !analytics) {
    return (
      <div style={{ padding: "60px", textAlign: "center" }}>
        <div className="spinner" style={{ width: 40, height: 40, border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
        <p style={{ color: "var(--muted)" }}>Loading hiring funnel analytics...</p>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
        <div style={{ opacity: 0.3, marginBottom: "16px" }}>
          <Icon name="alert-triangle" size={48} />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>Unable to load</h3>
        <p style={{ fontSize: "14px", maxWidth: "320px", margin: "0 auto 20px" }}>{error}</p>
        <button type="button" className="btn btn-blue" onClick={handleRefresh}><Icon name="arrow" size={14} /> Retry</button>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const d = analytics;

  return (
    <div className="employer-analytics">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "24px" }}>
        <div>
          <h2 style={{ fontWeight: 800, fontSize: "28px", margin: "0 0 4px", color: "var(--ink)" }}>My Hiring Funnel</h2>
          <p style={{ color: "var(--ink-2)", margin: 0 }}>Your organization: {periodStart} to {periodEnd}</p>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="input-field" style={{ width: "160px" }} />
          <span style={{ color: "var(--muted)" }}>to</span>
          <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="input-field" style={{ width: "160px" }} />
          <select value={placementId} onChange={e => setPlacementId(e.target.value)} className="input-field" style={{ width: "280px" }}>
            <option value="">All Postings</option>
            {placements.map(p => (
              <option key={p.id} value={p.id}>{p.title} ({p.opportunityType || "internship"})</option>
            ))}
          </select>
          <button type="button" className="btn btn-blue" onClick={handleRefresh} disabled={loading}>
            <Icon name="arrow" size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
        <MetricCard title="Total Applications" value={d.total_applications.toLocaleString()} subtitle={`${d.total_postings} active postings`} icon="doc" />
        <MetricCard title="Overall Conversion" value={`${((d.stages.find(s => s.stage === "Accepted")?.count || 0) / d.total_applications * 100).toFixed(1)}%`} subtitle="Application to Hire" icon="arrow" />
        <MetricCard title="Open Postings" value={d.total_postings} subtitle="Accepting applications" icon="brief" />
        <MetricCard title="Avg Time to Hire" value={d.avg_time_to_hire_days ? `${d.avg_time_to_hire_days} days` : "—"} subtitle="Application to Accepted" icon="clock" />
      </div>

      {/* Funnel Visualization */}
      <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "24px", marginBottom: "24px" }}>
        <h3 style={{ fontWeight: 700, fontSize: "18px", margin: "0 0 20px", color: "var(--ink)" }}>Your Hiring Funnel</h3>
        <FunnelChart stages={d.stages} />
      </div>

      {/* Applications by Status & Type */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "24px" }}>
        <DataTable
          title="Applications by Status"
          columns={["Status", "Count", "% of Total"]}
          rows={Object.entries(d.applications_by_status).map(([status, count]) => [status, count.toLocaleString(), `${((count / d.total_applications) * 100).toFixed(1)}%`])}
          emptyMessage="No applications in period"
        />
        <DataTable
          title="Applications by Opportunity Type"
          columns={["Type", "Count", "% of Total"]}
          rows={Object.entries(d.applications_by_type).map(([type, count]) => [type.charAt(0).toUpperCase() + type.slice(1).replace("_", " "), count.toLocaleString(), `${((count / d.total_applications) * 100).toFixed(1)}%`])}
          emptyMessage="No applications by type"
        />
      </div>

      {/* Conversion by Posting */}
      <div style={{ marginBottom: "24px" }}>
        <DataTable
          title="Conversion by Posting"
          columns={["Posting", "Type", "Applications", "Accepted", "Conversion Rate"]}
          rows={d.conversion_by_posting.map(c => [
            c.placement_title,
            c.opportunity_type.charAt(0).toUpperCase() + c.opportunity_type.slice(1).replace("_", " "),
            c.total_applications.toString(),
            c.accepted.toString(),
            `${c.conversion_rate.toFixed(1)}%`
          ])}
          emptyMessage="No posting data"
        />
      </div>

      {/* Top Skills & Conversion */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" }}>
        <DataTable
          title="Top Skills in Demand"
          columns={["Skill", "Postings Requiring"]}
          rows={d.top_skills_in_demand.map(s => [s.skill, s.count.toString()])}
          emptyMessage="No skills data"
        />
        <DataTable
          title="Application Status Breakdown"
          columns={["Status", "Count", "% of Total"]}
          rows={Object.entries(d.applications_by_status).map(([status, count]) => [status, count.toLocaleString(), `${((count / d.total_applications) * 100).toFixed(1)}%`])}
          emptyMessage="No status data"
        />
      </div>

      <style jsx>{`
        .employer-analytics {
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .input-field {
          padding: 10px 12px;
          borderRadius: var(--r-md);
          border: 1px solid var(--rule);
          fontSize: 13px;
          background: var(--white);
          color: var(--ink);
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--rule-2);
          borderTopColor: var(--blue);
          borderRadius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}