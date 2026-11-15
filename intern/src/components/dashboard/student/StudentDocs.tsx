"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import styles from "./StudentDocs.module.css";

const DOCUMENT_TYPES = [
  { type: "transcript", label: "Transcript", icon: "TR" },
  { type: "student_id", label: "Student ID", icon: "ID" },
  { type: "national_id", label: "National ID", icon: "NI" },
  { type: "recommendation", label: "Recommendation letter", icon: "RL" },
  { type: "portfolio", label: "Portfolio", icon: "PF" },
  { type: "testimonial", label: "Testimonial", icon: "TS" },
];

function getStatusClass(status: string) {
  const classes: Record<string, string> = {
    verified: "tg green",
    pending: "tg gold",
    rejected: "tg red",
    missing: "tg dark",
  };
  return classes[status] || "tg dark";
}

export function StudentDocs() {
  const {
    docs,
    documentsStatus,
    isApiEnabled,
    refreshStudentDocuments,
    resume,
    uploadResumeFile,
    uploadDocumentFile,
    toast,
  } = useApp();
  const [uploadingType, setUploadingType] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const uploadedCount =
    docs.filter((document) => document.status !== "missing").length + (resume ? 1 : 0);
  const totalCount = DOCUMENT_TYPES.length + 1;
  const progress = Math.round((uploadedCount / totalCount) * 100);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast("Files must be 10 MB or smaller.");
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      if (uploadingType === "resume") {
        await uploadResumeFile(file);
      } else if (uploadingType) {
        await uploadDocumentFile(uploadingType, file);
      }
      toast(`${uploadingType === "resume" ? "Resume" : "Document"} uploaded and saved.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      setUploadingType(null);
      event.target.value = "";
    }
  };

  const openFileDialog = (type: string) => {
    setUploadingType(type);
    inputRef.current?.click();
  };

  return (
    <div className={styles.page}>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        hidden
        onChange={handleFileChange}
      />

      <div className={`dpane-h ${styles.pageHeader}`}>
        <div>
          <h2>Documents</h2>
          <p>Transcripts, IDs, recommendation letters and testimonials</p>
        </div>
        <div className={styles.progress}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-label="Documents uploaded"
            aria-valuemin={0}
            aria-valuemax={totalCount}
            aria-valuenow={uploadedCount}
          >
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
          <span className={styles.progressLabel}>
            {uploadedCount} / {totalCount} ({progress}%)
          </span>
        </div>
      </div>

      {documentsStatus === "loading" && (
        <div className="panel"><div className="pb" style={{ fontSize: "11px", color: "var(--muted)" }}>Loading document statuses…</div></div>
      )}
      {documentsStatus === "error" && (
        <div className="panel" role="alert">
          <div className="pb" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", color: "var(--red)" }}>Could not load your saved documents. Your previous files have not been changed.</span>
            <button type="button" className="btn btn-sm" disabled={!isApiEnabled} onClick={() => refreshStudentDocuments().catch((error) => toast(error instanceof Error ? error.message : "Could not reload documents"))}>
              Retry
            </button>
          </div>
        </div>
      )}

      <section className="panel">
        <div className={`ph ${styles.panelHeader}`}>
          <div>
            <h3 className={styles.panelTitle}>Resume / CV</h3>
            <p className={styles.panelSubtitle}>Your primary resume for applications</p>
          </div>
          {resume && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => window.open("/resume/download", "_blank")}
            >
              <Icon name="download" size={12} /> Download
            </button>
          )}
        </div>
        <div className={`pb ${styles.panelBody}`}>
          {resume ? (
            <div className={styles.fileRow}>
              <div className={styles.fileBadge}>CV</div>
              <div className={styles.fileDetails}>
                <b>{resume.filename}</b>
                <span>
                  {(resume.size_bytes / 1024).toFixed(0)} KB · Uploaded{" "}
                  {new Date(resume.uploaded_at).toLocaleDateString()}
                </span>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-blue"
                onClick={() => openFileDialog("resume")}
                disabled={uploading}
              >
                <Icon name="upload" size={12} /> Replace
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.uploadPrompt}
              onClick={() => openFileDialog("resume")}
              disabled={uploading}
            >
              <span className={styles.uploadIcon}>
                <Icon name={uploading && uploadingType === "resume" ? "spinner" : "upload"} size={16} />
              </span>
              <span>
                <b>{uploading && uploadingType === "resume" ? "Uploading resume…" : "Upload your resume"}</b>
                <small>PDF or Word · up to 10 MB</small>
              </span>
            </button>
          )}
        </div>
      </section>

      <section className="panel">
        <div className={`ph ${styles.panelHeader}`}>
          <div>
            <h3 className={styles.panelTitle}>Supporting documents</h3>
            <p className={styles.panelSubtitle}>
              {docs.filter((document) => document.status !== "missing").length} of{" "}
              {DOCUMENT_TYPES.length} uploaded
            </p>
          </div>
        </div>
        <div className={`pb ${styles.panelBody}`}>
          {documentsStatus === "ready" ? (
            <>
              <div className={styles.documentList}>
                {DOCUMENT_TYPES.map(({ type, label, icon }) => {
                  const document = docs.find((item) => item.name === type);
                  const hasDocument = document && document.status !== "missing";
                  const status = document?.status || "missing";
                  const isUploading = uploading && uploadingType === type;

                  return (
                    <div className={styles.documentRow} key={type}>
                      <span className={styles.documentIcon} aria-hidden="true">{icon}</span>
                      <div className={styles.documentDetails}>
                        <div className={styles.documentHeading}>
                          <h4>{label}</h4>
                          <span className={getStatusClass(status)}>
                            {status === "missing"
                              ? "Not uploaded"
                              : status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </div>
                        {hasDocument && (
                          <p>
                            {document.file}
                            {document.size ? ` · ${document.size}` : ""}
                            {document.status === "rejected" && document.rejectionReason && (
                              <span style={{ display: "block", color: "var(--red)" }}>
                                Review note: {document.rejectionReason}
                              </span>
                            )}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className={`btn btn-sm ${hasDocument ? "" : "btn-blue"}`}
                        onClick={() => openFileDialog(type)}
                        disabled={uploading}
                      >
                        {isUploading ? (
                          <>
                            <span className={styles.spinner} aria-hidden="true" />
                            Uploading…
                          </>
                        ) : (
                          <>
                            <Icon name={hasDocument ? "upload" : "plus"} size={12} />
                            {hasDocument ? "Replace" : "Upload"}
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>

              <p className={styles.note}>
                Accepted formats: PDF, Word, JPG, and PNG · up to 10 MB. Files are reviewed by the placement office. If a file is rejected, you can replace it without starting over.
              </p>
            </>
          ) : (
            <p className={styles.note}>
              {documentsStatus === "error"
                ? "Document statuses are unavailable. Retry loading them before replacing a file."
                : "Loading saved document statuses…"}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
