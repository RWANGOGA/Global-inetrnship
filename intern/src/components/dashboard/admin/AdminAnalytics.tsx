"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchAdminHiringFunnelAnalytics,
  type AdminHiringFunnelAnalytics,
} from "../../../lib/api";
import { Icon, type IconName } from "../../icons/Icons";
import styles from "./AdminAnalytics.module.css";

const isoDay = (date: Date) => date.toISOString().slice(0, 10);

const startOfWindow = () => {
  const date = new Date();
  date.setMonth(date.getMonth() - 3);
  return isoDay(date);
};

const number = (value: number) => value.toLocaleString();

const percent = (value: number) => `${value.toFixed(1)}%`;

const typeLabel = (value: string) => {
  if (!value) return "Unknown";
  const words = value.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// Status and type colours keep the same meaning in every panel.
const STATUS_TONE: Record<string, string> = {
  Submitted: styles.toneMuted,
  "In Review": styles.toneGold,
  Accepted: styles.toneGreen,
  Rejected: styles.toneRed,
  Withdrawn: styles.toneMuted,
};

const TYPE_TONE: Record<string, string> = {
  internship: styles.toneBrand,
  job: styles.toneGreen,
  gig: styles.toneGold,
  entry_level: styles.toneMuted,
};

interface KpiProps {
  label: string;
  value: string;
  hint: string;
  icon: IconName;
}

function Kpi({ label, value, hint, icon }: KpiProps) {
  return (
    <article className={styles.kpi}>
      <div className={styles.kpiHead}>
        <span className={styles.kpiLabel}>{label}</span>
        <span className={styles.kpiIcon} aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <strong className={styles.kpiValue}>{value}</strong>
      <span className={styles.kpiSub}>{hint}</span>
    </article>
  );
}

interface BreakdownRowProps {
  label: string;
  tone?: string;
  value: string;
  secondary?: string;
  width: number;
}

function BreakdownRow({ label, tone, value, secondary, width }: BreakdownRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>
        {tone ? <span className={`${styles.dot} ${tone}`} aria-hidden="true" /> : null}
        <span className={styles.rowText} title={label}>
          {label}
        </span>
      </span>
      <span className={styles.miniTrack}>
        <span
          className={styles.miniFill}
          style={{ width: `${Math.min(Math.max(width, 0), 100)}%` }}
        />
      </span>
      <span className={styles.rowValue}>
        {value}
        {secondary ? <span className={styles.rowMuted}>{secondary}</span> : null}
      </span>
    </div>
  );
}

export function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<AdminHiringFunnelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const [periodStart, setPeriodStart] = useState(startOfWindow);
  const [periodEnd, setPeriodEnd] = useState(() => isoDay(new Date()));
  const [orgType, setOrgType] = useState("");
  const [opportunityType, setOpportunityType] = useState("");

  // Requests can resolve out of order when the user flips filters quickly;
  // only the newest response is allowed to touch state.
  const requestRef = useRef(0);

  const loadAnalytics = useCallback(async () => {
    // Bump first so a stale in-flight response cannot land after the range is
    // cleared or corrected.
    const requestId = ++requestRef.current;

    if (!periodStart || !periodEnd) {
      setLoading(false);
      setError("Choose both a start date and an end date.");
      return;
    }
    if (periodStart > periodEnd) {
      setLoading(false);
      setError("The start date must be on or before the end date.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await fetchAdminHiringFunnelAnalytics({
        period_start: periodStart,
        period_end: periodEnd,
        org_type: orgType || undefined,
        opportunity_type: opportunityType || undefined,
      });
      if (requestRef.current !== requestId) return;
      setAnalytics(data);
      setUpdatedAt(new Date());
    } catch (err) {
      if (requestRef.current !== requestId) return;
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      if (requestRef.current === requestId) setLoading(false);
    }
  }, [periodStart, periodEnd, orgType, opportunityType]);

  // Filters apply on their own after a short pause, so the screen always
  // describes the dates and filters shown above it.
  useEffect(() => {
    const timer = window.setTimeout(loadAnalytics, 250);
    return () => window.clearTimeout(timer);
  }, [loadAnalytics]);

  const hasData = analytics !== null;
  const data = analytics;

  const stages = data?.overall_stages ?? [];
  const firstStageCount = stages[0]?.count ?? 0;
  const acceptedCount = stages.find((stage) => stage.stage === "Accepted")?.count ?? 0;

  const statusRows = Object.entries(data?.applications_by_status ?? {}).sort(
    (left, right) => right[1] - left[1],
  );
  const typeRows = Object.entries(data?.applications_by_type ?? {}).sort(
    (left, right) => right[1] - left[1],
  );
  const maxStatus = statusRows.reduce((max, [, count]) => Math.max(max, count), 0);
  const maxType = typeRows.reduce((max, [, count]) => Math.max(max, count), 0);

  const orgTypeRows = Object.entries(data?.conversion_by_org_type ?? {}).sort(
    (left, right) => right[1] - left[1],
  );
  const opportunityRows = Object.entries(data?.conversion_by_opportunity_type ?? {}).sort(
    (left, right) => right[1] - left[1],
  );

  const topOrganisations = (data?.top_organizations_by_hires ?? []).slice(0, 5);
  const maxHires = topOrganisations.reduce((max, row) => Math.max(max, row.hires), 0);
  const topSkills = (data?.top_skills_platform ?? []).slice(0, 8);
  const maxSkill = topSkills.reduce((max, row) => Math.max(max, row.count), 0);

  const conversionRate =
    data && data.total_applications > 0
      ? (acceptedCount / data.total_applications) * 100
      : 0;

  const statusOf = (stage: string) =>
    ({
      Applications: styles.fillApps,
      Reviewed: styles.fillReviewed,
      Accepted: styles.fillAccepted,
    })[stage] ?? styles.fillReviewed;

  const updatedLabel = updatedAt
    ? updatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const filters = (
    <div className={styles.filters}>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>From</span>
        <input
          type="date"
          className={styles.input}
          value={periodStart}
          max={periodEnd || undefined}
          onChange={(event) => setPeriodStart(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>To</span>
        <input
          type="date"
          className={styles.input}
          value={periodEnd}
          min={periodStart || undefined}
          onChange={(event) => setPeriodEnd(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Organisation type</span>
        <select
          className={styles.input}
          value={orgType}
          onChange={(event) => setOrgType(event.target.value)}
        >
          <option value="">All types</option>
          <option value="Company">Company</option>
          <option value="Government">Government</option>
          <option value="NGO">NGO</option>
          <option value="University">University</option>
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Opportunity type</span>
        <select
          className={styles.input}
          value={opportunityType}
          onChange={(event) => setOpportunityType(event.target.value)}
        >
          <option value="">All opportunities</option>
          <option value="internship">Internship</option>
          <option value="job">Job</option>
          <option value="gig">Gig</option>
          <option value="entry_level">Entry level</option>
        </select>
      </label>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          onClick={loadAnalytics}
          disabled={loading}
          title="Reload figures from the database"
          aria-label="Reload figures from the database"
        >
          <span className={loading ? styles.spinIcon : undefined}>
            <Icon name={loading ? "spinner" : "arrow"} size={16} />
          </span>
        </button>
      </div>

      {error && hasData ? <p className={styles.errorInline}>{error}</p> : null}
    </div>
  );

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Admin · Reporting</span>
          <h2 className={styles.title}>Hiring Analytics</h2>
          <p className={styles.sub}>
            Platform-wide hiring funnel built from placements, jobs and student
            applications. Figures refresh whenever the filters change.
          </p>
        </div>

        <div className={styles.headerMeta}>
          <span className={styles.liveChip}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live database
          </span>
          {updatedLabel ? (
            <span className={styles.updated}>Updated {updatedLabel}</span>
          ) : null}
        </div>
      </header>

      {filters}

      {!hasData && loading ? (
        <div className={styles.skeletonGrid} aria-busy="true" aria-label="Loading analytics">
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={styles.skeleton} />
          <div className={`${styles.skeleton} ${styles.skeletonWide}`} />
        </div>
      ) : null}

      {!hasData && !loading && error ? (
        <div className={styles.errorState}>
          <Icon name="alert-triangle" size={34} />
          <h3>Analytics could not be loaded</h3>
          <p>{error}</p>
          <button type="button" className="btn btn-blue" onClick={loadAnalytics}>
            <Icon name="arrow" size={14} /> Try again
          </button>
        </div>
      ) : null}

      {data ? (
        <>
          <section className={styles.kpis} aria-label="Key figures">
            <Kpi
              label="Applications"
              value={number(data.total_applications)}
              hint={`${number(data.total_postings)} postings published in this period`}
              icon="doc"
            />
            <Kpi
              label="Application → hire"
              value={data.total_applications > 0 ? percent(conversionRate) : "—"}
              hint={`${number(acceptedCount)} accepted of ${number(data.total_applications)}`}
              icon="arrow"
            />
            <Kpi
              label="Active organisations"
              value={number(data.total_organizations)}
              hint="Hiring or receiving applications in this period"
              icon="brief"
            />
            <Kpi
              label="Avg time to hire"
              value={
                data.avg_time_to_hire_days !== null
                  ? `${data.avg_time_to_hire_days} days`
                  : "—"
              }
              hint="Application submitted to accepted"
              icon="clock"
            />
          </section>

          <section className={styles.panel} aria-label="Hiring funnel">
            <div className={styles.panelHead}>
              <h3 className={styles.panelTitle}>Hiring funnel</h3>
              <span className={styles.panelHint}>
                Cumulative — a hire also counts as reviewed
              </span>
            </div>

            {firstStageCount === 0 ? (
              <div className={styles.empty}>
                No applications were submitted in this period. Widen the date
                range or clear a filter.
              </div>
            ) : (
              <div className={styles.funnel}>
                {stages.map((stage, index) => {
                  const width =
                    firstStageCount > 0 ? (stage.count / firstStageCount) * 100 : 0;
                  const previous = index > 0 ? stages[index - 1].count : null;
                  return (
                    <div key={stage.stage}>
                      <div className={styles.stageTop}>
                        <span className={styles.stageName}>{stage.stage}</span>
                        <span className={styles.stageCount}>
                          <b>{number(stage.count)}</b> applications
                        </span>
                      </div>
                      <div className={styles.track}>
                        <div
                          className={`${styles.fill} ${statusOf(stage.stage)}`}
                          style={{ width: `${Math.min(Math.max(width, 0), 100)}%` }}
                        />
                      </div>
                      <div className={styles.stageMeta}>
                        <span>
                          {previous === null
                            ? "Entry point of the funnel"
                            : previous - stage.count > 0
                              ? `${number(previous - stage.count)} did not progress past this stage`
                              : "Every application from the stage before reached this stage"}
                        </span>
                        <span className={styles.rateChip}>
                          {previous === null
                            ? "100% baseline"
                            : `${percent(stage.conversion_rate)} pass rate`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className={styles.grid2}>
            <section className={styles.panel} aria-label="Applications by status">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>Applications by status</h3>
                <span className={styles.panelHint}>Share of all applications</span>
              </div>
              {statusRows.length === 0 ? (
                <div className={styles.empty}>No applications in this period.</div>
              ) : (
                <div className={styles.rows}>
                  {statusRows.map(([status, count]) => (
                    <BreakdownRow
                      key={status}
                      label={status}
                      tone={STATUS_TONE[status] ?? styles.toneMuted}
                      value={number(count)}
                      secondary={` · ${percent((count / data.total_applications) * 100)}`}
                      width={maxStatus > 0 ? (count / maxStatus) * 100 : 0}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel} aria-label="Applications by opportunity type">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>Applications by type</h3>
                <span className={styles.panelHint}>Internships, jobs and gigs</span>
              </div>
              {typeRows.length === 0 ? (
                <div className={styles.empty}>No applications by type.</div>
              ) : (
                <div className={styles.rows}>
                  {typeRows.map(([type, count]) => (
                    <BreakdownRow
                      key={type}
                      label={typeLabel(type)}
                      tone={TYPE_TONE[type] ?? styles.toneMuted}
                      value={number(count)}
                      secondary={` · ${percent((count / data.total_applications) * 100)}`}
                      width={maxType > 0 ? (count / maxType) * 100 : 0}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className={styles.grid2}>
            <section className={styles.panel} aria-label="Conversion by organisation type">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>Conversion by organisation type</h3>
                <span className={styles.panelHint}>Accepted ÷ applications</span>
              </div>
              {orgTypeRows.length === 0 ? (
                <div className={styles.empty}>No organisation type data.</div>
              ) : (
                <div className={styles.rows}>
                  {orgTypeRows.map(([type, rate]) => (
                    <BreakdownRow
                      key={type}
                      label={type}
                      tone={styles.toneBrand}
                      value={percent(rate)}
                      width={rate}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel} aria-label="Conversion by opportunity type">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>Conversion by opportunity type</h3>
                <span className={styles.panelHint}>Accepted ÷ applications</span>
              </div>
              {opportunityRows.length === 0 ? (
                <div className={styles.empty}>No opportunity type data.</div>
              ) : (
                <div className={styles.rows}>
                  {opportunityRows.map(([type, rate]) => (
                    <BreakdownRow
                      key={type}
                      label={typeLabel(type)}
                      tone={TYPE_TONE[type] ?? styles.toneMuted}
                      value={percent(rate)}
                      width={rate}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className={styles.grid2}>
            <section className={styles.panel} aria-label="Top organisations by hires">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>Top organisations by hires</h3>
                <span className={styles.panelHint}>Top 5 by accepted hires</span>
              </div>
              {topOrganisations.length === 0 ? (
                <div className={styles.empty}>No hires in this period.</div>
              ) : (
                <div className={styles.rows}>
                  {topOrganisations.map((row, index) => (
                    <div className={styles.row} key={row.organization_id}>
                      <span className={styles.rowLabel}>
                        <span
                          className={`${styles.rank} ${index === 0 ? styles.rankFirst : ""}`}
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <span className={styles.rowText} title={row.organization_name}>
                          {row.organization_name}
                        </span>
                      </span>
                      <span className={styles.miniTrack}>
                        <span
                          className={styles.miniFill}
                          style={{
                            width: `${maxHires > 0 ? (row.hires / maxHires) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className={styles.rowValue}>
                        {number(row.hires)}
                        <span className={styles.rowMuted}>
                          {row.hires === 1 ? " hire" : " hires"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel} aria-label="Top skills in demand">
              <div className={styles.panelHead}>
                <h3 className={styles.panelTitle}>Top skills in demand</h3>
                <span className={styles.panelHint}>Top 8 skills by posting count</span>
              </div>
              {topSkills.length === 0 ? (
                <div className={styles.empty}>No skills listed on postings in this period.</div>
              ) : (
                <div className={styles.rows}>
                  {topSkills.map((row, index) => (
                    <div className={styles.row} key={row.skill}>
                      <span className={styles.rowLabel}>
                        <span
                          className={`${styles.rank} ${index === 0 ? styles.rankFirst : ""}`}
                          aria-hidden="true"
                        >
                          {index + 1}
                        </span>
                        <span className={styles.rowText} title={row.skill}>
                          {row.skill}
                        </span>
                      </span>
                      <span className={styles.miniTrack}>
                        <span
                          className={styles.miniFill}
                          style={{
                            width: `${maxSkill > 0 ? (row.count / maxSkill) * 100 : 0}%`,
                          }}
                        />
                      </span>
                      <span className={styles.rowValue}>
                        {number(row.count)}
                        <span className={styles.rowMuted}>
                          {row.count === 1 ? " posting" : " postings"}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
