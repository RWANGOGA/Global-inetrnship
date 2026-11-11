"use client";

import React from "react";
import { Icon } from "../icons/Icons";

interface DataStateProps<T> {
  /** Current state of the data fetch */
  state: "loading" | "ready" | "error";
  /** Error message when state is "error" */
  error?: string;
  /** Items array when state is "ready" */
  items?: T[];
  /** Message to show when empty */
  emptyMessage?: string;
  /** Optional icon for empty state */
  emptyIcon?: string;
  /** Render function for each item */
  children?: (item: T, index: number) => React.ReactNode;
  /** Custom loading message */
  loadingMessage?: string;
  /** Custom error message */
  errorMessage?: string;
  /** Table column count for colSpan */
  colSpan?: number;
  /** Custom empty state render */
  renderEmpty?: () => React.ReactNode;
  /** Custom loading render */
  renderLoading?: () => React.ReactNode;
  /** Custom error render */
  renderError?: (error: string) => React.ReactNode;
}

export function DataState<T>({
  state,
  error,
  items,
  emptyMessage = "No items found",
  emptyIcon = "inbox",
  children,
  loadingMessage = "Loading...",
  errorMessage = "Unable to load data",
  colSpan,
  renderEmpty,
  renderLoading,
  renderError,
}: DataStateProps<T>) {
  if (state === "loading") {
    return renderLoading ? (
      renderLoading()
    ) : (
      <tr>
        <td colSpan={colSpan || 1} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <div className="spinner" style={{ width: "32px", height: "32px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <span>{loadingMessage}</span>
          </div>
        </td>
      </tr>
    );
  }

  if (state === "error") {
    return renderError ? (
      renderError(error || errorMessage)
    ) : (
      <tr>
        <td colSpan={colSpan || 1} style={{ textAlign: "center", padding: "40px", color: "var(--red)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <span style={{ opacity: 0.5 }}>
              <Icon name="alert-triangle" size={48} />
            </span>
            <span>{error || errorMessage}</span>
          </div>
        </td>
      </tr>
    );
  }

  if (!items || items.length === 0) {
    return renderEmpty ? (
      renderEmpty()
    ) : (
      <tr>
        <td colSpan={colSpan || 1} style={{ textAlign: "center", padding: "40px", color: "var(--muted)" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <span style={{ opacity: 0.3 }}>
              <Icon name={emptyIcon as any} size={48} />
            </span>
            <span>{emptyMessage}</span>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      {items.map((item, index) => children?.(item, index))}
    </>
  );
}

/** Simplified version for non-table contexts (cards, lists, etc.) */
interface SimpleDataStateProps {
  state: "loading" | "ready" | "error";
  error?: string;
  items?: unknown[];
  emptyMessage?: string;
  emptyIcon?: string;
  loadingMessage?: string;
  errorMessage?: string;
  renderItem?: (item: unknown, index: number) => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  renderLoading?: () => React.ReactNode;
  renderError?: (error: string) => React.ReactNode;
  containerClassName?: string;
}

export function SimpleDataState({
  state,
  error,
  items,
  emptyMessage = "No items found",
  emptyIcon = "inbox",
  loadingMessage = "Loading...",
  errorMessage = "Unable to load data",
  renderItem,
  renderEmpty,
  renderLoading,
  renderError,
  containerClassName = "",
}: SimpleDataStateProps) {
  if (state === "loading") {
    return renderLoading ? (
      renderLoading()
    ) : (
      <div className={containerClassName} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "16px" }}>
        <div className="spinner" style={{ width: "40px", height: "40px", border: "3px solid var(--rule-2)", borderTopColor: "var(--blue)", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        <span style={{ color: "var(--muted)" }}>{loadingMessage}</span>
      </div>
    );
  }

  if (state === "error") {
    return renderError ? (
      renderError(error || "An error occurred")
    ) : (
      <div className={containerClassName} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "16px", color: "var(--red)" }}>
        <span style={{ opacity: 0.5 }}>
          <Icon name="alert-triangle" size={48} />
        </span>
        <span>{error || "An error occurred"}</span>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return renderEmpty ? (
      renderEmpty()
    ) : (
      <div className={containerClassName} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", gap: "16px", color: "var(--muted)" }}>
        <span style={{ opacity: 0.3 }}>
          <Icon name={emptyIcon as any} size={48} />
        </span>
        <span>{emptyMessage}</span>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      {items.map((item, index) => renderItem?.(item, index))}
    </div>
  );
}