"use client";

import React, { useState, useRef, useEffect } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";

function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br/>");
}

export function AssistantWidget() {
  const { chatMessages, sendChat, role } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, open]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);
    sendChat(text);
    // busy clears after a short delay (sendChat handles async internally)
    setTimeout(() => setBusy(false), 800);
  };

  if (!open) {
    return (
      <button
        type="button"
        aria-label="Open Brightworks Virtual Assistant"
        onClick={() => setOpen(true)}
        className="assistant-fab"
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: "var(--blue)",
          color: "var(--white)",
          border: "none",
          boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 900,
        }}
      >
        <Icon name="bell" size={22} />
      </button>
    );
  }

  return (
    <>
      <div
        style={{
          position: "fixed",
          right: "20px",
          bottom: "20px",
          width: "380px",
          maxWidth: "calc(100vw - 32px)",
          height: "560px",
          maxHeight: "calc(100vh - 40px)",
          background: "var(--white)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          zIndex: 900,
          overflow: "hidden",
          border: "1px solid var(--rule)",
        }}
      >
        <div
          style={{
            background: "var(--ink)",
            color: "var(--paper)",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: "var(--blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--white)",
                fontSize: "14px",
                fontWeight: 700,
              }}
            >
              B
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "14px" }}>Brightworks Virtual Assistant</div>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>Career coach · {role}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            style={{ background: "transparent", border: "none", color: "var(--paper)", cursor: "pointer", fontSize: "18px", lineHeight: 1 }}
            aria-label="Close assistant"
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px", background: "var(--paper)" }}>
          {chatMessages.map((m) => {
            const mine = m.who === "me";
            return (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: mine ? "flex-end" : "flex-start",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    maxWidth: "85%",
                    padding: "10px 14px",
                    borderRadius: "var(--r-lg)",
                    background: mine ? "var(--blue)" : "var(--white)",
                    color: mine ? "var(--white)" : "var(--ink)",
                    fontSize: "13.5px",
                    lineHeight: 1.5,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    border: mine ? "none" : "1px solid var(--rule)",
                  }}
                >
                  <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }} />
                  {m.actions && m.actions.length > 0 && (
                    <div style={{ marginTop: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {m.actions.map((a, i) => (
                        <button
                          key={i}
                          type="button"
                          className="btn btn-sm btn-ghost"
                          onClick={() => {
                            if (a.type === "navigate" && a.payload && typeof a.payload.path === "string") {
                              window.location.hash = a.payload.path;
                            }
                          }}
                          style={{ fontSize: "11px" }}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        <form
          onSubmit={submit}
          style={{
            padding: "12px",
            borderTop: "1px solid var(--rule)",
            background: "var(--white)",
            display: "flex",
            gap: "8px",
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about placements, skills, deadlines…"
            style={{
              flex: 1,
              height: "40px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--rule-2)",
              padding: "0 12px",
              fontSize: "13.5px",
              outline: "none",
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="btn btn-blue"
            style={{ height: "40px", padding: "0 16px" }}
          >
            Send
          </button>
        </form>
      </div>
    </>
  );
}
