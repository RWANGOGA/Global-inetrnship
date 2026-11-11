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

function Field({ label, required, children, error, hint, fullWidth }: { label: string; required?: boolean; children: React.ReactNode; error?: string; hint?: string; fullWidth?: boolean }) {
  return (
    <div className="field" style={fullWidth ? { gridColumn: "1 / -1" } : {}}>
      <label className="lbl" style={{ fontWeight: 600, fontSize: "12.5px", marginBottom: "6px", display: "block", color: "var(--ink-2)", letterSpacing: "0.01em" }}>
        {label} {required && <span style={{ color: "var(--red)", marginLeft: "2px" }}>*</span>}
      </label>
      {children}
      {error && <span className="error" style={{ fontSize: "11.5px", marginTop: "6px", display: "block", color: "var(--red)", fontWeight: 500 }}>{error}</span>}
      {hint && !error && <span className="hint" style={{ fontSize: "11px", color: "var(--muted)", marginTop: "6px", display: "block" }}>{hint}</span>}
    </div>
  );
}

function Input({ className = "field-input", style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-md)",
        background: "var(--white)",
        height: "48px",
        padding: "0 16px",
        fontSize: "14px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; e.currentTarget.style.background = "var(--white)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "var(--white)"; }}
      {...props}
    />
  );
}

function Textarea({ className = "field-input", style, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-md)",
        background: "var(--white)",
        minHeight: "112px",
        padding: "14px 16px",
        fontSize: "14px",
        outline: 0,
        width: "100%",
        resize: "vertical",
        fontFamily: "inherit",
        lineHeight: 1.55,
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; e.currentTarget.style.background = "var(--white)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "var(--white)"; }}
      {...props}
    />
  );
}

function Select({ className = "field-input", style, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-md)",
        background: "var(--white)",
        height: "48px",
        padding: "0 16px",
        fontSize: "14px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
        appearance: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 14px center",
        paddingRight: "44px",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; e.currentTarget.style.background = "var(--white)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "var(--white)"; }}
      {...props}
    />
  );
}

function SectionCard({ title, children, icon, description }: { title: string; children: React.ReactNode; icon?: IconName; description?: string }) {
  return (
    <div className="section-card">
      <div className="section-header">
        {icon && <span className="section-icon"><Icon name={icon} size={20} /></span>}
        <div>
          <h3 className="section-title">{title}</h3>
          {description && <p className="section-description">{description}</p>}
        </div>
      </div>
      <div className="section-content">{children}</div>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div className="form-alert error">
      <span className="alert-icon"><Icon name="bell" size={16} /></span>
      <span className="alert-message">{message}</span>
    </div>
  );
}

function FormSuccess({ message }: { message: string }) {
  return (
    <div className="form-alert success">
      <span className="alert-icon"><Icon name="check" size={16} /></span>
      <span className="alert-message">{message}</span>
    </div>
  );
}

function LoadingSpinner({ size = 32, color = "var(--blue)", text }: { size?: number; color?: string; text?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px", color: "var(--muted)" }}>
      <div className="spinner" style={{ width: size, height: size, border: `3px solid var(--rule-2)`, borderTopColor: color, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      {text && <span style={{ marginTop: "12px", fontSize: "14px", color: "var(--ink-2)" }}>{text}</span>}
    </div>
  );
}

function EmptyState({ icon, title, description }: { icon: IconName; title: string; description: string }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--muted)" }}>
      <div style={{ opacity: 0.25, marginBottom: "20px" }}>
        <Icon name={icon} size={56} />
      </div>
      <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>{title}</h3>
      <p style={{ fontSize: "14.5px", lineHeight: 1.6, maxWidth: "320px", margin: "0 auto" }}>{description}</p>
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
    return <EmptyState icon="bldg" title="No organization profile" description="Your organization profile could not be loaded. Please contact support if this persists." />;
  }

  return (
    <>
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1 className="page-title">Organization Profile</h1>
            <p className="page-subtitle">Manage your organization's public profile shown on placement and job detail pages.</p>
          </div>
          <div className="header-badge">
            <span className="tg blue"><Icon name="bldg" size={12} /> {profile.type}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="profile-form">
        {error && <FormError message={error} />}
        {success && <FormSuccess message={success} />}

        <SectionCard 
          title="Basic Information" 
          icon="bldg"
          description="Core details that appear across the platform"
        >
          <Field label="Organization Name" required>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Lumen Labs"
              autoComplete="organization"
            />
          </Field>
          <Field label="Organization Type" required>
            <Select
              required
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {orgTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </Select>
          </Field>
          <Field label="Sector" hint="e.g., Technology, Finance, Healthcare">
            <Input
              value={form.sector}
              onChange={(e) => setForm({ ...form, sector: e.target.value })}
              placeholder="Technology"
            />
          </Field>
          <Field label="Location" hint="City, Country">
            <Input
              value={form.loc}
              onChange={(e) => setForm({ ...form, loc: e.target.value })}
              placeholder="Kampala, Uganda"
            />
          </Field>
          <Field label="Logo / Seal" hint="Emoji or short text shown as avatar (max 4 chars)">
            <Input
              value={form.seal}
              onChange={(e) => setForm({ ...form, seal: e.target.value })}
              placeholder="🏢"
              maxLength={4}
              style={{ textAlign: "center", fontSize: "20px" }}
            />
          </Field>
        </SectionCard>

        <SectionCard 
          title="About Your Organization" 
          icon="doc"
          description="This description appears on placement and job detail pages visible to candidates"
        >
          <Field fullWidth label="Description" hint="Describe your mission, culture, and what makes you a great place to work">
            <Textarea
              rows={5}
              value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              placeholder="Describe your organization, mission, culture, and what makes you a great place to work..."
            />
          </Field>
        </SectionCard>

        <SectionCard 
          title="Billing & Legal (Optional)" 
          icon="doc"
          description="Used for invoicing and compliance purposes"
        >
          <Field label="Billing Email" hint="For invoices and receipts">
            <Input
              type="email"
              value={form.billing_email}
              onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
              placeholder="billing@company.com"
              autoComplete="email"
            />
          </Field>
          <Field label="Tax ID / Registration Number">
            <Input
              value={form.tax_id}
              onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
              placeholder="TIN-12345678"
            />
          </Field>
        </SectionCard>

        <div className="form-actions">
          <button 
            type="button" 
            className="btn btn-sm btn-ghost" 
            onClick={handleReset}
            disabled={saving}
          >
            <span style={{ marginRight: "8px" }}><Icon name="arrow" size={14} /></span> Reset
          </button>
          <button 
            type="submit" 
            className="btn btn-sm btn-blue" 
            disabled={saving}
          >
            {saving ? (
              <>
                <span className="btn-spinner" style={{ width: "16px", height: "16px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "10px", display: "inline-block" }} />
                Saving...
              </>
            ) : (
              <>
                <span style={{ marginRight: "8px" }}><Icon name="save" size={14} /></span> Save Profile
              </>
            )}
          </button>
        </div>
      </form>

      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .page-header {
          padding: 8px 0 24px;
          border-bottom: 2px solid var(--rule);
          margin-bottom: 8px;
        }
        .header-content {
          display: flex;
          alignItems: center;
          justifyContent: space-between;
          flexWrap: wrap;
          gap: 16px;
        }
        .page-title {
          fontWeight: 800;
          fontSize: 32px;
          marginBottom: 6px;
          color: var(--ink);
          letterSpacing: -0.5px;
          lineHeight: 1.15;
        }
        .page-subtitle {
          color: var(--ink-2);
          fontSize: 15px;
          fontWeight: 500;
          margin: 0;
        }
        .header-badge {
          flexShrink: 0;
        }
        .profile-form {
          display: flex;
          flexDirection: column;
          gap: 24px;
        }
        .section-card {
          background: var(--white);
          border: 1px solid var(--rule);
          borderRadius: var(--r-xl);
          padding: 28px;
          boxShadow: 0 1px 3px var(--shadow-1), 0 0 0 1px var(--rule-2);
        }
        .section-header {
          display: flex;
          alignItems: flex-start;
          gap: 12px;
          marginBottom: 24px;
          paddingBottom: 18px;
          borderBottom: 1px solid var(--rule);
        }
        .section-icon {
          color: var(--blue);
          flexShrink: 0;
          marginTop: 2px;
        }
        .section-title {
          fontWeight: 700;
          fontSize: 17px;
          margin: 0 0 4px;
          color: var(--ink);
          letterSpacing: -0.01em;
        }
        .section-description {
          fontSize: 13px;
          color: var(--muted);
          margin: 0;
          fontWeight: 400;
        }
        .section-content {
          display: grid;
          gap: 20px;
          gridTemplateColumns: repeat(2, 1fr);
        }
        .field {
          minWidth: 0;
        }
        .lbl {
          display: block;
          fontWeight: 600;
          fontSize: 12.5px;
          marginBottom: 6px;
          color: var(--ink-2);
          letterSpacing: 0.01em;
        }
        .field-input {
          border: 1px solid var(--rule-2);
          borderRadius: var(--r-md);
          background: var(--white);
          height: 48px;
          padding: 0 16px;
          fontSize: 14px;
          outline: 0;
          width: 100%;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
        }
        .field-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px var(--blue-tint);
          background: var(--white);
        }
        .field-input::placeholder {
          color: var(--muted);
        }
        .field textarea.field-input {
          min-height: 112px;
          padding: 14px 16px;
          resize: vertical;
          lineHeight: 1.55;
        }
        .form-alert {
          display: flex;
          alignItems: flex-start;
          gap: 12px;
          padding: 16px 18px;
          borderRadius: var(--r-md);
          fontSize: 13.5px;
          fontWeight: 500;
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
        .form-actions {
          display: flex;
          gap: 12px;
          justifyContent: flex-end;
          borderTop: 1px solid var(--rule);
          paddingTop: 28px;
          marginTop: 8px;
        }
        .btn {
          display: inline-flex;
          alignItems: center;
          justifyContent: center;
          gap: 8px;
          padding: 0 20px;
          borderRadius: var(--r-md);
          fontSize: 13.5px;
          fontWeight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-sm { height: 44px; padding: 0 18px; font-size: 13px; }
        .btn-blue { background: var(--blue); color: white; border-color: var(--blue); }
        .btn-blue:hover:not(:disabled) { background: var(--blue-2); }
        .btn-blue:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
        .btn-ghost:hover:not(:disabled) { background: var(--paper-2); }
        .btn-ghost:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-spinner { animation: spin 0.8s linear infinite; }
        
        @media (max-width: 768px) {
          .section-content {
            gridTemplateColumns: 1fr;
          }
          .page-title { fontSize: 26px; }
          .header-content { flexDirection: column; alignItems: flex-start; }
        }
      `}</style>
    </>
  );
}