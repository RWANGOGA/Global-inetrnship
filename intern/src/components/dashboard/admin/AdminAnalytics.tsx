"use client";

import React, { useEffect, useState, ChangeEvent } from "react";
import { useApp } from "../../../context/AppContext";
import { fetchAdminHiringFunnelAnalytics, AdminHiringFunnelAnalytics, FunnelStageMetrics } from "../../../lib/api";
import { Icon, IconName } from "../../icons/Icons";
import { MetricCard, FunnelChart, DataTable } from "../AnalyticsUI";

export function AdminAnalytics() {
  const { toast } = useApp();
  const [analytics, setAnalytics] = useState<AdminHiringFunnelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [periodStart, setPeriodStart] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split("T")[0];
  });
  const [periodEnd, setPeriodEnd] = useState(() => new Date().toISOString().split("T")[0]);
  const [orgType, setOrgType] = useState("");
  const [opportunityType, setOpportunityType] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchAdminHiringFunnelAnalytics({
        period_start: periodStart,
        period_end: periodEnd,
        org_type: orgType || undefined,
        opportunity_type: opportunityType || undefined,
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
    loadAnalytics();
  }, []); // Only load on mount, not on filter changes

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

  const d = analytics!;

  const handlePeriodStartChange = (e: ChangeEvent<HTMLInputElement>) => setPeriodStart(e.target.value);
  const handlePeriodEndChange = (e: ChangeEvent<HTMLInputElement>) => setPeriodEnd(e.target.value);
  const handleOrgTypeChange = (e: ChangeEvent<HTMLSelectElement>) => setOrgType(e.target.value);
  const handleOpportunityTypeChange = (e: ChangeEvent<HTMLSelectElement>) => setOpportunityType(e.target.value);

  return React.createElement("div", { className: "admin-analytics", style: { animation: "fadeIn 0.3s ease" } },
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px", marginBottom: "24px" } },
      React.createElement("div", null,
        React.createElement("h2", { style: { fontWeight: 800, fontSize: "28px", margin: "0 0 4px", color: "var(--ink)" } }, "Hiring Funnel Analytics"),
        React.createElement("p", { style: { color: "var(--ink-2)", margin: 0 } }, `Platform-wide view: ${periodStart} to ${periodEnd}`)
      ),
      React.createElement("div", { style: { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" } },
        React.createElement("input", { type: "date", value: periodStart, onChange: handlePeriodStartChange, className: "input-field", style: { width: "160px" } }),
        React.createElement("span", { style: { color: "var(--muted)" } }, "to"),
        React.createElement("input", { type: "date", value: periodEnd, onChange: handlePeriodEndChange, className: "input-field", style: { width: "160px" } }),
        React.createElement("select", { value: orgType, onChange: handleOrgTypeChange, className: "input-field", style: { width: "180px" } },
          React.createElement("option", { value: "" }, "All Organization Types"),
          React.createElement("option", { value: "Company" }, "Company"),
          React.createElement("option", { value: "Government" }, "Government"),
          React.createElement("option", { value: "NGO" }, "NGO"),
          React.createElement("option", { value: "University" }, "University")
        ),
        React.createElement("select", { value: opportunityType, onChange: handleOpportunityTypeChange, className: "input-field", style: { width: "180px" } },
          React.createElement("option", { value: "" }, "All Opportunity Types"),
          React.createElement("option", { value: "internship" }, "Internship"),
          React.createElement("option", { value: "job" }, "Job"),
          React.createElement("option", { value: "gig" }, "Gig"),
          React.createElement("option", { value: "entry_level" }, "Entry Level")
        ),
        React.createElement("button", { type: "button", className: "btn btn-blue", onClick: handleRefresh, disabled: loading },
          React.createElement(Icon, { name: "arrow", size: 14 }),
          " Refresh"
        )
      )
    ),

    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" } },
      React.createElement(MetricCard, { title: "Total Applications", value: d.total_applications.toLocaleString(), subtitle: `${d.total_postings} postings`, icon: "doc" }),
      React.createElement(MetricCard, { title: "Overall Conversion", value: `${((d.overall_stages.find(s => s.stage === "Accepted")?.count || 0) / d.total_applications * 100).toFixed(1)}%`, subtitle: "Application to Hire", icon: "arrow" }),
      React.createElement(MetricCard, { title: "Active Organizations", value: d.total_organizations, subtitle: `${d.total_postings} total postings`, icon: "brief" }),
      React.createElement(MetricCard, { title: "Avg Time to Hire", value: d.avg_time_to_hire_days ? `${d.avg_time_to_hire_days} days` : "—", subtitle: "Application to Accepted", icon: "clock" })
    ),

    React.createElement("div", { style: { background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-xl)", padding: "24px", marginBottom: "24px" } },
      React.createElement("h3", { style: { fontWeight: 700, fontSize: "18px", margin: "0 0 20px", color: "var(--ink)" } }, "Hiring Funnel"),
      React.createElement(FunnelChart, { stages: d.overall_stages })
    ),

    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "24px" } },
      React.createElement(DataTable, {
        title: "Applications by Status",
        columns: ["Status", "Count", "% of Total"],
        rows: Object.entries(d.applications_by_status).map(([status, count]) => [status, count.toLocaleString(), `${((count / d.total_applications) * 100).toFixed(1)}%`]),
        emptyMessage: "No applications in period"
      }),
      React.createElement(DataTable, {
        title: "Applications by Type",
        columns: ["Type", "Count", "% of Total"],
        rows: Object.entries(d.applications_by_type).map(([type, count]) => [type.charAt(0).toUpperCase() + type.slice(1).replace("_", " "), count.toLocaleString(), `${((count / d.total_applications) * 100).toFixed(1)}%`]),
        emptyMessage: "No applications by type"
      })
    ),

    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "24px" } },
      React.createElement(DataTable, {
        title: "Conversion by Organization Type",
        columns: ["Organization Type", "Conversion Rate"],
        rows: Object.entries(d.conversion_by_org_type).map(([type, rate]) => [type, `${rate.toFixed(1)}%`]),
        emptyMessage: "No organization type data"
      }),
      React.createElement(DataTable, {
        title: "Conversion by Opportunity Type",
        columns: ["Opportunity Type", "Conversion Rate"],
        rows: Object.entries(d.conversion_by_opportunity_type).map(([type, rate]) => [type.charAt(0).toUpperCase() + type.slice(1).replace("_", " "), `${rate.toFixed(1)}%`]),
        emptyMessage: "No opportunity type data"
      })
    ),

    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px" } },
      React.createElement(DataTable, {
        title: "Top Organizations by Hires",
        columns: ["Organization", "Hires"],
        rows: d.top_organizations_by_hires.map(o => [o.organization_name, o.hires.toString()]),
        emptyMessage: "No hire data"
      }),
      React.createElement(DataTable, {
        title: "Top Skills Platform-Wide",
        columns: ["Skill", "Demand Count"],
        rows: d.top_skills_platform.map(s => [s.skill, s.count.toString()]),
        emptyMessage: "No skills data"
      })
    )
  );
}