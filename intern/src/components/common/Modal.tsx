"use client";

import React from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";

export function Modal() {
  const { modal, closeModal, modalConfirm } = useApp();

  if (!modal) return null;

  return (
    <div
      className="modal on"
      id="modal"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === "modal") closeModal();
      }}
    >
      <div className="mcard">
        <div className="mh">
          <h3 id="modalTitle">{modal.title}</h3>
          <button type="button" onClick={closeModal} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="mb" id="modalBody">
          {modal.body}
        </div>
        <div className="mf">
          {/* Read-only modals (no confirm action) are dismissed, not cancelled. */}
          <button type="button" className="btn btn-sm" onClick={closeModal}>
            {modal.okLabel ? "Cancel" : "Close"}
          </button>
          {modal.okLabel && (
            <button
              type="button"
              className="btn btn-sm btn-blue"
              id="modalOk"
              onClick={modalConfirm}
            >
              {modal.okLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
