"use client";

import React, { useEffect, useState } from "react";
import { useApp } from "../../../context/AppContext";
import {
  ApiError,
  fetchOrganizationProfile,
  updateOrganizationProfile,
  isApiEnabled,
} from "../../../lib/api";
import { CompanyProfile } from "../../../types";
import { Icon, IconName } from "../../icons/Icons";

function SectionCard({
  title,
  children,
  icon,
  description,
}: {
  title: string;
  children: React.ReactNode;
  icon?: IconName;
  description?: string;
}) {
  return (
    <div className="panel">
      <div className="ph">
        {icon && (
          <span className="section-icon">
            <Icon name={icon} size={12} />
          </span>
        )}
        <span className="lbl">{title}</span>
        {description && <span className="tg">{description}</span>}
      </div>
      <div className="pb">{children}</div>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="form-alert error">
      <span className="alert-icon"><Icon name="bell" size={14} /></span>
      <span className="alert-message">{message}</span>
    </div>
  );
}

function FormSuccess({ message }: { message: string }) {
  return (
    <div className="form-alert success">
      <span className="alert-icon"><Icon name="check" size={14} /></span>
      <span className="alert-message">{message}</span>
    </div>
  );
}

function LoadingSpinner({
  size = 32,
  text,
}: {
  size?: number;
  text?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "60px",
        color: "var(--muted)",
      }}
    >
      <div
        className="spinner"
        style={{
          width: size,
          height: size,
          border: `3px solid var(--rule-2)`,
          borderTopColor: "var(--blue)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      {text && (
        <span
          style={{
            marginTop: "12px",
            fontSize: "14px",
            color: "var(--ink-2)",
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: IconName;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px 40px",
        color: "var(--muted)",
      }}
    >
      <div style={{ opacity: 0.25, marginBottom: "20px" }}>
        <Icon name={icon} size={56} />
      </div>
      <h3
        style={{
          fontWeight: 700,
          fontSize: "18px",
          marginBottom: "8px",
          color: "var(--ink)",
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "14.5px",
          lineHeight: 1.6,
          maxWidth: "320px",
          margin: "0 auto",
        }}
      >
        {description}
      </p>
    </div>
  );
}

export function EmployerProfile() {
  const { session, toast } = useApp();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    name: "",
    type: "Company",
    sector: "",
    loc: "",
    seal: "",
    about: "",
    billing_email: "",
    tax_id: "",
  });

  useEffect(() => {
    if (!isApiEnabled || session?.role !== "employer") {
      setLoading(false);
      return;
    }
    loadProfile();
  }, [session]);

  async function loadProfile() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchOrganizationProfile();
      setProfile(data);
      setForm({
        name: data.name,
        type: data.type,
        sector: data.sector,
        loc: data.loc,
        seal: data.seal,
        about: data.about,
        billing_email: data.billing_email || "",
        tax_id: data.tax_id || "",
      });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to load profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const updated = await updateOrganizationProfile(form);
      setProfile(updated);
      setForm({
        name: updated.name,
        type: updated.type,
        sector: updated.sector,
        loc: updated.loc,
        seal: updated.seal,
        about: updated.about,
        billing_email: updated.billing_email || "",
        tax_id: updated.tax_id || "",
      });
      setSuccess("Profile saved successfully!");
      toast("Profile updated");
      setTimeout(() => setSuccess(""), 4000);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (profile) {
      setForm({
        name: profile.name,
        type: profile.type,
        sector: profile.sector,
        loc: profile.loc,
        seal: profile.seal,
        about: profile.about,
        billing_email: profile.billing_email || "",
        tax_id: profile.tax_id || "",
      });
      setError("");
      setSuccess("");
      toast("Form reset to saved values");
    }
  }

  const orgTypes = ["Company", "Government", "NGO", "University"];

  if (loading) {
    return <LoadingSpinner text="Loading profile..." />;
  }

  if (!profile) {
    return (
      <EmptyState
        icon="bldg"
        title="No organization profile"
        description="Your organization profile could not be loaded. Please contact support if this persists."
      />
    );
  }

  return (
    <>
      <div className="dpane-h">
        <div>
          <h2>Organization Profile</h2>
          <p>
            Manage your organization's public profile shown on placement and
            job detail pages.
          </p>
        </div>
        <button
          type="button"
          className="lbl blue"
          onClick={() => toast("No new notifications")}
        >
          <Icon name="bell" size={12} />
        </button>
      </div>

      {error && <FormError message={error} />}
      {success && <FormSuccess message={success} />}

      <form onSubmit={handleSubmit} className="form">
        <SectionCard
          title="Basic Information"
          icon="bldg"
          description="Core details that appear across the platform"
        >
          <div className="row2">
            <div className="field">
              <label>Organization Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Lumen Labs"
                autoComplete="organization"
              />
            </div>
            <div className="field">
              <label>Organization Type</label>
              <select
                required
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {orgTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Sector</label>
              <input
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                placeholder="Technology"
              />
            </div>
            <div className="field">
              <label>Location</label>
              <input
                value={form.loc}
                onChange={(e) => setForm({ ...form, loc: e.target.value })}
                placeholder="Kampala, Uganda"
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Logo / Seal</label>
              <input
                value={form.seal}
                onChange={(e) => setForm({ ...form, seal: e.target.value })}
                placeholder="🏢"
                maxLength={4}
                style={{
                  textAlign: "center",
                  fontSize: "18px",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                }}
              />
              <span className="lbl">Emoji or short text shown as avatar (max 4 chars)</span>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="About Your Organization"
          icon="doc"
          description="This description appears on placement and job detail pages visible to candidates"
        >
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <label>Description</label>
            <textarea
              rows={5}
              value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              placeholder="Describe your organization, mission, culture, and what makes you a great place to work..."
            />
            <span className="lbl">Describe your mission, culture, and what makes you a great place to work</span>
          </div>
        </SectionCard>

        <SectionCard
          title="Billing & Legal"
          icon="doc"
          description="Used for invoicing and compliance purposes"
        >
          <div className="row2">
            <div className="field">
              <label>Billing Email</label>
              <input
                type="email"
                value={form.billing_email}
                onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
                placeholder="billing@company.com"
                autoComplete="email"
              />
              <span className="lbl">For invoices and receipts</span>
            </div>
            <div className="field">
              <label>Tax ID / Registration Number</label>
              <input
                value={form.tax_id}
                onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                placeholder="TIN-12345678"
              />
            </div>
          </div>
        </SectionCard>

        <div
          className="mf"
          style={{
            paddingTop: "14px",
            borderTop: "1px solid var(--rule)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={handleReset}
            disabled={saving}
          >
            <span style={{ marginRight: "6px" }}>
              <Icon name="arrow" size={12} />
            </span>
            Reset
          </button>
          <button
            type="submit"
            className="btn btn-sm btn-blue"
            disabled={saving}
          >
            {saving ? (
              <>
                <span
                  className="btn-spinner"
                  style={{
                    width: "14px",
                    height: "14px",
                    border: "2px solid currentColor",
                    borderRightColor: "transparent",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    marginRight: "8px",
                    display: "inline-block",
                  }}
                />
                Saving...
              </>
            ) : (
              <>
                <span style={{ marginRight: "6px" }}>
                  <Icon name="save" size={12} />
                </span>
                Save Profile
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        .section-icon {
          color: var(--blue);
          marginRight: 6px;
          display: inline-flex;
          alignItems: center;
        }
        .form-alert {
          display: flex;
          alignItems: flex-start;
          gap: 10px;
          padding: 12px 16px;
          borderRadius: var(--r-sm);
          fontSize: 12.5px;
          fontWeight: 500;
          fontFamily: var(--mono);
          letterSpacing: 0.06em;
          textTransform: uppercase;
          marginBottom: 14px;
        }
        .form-alert.error {
          background: var(--red-tint);
          border: 1px solid var(--red);
          color: var(--red);
        }
        .form-alert.success {
          background: var(--green-tint);
          border: 1px solid var(--green);
          color: var(--green);
        }
        .alert-icon {
          flexShrink: 0;
          marginTop: 1px;
        }
        .btn-spinner {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </>
  );
}
