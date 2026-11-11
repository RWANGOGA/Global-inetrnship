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
      <label className="lbl" style={{ fontWeight: 600, fontSize: "12px", marginBottom: "6px", display: "block" }}>
        {label} {required && <span style={{ color: "var(--red)" }}>*</span>}
      </label>
      {children}
      {error && <span className="error" style={{ fontSize: "11px", marginTop: "4px", display: "block", color: "var(--red)" }}>{error}</span>}
      {hint && <span className="hint" style={{ fontSize: "10.5px", color: "var(--muted)", marginTop: "4px", display: "block" }}>{hint}</span>}
    </div>
  );
}

function Input({ className = "field-input", style, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={className}
      style={{
        border: "1px solid var(--rule-2)",
        borderRadius: "var(--r-sm)",
        background: "var(--white)",
        height: "44px",
        padding: "0 14px",
        fontSize: "13.5px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; }}
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
        borderRadius: "var(--r-sm)",
        background: "var(--white)",
        minHeight: "96px",
        padding: "12px 14px",
        fontSize: "13.5px",
        outline: 0,
        width: "100%",
        resize: "vertical",
        fontFamily: "inherit",
        transition: "border-color 0.15s, box-shadow 0.15s",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; }}
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
        borderRadius: "var(--r-sm)",
        background: "var(--white)",
        height: "44px",
        padding: "0 14px",
        fontSize: "13.5px",
        outline: 0,
        width: "100%",
        transition: "border-color 0.15s, box-shadow 0.15s",
        appearance: "none",
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='1.5'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 12px center",
        paddingRight: "40px",
        ...style,
      }}
      onFocus={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.boxShadow = "0 0 0 3px var(--blue-tint)"; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = "var(--rule-2)"; e.currentTarget.style.boxShadow = "none"; }}
      {...props}
    />
  );
}

function SectionCard({ title, children, icon }: { title: string; children: React.ReactNode; icon?: IconName }) {
  return (
    <div style={{ background: "var(--white)", border: "1px solid var(--rule)", borderRadius: "var(--r-lg)", padding: "24px", boxShadow: "0 1px 3px var(--shadow-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--rule)" }}>
        {icon && <span style={{ color: "var(--blue)" }}><Icon name={icon} size={20} /></span>}
        <h3 style={{ fontWeight: 700, fontSize: "16px", margin: 0, color: "var(--ink)" }}>{title}</h3>
      </div>
      <div style={{ display: "grid", gap: "16px", gridTemplateColumns: "repeat(2, 1fr)" }}>{children}</div>
    </div>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <div style={{ background: "var(--red-tint)", border: "1px solid var(--red)", borderRadius: "var(--r-md)", padding: "14px 16px", color: "var(--red)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ marginTop: "2px", flexShrink: 0 }}><Icon name="bell" size={16} /></span>
      <span style={{ fontSize: "13.5px", fontWeight: 500 }}>{message}</span>
    </div>
  );
}

function FormSuccess({ message }: { message: string }) {
  return (
    <div style={{ background: "var(--green-tint)", border: "1px solid var(--green)", borderRadius: "var(--r-md)", padding: "14px 16px", color: "var(--green)", display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <span style={{ marginTop: "2px", flexShrink: 0 }}><Icon name="check" size={16} /></span>
      <span style={{ fontSize: "13.5px", fontWeight: 500 }}>{message}</span>
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
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  const orgTypes = ["Company", "Government", "NGO", "University"];

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px", color: "var(--muted)" }}>
        <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ marginTop: "12px" }}>Loading profile...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ textAlign: "center", padding: "60px", color: "var(--muted)" }}>
        <div style={{ opacity: 0.3, marginBottom: "16px" }}>
          <Icon name="bldg" size={48} />
        </div>
        <h3 style={{ fontWeight: 700, fontSize: "18px", marginBottom: "8px", color: "var(--ink)" }}>No organization profile</h3>
        <p>Your organization profile could not be loaded.</p>
      </div>
    );
  }

  return (
    <>
      <div className="dpane-h" style={{ 
        flexWrap: "wrap", 
        gap: "20px", 
        alignItems: "center",
        marginBottom: "8px",
        paddingBottom: "20px",
        borderBottom: "2px solid var(--rule)",
      }}>
        <div style={{ flex: 1, minWidth: "280px" }}>
          <h1 style={{ 
            fontWeight: 800, 
            fontSize: "32px", 
            marginBottom: "8px",
            color: "var(--ink)",
            letterSpacing: "-0.5px",
          }}>
            Organization Profile
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", fontWeight: 500 }}>
            Manage your organization's public profile shown on placement and job detail pages.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {error && <FormError message={error} />}
        {success && <FormSuccess message={success} />}

        <SectionCard title="Basic Information" icon="bldg">
          <Field label="Organization Name" required>
            <Input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Lumen Labs"
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
          <Field label="Logo / Seal" hint="Emoji or short text shown as avatar">
            <Input
              value={form.seal}
              onChange={(e) => setForm({ ...form, seal: e.target.value })}
              placeholder="🏢"
              maxLength={4}
            />
          </Field>
        </SectionCard>

        <SectionCard title="About Your Organization" icon="doc">
          <Field fullWidth label="Description" hint="This appears on placement and job detail pages">
            <Textarea
              rows={5}
              value={form.about}
              onChange={(e) => setForm({ ...form, about: e.target.value })}
              placeholder="Describe your organization, mission, culture, and what makes you a great place to work..."
            />
          </Field>
        </SectionCard>

        <SectionCard title="Billing & Legal (Optional)" icon="doc">
          <Field label="Billing Email" hint="For invoices and receipts">
            <Input
              type="email"
              value={form.billing_email}
              onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
              placeholder="billing@company.com"
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

        <div style={{ 
          display: "flex", 
          gap: "12px", 
          justifyContent: "flex-end", 
          borderTop: "1px solid var(--rule)", 
          paddingTop: "24px", 
          marginTop: "8px" 
        }}>
          <button 
            type="button" 
            className="btn btn-sm" 
            onClick={loadProfile}
            disabled={saving}
            style={{ height: "44px" }}
          >
            <span style={{ marginRight: "8px" }}><Icon name="arrow" size={14} /></span> Reset
          </button>
          <button 
            type="submit" 
            className="btn btn-sm btn-blue" 
            disabled={saving}
            style={{ height: "44px" }}
          >
            {saving ? (
              <>
                <div className="spinner" style={{ width: "16px", height: "16px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "10px" }} />
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
        .panel {
          background: var(--white);
          border: 1px solid var(--rule);
          border-radius: var(--r-lg);
        }
        .ph {
          padding: 16px 20px;
          border-bottom: 1px solid var(--rule);
          background: var(--paper-2);
          border-radius: var(--r-lg) var(--r-lg) 0 0;
        }
        .pb {
          padding: 20px;
        }
        .lbl {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-2);
          margin-bottom: 6px;
        }
        .field-input {
          border: 1px solid var(--rule-2);
          border-radius: var(--r-sm);
          background: var(--white);
          height: 44px;
          padding: 0 14px;
          font-size: 13.5px;
          outline: 0;
          width: 100%;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .field-input:focus {
          border-color: var(--blue);
          box-shadow: 0 0 0 3px var(--blue-tint);
        }
        .field textarea.field-input {
          min-height: 96px;
          padding: 12px 14px;
          resize: vertical;
        }
        .tg {
          display: inline-block;
          padding: 4px 10px;
          border-radius: var(--r-pill);
          font-size: 11px;
          font-weight: 600;
        }
        .tg.blue { background: var(--blue-tint); color: var(--blue); }
        .tg.gold { background: var(--gold-tint); color: var(--gold); }
        .tg.green { background: var(--green-tint); color: var(--green); }
        .tg.red { background: var(--red-tint); color: var(--red); }
        .tg.dark { background: var(--ink-1); color: var(--ink); }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 16px;
          border-radius: var(--r-sm);
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-sm { height: 40px; padding: 0 14px; font-size: 12.5px; }
        .btn-blue { background: var(--blue); color: white; border-color: var(--blue); }
        .btn-blue:hover { background: var(--blue-2); }
        .btn-blue:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: var(--ink); border-color: var(--rule); }
        .btn-ghost:hover { background: var(--paper-2); }
        .spinner {
          animation: spin 0.8s linear infinite;
        }
      `}</style>
    </>
  );
}