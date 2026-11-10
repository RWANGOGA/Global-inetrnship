"use client";

import React from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";

export function StudentDocs() {
  const { docs, resume, uploadResumeFile, uploadDocumentFile, toast } = useApp();
  const [uploadingType, setUploadingType] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  
  const documentTypes = [
    { type: "transcript", label: "Transcript", icon: "TR" },
    { type: "student_id", label: "Student ID", icon: "ID" },
    { type: "national_id", label: "National ID", icon: "NI" },
    { type: "recommendation", label: "Recommendation Letter", icon: "RL" },
    { type: "portfolio", label: "Portfolio", icon: "PF" },
    { type: "testimonial", label: "Testimonial", icon: "TS" },
  ];
  
  const uploadedCount = docs.filter((d) => d.status !== "missing").length + (resume ? 1 : 0);
  const totalCount = documentTypes.length + 1;
  const progress = Math.round((uploadedCount / totalCount) * 100);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploading(true);
      try {
        if (uploadingType === "resume") {
          await uploadResumeFile(file);
        } else if (uploadingType) {
          await uploadDocumentFile(uploadingType, file);
        }
        toast(`${uploadingType === "resume" ? "Resume" : "Document"} uploaded successfully!`);
      } catch {
        toast("Upload failed. Please try again.");
      } finally {
        setUploading(false);
        setUploadingType(null);
        event.target.value = "";
      }
    }
  };

  const openFileDialog = (type: string) => {
    setUploadingType(type);
    inputRef.current?.click();
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      verified: "green",
      pending: "amber",
      rejected: "red",
      missing: "ink",
    };
    return colors[status] || "ink";
  };

  const getStatusClass = (status: string) => {
    const color = getStatusColor(status);
    const classMap: Record<string, string> = {
      green: "tg green",
      amber: "tg gold",
      red: "tg red",
      ink: "tg dark",
    };
    return classMap[color] || "tg";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        hidden
        onChange={handleFileChange}
      />

      {/* Header */}
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
            Documents
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", fontWeight: 500 }}>
            Transcripts, IDs, recommendation letters and testimonials
          </p>
        </div>
        
        {/* Progress indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: "280px" }}>
          <div style={{ 
            flex: 1, 
            maxWidth: "200px",
            height: "8px", 
            background: "var(--rule-2)", 
            borderRadius: "4px", 
            overflow: "hidden" 
          }}>
            <div style={{ 
              width: `${progress}%`, 
              height: "100%", 
              background: "linear-gradient(90deg, var(--blue), var(--blue-2))", 
              borderRadius: "4px",
              transition: "width 0.3s ease",
            }} />
          </div>
          <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--ink)", whiteSpace: "nowrap" }}>
            {uploadedCount} / {totalCount} ({progress}%)
          </span>
        </div>
      </div>

      {/* Resume Section */}
      <div className="panel" style={{ 
        background: "var(--white)", 
        border: "1px solid var(--rule)", 
        borderRadius: "var(--r-xl)", 
        marginBottom: "20px",
        overflow: "hidden",
        boxShadow: "0 1px 3px var(--shadow-1)",
      }}>
        <div className="ph" style={{ 
          background: "linear-gradient(135deg, var(--blue) 0%, var(--blue-2) 100%)",
          color: "white",
          padding: "24px 28px",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ 
                width: "44px", 
                height: "44px", 
                borderRadius: "var(--r-md)", 
                background: "rgba(255,255,255,0.2)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
              }}>
                <Icon name="doc" size={20} />
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: "22px", margin: 0 }}>Resume / CV</h2>
                <p style={{ fontSize: "13px", opacity: 0.85, marginTop: "2px" }}>
                  Your primary resume for all applications
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {resume && (
                <button 
                  type="button" 
                  className="btn btn-sm"
                  onClick={() => window.open(`/resume/download`, "_blank")}
                  style={{ background: "rgba(255,255,255,0.2)", borderColor: "rgba(255,255,255,0.3)", color: "white" }}
                >
                  <Icon name="download" size={13} /> Download
                </button>
              )}
              <button 
                type="button" 
                className="btn btn-sm"
                onClick={() => openFileDialog("resume")}
                style={{ background: "white", color: "var(--blue)", borderColor: "white" }}
              >
                <Icon name={resume ? "upload" : "plus"} size={13} />
                {resume ? "Replace" : "Upload Resume"}
              </button>
            </div>
          </div>
        </div>
        
        <div className="pb" style={{ padding: "28px" }}>
          {resume ? (
            <div style={{ 
              background: "var(--green-tint)", 
              border: "1px solid var(--green)", 
              borderRadius: "var(--r-lg)", 
              padding: "20px",
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: "16px",
              alignItems: "center",
            }}>
              <div style={{ 
                width: "52px", 
                height: "52px", 
                borderRadius: "var(--r-md)", 
                background: "var(--green-tint)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--green)",
                fontWeight: 700,
                fontSize: "14px",
              }}>
                CV
              </div>
              <div>
                <h4 style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)", marginBottom: "6px" }}>
                  Resume uploaded
                </h4>
                <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                  {resume.filename} · {(resume.size_bytes / 1024).toFixed(0)} KB
                </p>
                <p style={{ fontSize: "11px", color: "var(--muted)", marginTop: "4px" }}>
                  Uploaded {new Date(resume.uploaded_at).toLocaleDateString()}
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  type="button" 
                  className="btn btn-sm"
                  onClick={() => window.open(`/resume/download`, "_blank")}
                >
                  <Icon name="download" size={13} /> Download
                </button>
                <button 
                  type="button" 
                  className="btn btn-sm btn-blue"
                  onClick={() => openFileDialog("resume")}
                >
                  <Icon name="upload" size={13} /> Replace
                </button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => openFileDialog("resume")}
              style={{
                border: "2px dashed var(--rule)",
                borderRadius: "var(--r-lg)",
                padding: "40px 24px",
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
                background: uploading && uploadingType === "resume" ? "var(--blue-tint)" : "transparent",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--blue)"; e.currentTarget.style.background = "var(--blue-tint)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--rule)"; e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ 
                width: "56px", 
                height: "56px", 
                borderRadius: "50%", 
                background: "var(--blue-tint)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                margin: "0 auto 16px",
                color: "var(--blue)",
              }}>
                <Icon name="upload" size={24} />
              </div>
              <p style={{ fontWeight: 600, fontSize: "16px", color: "var(--ink)", marginBottom: "6px" }}>
                Upload your Resume / CV
              </p>
              <p style={{ fontSize: "13px", color: "var(--muted)" }}>PDF or Word · up to 10 MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Supporting Documents */}
      <div className="panel" style={{ 
        background: "var(--white)", 
        border: "1px solid var(--rule)", 
        borderRadius: "var(--r-xl)", 
        overflow: "hidden",
        boxShadow: "0 1px 3px var(--shadow-1)",
      }}>
        <div className="ph" style={{ 
          background: "var(--paper-2)",
          padding: "20px 28px",
          borderBottom: "1px solid var(--rule)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ 
                width: "44px", 
                height: "44px", 
                borderRadius: "var(--r-md)", 
                background: "var(--blue-tint)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center",
                color: "var(--blue)",
              }}>
                <Icon name="doc" size={20} />
              </div>
              <div>
                <h2 style={{ fontWeight: 800, fontSize: "22px", margin: 0 }}>Supporting Documents</h2>
                <p style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "2px" }}>
                  {docs.filter(d => d.status !== "missing").length} of {documentTypes.length} uploaded
                </p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="pb" style={{ padding: "28px" }}>
          <div style={{ display: "grid", gap: "16px" }}>
            {documentTypes.map(({ type, label, icon }) => {
              const doc = docs.find((d) => d.name === type);
              const hasDoc = doc && doc.status !== "missing";
              const status = doc?.status || "missing";
              const isUploading = uploading && uploadingType === type;
              
              return (
                <div 
                  key={type}
                  style={{ 
                    background: "var(--white)", 
                    border: "1px solid var(--rule)", 
                    borderRadius: "var(--r-lg)", 
                    padding: "20px",
                    display: "grid",
                    gridTemplateColumns: "auto 1fr auto",
                    gap: "16px",
                    alignItems: "center",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                >
                  <div style={{ 
                    width: "52px", 
                    height: "52px", 
                    borderRadius: "var(--r-md)", 
                    background: "var(--blue-tint)", 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "center",
                    color: "var(--blue)",
                    fontWeight: 700,
                    fontSize: "14px",
                  }}>
                    {icon}
                  </div>
                  
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                      <h4 style={{ fontWeight: 700, fontSize: "15px", color: "var(--ink)", margin: 0 }}>{label}</h4>
                      <span className={getStatusClass(status)}>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                    </div>
                    <p style={{ fontSize: "13px", color: "var(--muted)", margin: 0 }}>
                      {hasDoc 
                        ? `${doc.file} · ${doc.size || ""}`
                        : "Not uploaded yet"
                      }
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${hasDoc ? "" : "btn-blue"}`}
                      onClick={() => openFileDialog(type)}
                      disabled={isUploading}
                      style={{ height: "40px", minWidth: "100px" }}
                    >
                      {isUploading ? (
                        <>
                          <div className="spinner" style={{ width: "14px", height: "14px", border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginRight: "8px" }} />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Icon name={hasDoc ? "upload" : "plus"} size={14} />
                          {hasDoc ? "Replace" : "Upload"}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          
          <div style={{ 
            marginTop: "24px", 
            padding: "16px", 
            background: "var(--paper-2)", 
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--rule)",
          }}>
            <p style={{ fontSize: "12.5px", color: "var(--ink-2)", lineHeight: 1.6, margin: 0 }}>
              <strong style={{ color: "var(--ink)" }}>Note:</strong> Files are reviewed by the placement office within 48 hours. 
              A rejected file keeps its rejection reason so you can replace it without starting over.
            </p>
          </div>
        </div>
      </div>

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
        .dsplit {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .files {
          display: grid;
          gap: 10px;
        }
        .file {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: var(--white);
          border: 1px solid var(--rule);
          border-radius: var(--r-md);
        }
        .fi {
          width: 36px;
          height: 36px;
          border-radius: var(--r-sm);
          background: var(--blue-tint);
          color: var(--blue);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 11px;
          flex-shrink: 0;
        }
        .file > div {
          flex: 1;
          min-width: 0;
        }
        .file > div > b {
          display: block;
          font-size: 13px;
        }
        .file > div > span {
          display: block;
          font-size: 12px;
          color: var(--muted);
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
        .upload {
          border: 2px dashed var(--rule);
          border-radius: var(--r-lg);
          padding: 40px 24px;
          textAlign: center;
          cursor: pointer;
        }
        .upload .ic {
          width: 56px;
          height: 56px;
          borderRadius: 50%;
          background: var(--blue-tint);
          display: flex;
          alignItems: center;
          justifyContent: center;
          margin: 0 auto 16px;
          color: var(--blue);
        }
      `}</style>
    </>
  );
}