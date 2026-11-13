"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { AdvisorAction } from "../../types";
import { voiceService, VoiceOptions } from "../../lib/voice";

interface HumanHandoffData {
  email: string;
  phone: string;
  countryCode: string;
  preferredContact: "whatsapp" | "email" | "";
}

const COUNTRY_CODES = [
  { code: "+1", name: "USA/Canada" },
  { code: "+44", name: "UK" },
  { code: "+49", name: "Germany" },
  { code: "+33", name: "France" },
  { code: "+39", name: "Italy" },
  { code: "+81", name: "Japan" },
  { code: "+86", name: "China" },
  { code: "+91", name: "India" },
  { code: "+61", name: "Australia" },
  { code: "+55", name: "Brazil" },
  { code: "+27", name: "South Africa" },
  { code: "+254", name: "Kenya" },
  { code: "+256", name: "Uganda" },
  { code: "+234", name: "Nigeria" },
  { code: "+233", name: "Ghana" },
  { code: "+20", name: "Egypt" },
  { code: "+971", name: "UAE" },
  { code: "+65", name: "Singapore" },
  { code: "+60", name: "Malaysia" },
  { code: "+63", name: "Philippines" },
  { code: "+62", name: "Indonesia" },
  { code: "+66", name: "Thailand" },
  { code: "+84", name: "Vietnam" },
];

const INTRO_MESSAGE = `Hello! I'm **Brightworks Virtual Assistant**, your dedicated career guide for the BrighterWorks platform. 

I have full knowledge of:
- **All internship & job placements** (companies, government agencies, NGOs, universities)
- **Your complete profile** (skills, course, CGPA, university, documents)
- **Eligibility rules** (course requirements, grade thresholds, required documents)
- **Matching algorithm** (60% skills, 25% course fit, 15% CGPA)
- **Application process** (statements, documents, verification, deadlines)
- **Platform features** (skills extractor, learning resources, talent search, employer tools)

I can help you with:
✅ **Placement matching** – "Which placement fits me best?"
✅ **Eligibility checks** – "Am I eligible for Data Analyst Intern?"
✅ **Skill gaps** – "What should I learn to get more matches?"
✅ **Document status** – "What documents do I still need?"
✅ **Deadlines** – "What are the upcoming deadlines?"
✅ **Applications** – "Help me apply to this placement"
✅ **Voice chat** – Click the 🎤 button to speak with me

For complex issues requiring human assistance (account problems, technical issues, special requests), I'll seamlessly connect you with our support team via **WhatsApp** or **email**.

How can I help you today?`;

export function ChatDrawer() {
  const { 
    isChatOpen, 
    openChat, 
    closeChat, 
    chatMessages, 
    sendChat, 
    askChat,
    student,
    role,
  } = useApp();
  
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [showHandoffForm, setShowHandoffForm] = useState(false);
  const [handoffData, setHandoffData] = useState<HumanHandoffData>({
    email: "",
    phone: "",
    countryCode: "+256",
    preferredContact: "",
  });
  const [handoffSubmitted, setHandoffSubmitted] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const chatLogRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, scrollToBottom]);

  useEffect(() => {
    if (chatLogRef.current) {
      chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
    }
  }, [chatMessages]);

  const handleSend = useCallback(() => {
    if (!inputText.trim()) return;
    sendChat(inputText);
    setInputText("");
  }, [inputText, sendChat]);

  const handleAction = useCallback((action: AdvisorAction) => {
    switch (action.type) {
      case "navigate":
        if (action.payload.dashboard) {
          window.location.hash = String(action.payload.dashboard);
        }
        break;
      case "apply":
        sendChat(`Apply to ${String(action.payload.placementTitle || "this placement")}`);
        break;
      case "check_eligibility":
        sendChat(`Am I eligible for ${String(action.payload.placementTitle || "this placement")}?`);
        break;
      case "open_placement":
        sendChat(`Tell me about ${String(action.payload.placementTitle || "this placement")}`);
        break;
      case "human_handoff":
        setShowHandoffForm(true);
        break;
      case "contact_whatsapp":
        if (handoffData.phone && handoffData.countryCode) {
          const whatsappUrl = `https://wa.me/${handoffData.countryCode.replace("+", "")}${handoffData.phone.replace(/\D/g, "")}?text=Hello%20Brightworks%20Support%2C%20I%20need%20assistance%20with%20my%20account.`;
          window.open(whatsappUrl, "_blank");
        }
        break;
      case "contact_email":
        if (handoffData.email) {
          const mailtoUrl = `mailto:support@brightworks.com?subject=Support%20Request&body=Hello%20Brightworks%20Support%2C%0A%0AI%20need%20assistance%20with%20my%20account.%0A%0AEmail%3A%20${encodeURIComponent(handoffData.email)}%0APhone%3A%20${encodeURIComponent(handoffData.countryCode + handoffData.phone)}`;
          window.open(mailtoUrl, "_blank");
        }
        break;
      default:
        break;
    }
  }, [sendChat, handoffData]);

  const startRecording = useCallback(async () => {
    try {
      await voiceService.startRecording();
      setIsRecording(true);
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      const audioBlob = await voiceService.stopRecording();
      setIsRecording(false);
      
      // Convert speech to text
      const text = await voiceService.speechToText(audioBlob);
      if (text.trim()) {
        setInputText(text);
        handleSend();
      }
    } catch (error) {
      console.error("Recording failed:", error);
      setIsRecording(false);
    }
  }, [handleSend]);

  const cancelRecording = useCallback(() => {
    voiceService.cancelRecording();
    setIsRecording(false);
  }, []);

  const playMessage = useCallback(async (text: string) => {
    if (isPlaying && currentAudio) {
      voiceService.stopAudio(currentAudio);
      setIsPlaying(false);
      return;
    }

    try {
      const audio = await voiceService.textToSpeech(text, { lang: "EN-US" });
      if (audio) {
        setCurrentAudio(audio);
        setIsPlaying(true);
        await voiceService.playAudio(audio);
        setIsPlaying(false);
        setCurrentAudio(null);
      }
    } catch (error) {
      console.error("TTS failed:", error);
      setIsPlaying(false);
    }
  }, [isPlaying, currentAudio]);

  const handleHandoffSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    // Here you would typically send the handoff data to your backend
    console.log("Human handoff requested:", handoffData);
    setHandoffSubmitted(true);
    // Show success message in chat
    sendChat(`Thank you! Your request has been forwarded to our support team. We'll contact you via ${handoffData.preferredContact === "whatsapp" ? "WhatsApp" : "email"} at ${handoffData.preferredContact === "whatsapp" ? handoffData.countryCode + handoffData.phone : handoffData.email} within 24 hours.`);
    setShowHandoffForm(false);
  }, [handoffData, sendChat]);

  const renderHandoffForm = () => {
    if (handoffSubmitted) {
      return (
        <div className="handoff-success" style={{ padding: "16px", textAlign: "center" }}>
          <Icon name="check" size={24} className="success-icon" />
          <h4 style={{ margin: "0 0 8px" }}>Request Submitted!</h4>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--muted)" }}>
            Our team will contact you within 24 hours via {handoffData.preferredContact === "whatsapp" ? "WhatsApp" : "email"}.
          </p>
          <button 
            type="button" 
            className="btn btn-sm"
            style={{ marginTop: "12px" }}
            onClick={() => { setHandoffSubmitted(false); setShowHandoffForm(false); }}
          >
            Close
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleHandoffSubmit} className="handoff-form" style={{ display: "grid", gap: "12px", padding: "16px" }}>
        <h4 style={{ margin: "0 0 8px" }}>Connect with Human Support</h4>
        <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>
          For complex issues, our team will reach out directly. Choose your preferred contact method.
        </p>
        
        <div style={{ display: "grid", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500 }}>Email Address *</label>
          <input
            type="email"
            required
            value={handoffData.email}
            onChange={(e) => setHandoffData({ ...handoffData, email: e.target.value })}
            placeholder="your@email.com"
            className="input"
            style={{ padding: "10px 12px", fontSize: "13px" }}
          />
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500 }}>Phone Number with Country Code *</label>
          <div style={{ display: "flex", gap: "8px" }}>
            <select
              value={handoffData.countryCode}
              onChange={(e) => setHandoffData({ ...handoffData, countryCode: e.target.value })}
              className="input"
              style={{ width: "100px", padding: "10px 8px", fontSize: "13px" }}
            >
              {COUNTRY_CODES.map(({ code, name }) => (
                <option key={code} value={code}>{code} {name}</option>
              ))}
            </select>
            <input
              type="tel"
              required
              value={handoffData.phone}
              onChange={(e) => setHandoffData({ ...handoffData, phone: e.target.value })}
              placeholder="Phone number"
              className="input"
              style={{ flex: 1, padding: "10px 12px", fontSize: "13px" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: 500 }}>Preferred Contact Method *</label>
          <div style={{ display: "flex", gap: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="contact"
                value="whatsapp"
                checked={handoffData.preferredContact === "whatsapp"}
                onChange={(e) => setHandoffData({ ...handoffData, preferredContact: e.target.value as "whatsapp" })}
              />
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Icon name="send" size={16} />
                WhatsApp
              </span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="contact"
                value="email"
                checked={handoffData.preferredContact === "email"}
                onChange={(e) => setHandoffData({ ...handoffData, preferredContact: e.target.value as "email" })}
              />
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <Icon name="inbox" size={16} />
                Email
              </span>
            </label>
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button type="submit" className="btn" style={{ flex: 1 }} disabled={!handoffData.email || !handoffData.phone || !handoffData.preferredContact}>
            Submit Request
          </button>
          <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowHandoffForm(false)}>
            Cancel
          </button>
        </div>
      </form>
    );
  };

  const handleVoiceToggle = () => {
    setVoiceEnabled(!voiceEnabled);
    if (!voiceEnabled) {
      // Play introduction when voice is first enabled
      playMessage(INTRO_MESSAGE);
    }
  };

  return (
    <>
      <button type="button" className="chat-fab" onClick={openChat}>
        <span className="dot"></span> Ask Brightworks
      </button>

      <div
        className={`drawer-veil ${isChatOpen ? "on" : ""}`}
        id="chatVeil"
        onClick={closeChat}
      ></div>

      <aside className={`chat ${isChatOpen ? "on" : ""}`} id="chat">
        <div className="chat-h">
          <div>
            <b>Brightworks Virtual Assistant</b>
            <div className="st">
              <i></i> {voiceEnabled ? "Voice enabled 🎙️" : "Knows your skills, placements & record"}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button 
              type="button" 
              className={`btn-icon ${voiceEnabled ? "active" : ""}`}
              onClick={handleVoiceToggle}
              aria-label={voiceEnabled ? "Disable voice" : "Enable voice"}
              style={{ 
                background: voiceEnabled ? "var(--brand)" : "transparent",
                color: voiceEnabled ? "white" : "inherit",
                borderRadius: "50%",
                width: "32px",
                height: "32px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Icon name={voiceEnabled ? "bell" : "send"} size={16} />
            </button>
            <button type="button" onClick={closeChat} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        <div className="chat-b" id="chatLog" ref={chatLogRef}>
          {chatMessages.length === 0 && (
            <div className="msg bot" style={{ animation: "fadeIn 0.3s ease" }}>
              <div className="who">Brightworks Virtual Assistant</div>
              <span dangerouslySetInnerHTML={{ __html: INTRO_MESSAGE }} />
            </div>
          )}
          
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`msg ${msg.who === "INTERN" ? "bot" : "me"}`}
              style={{ animation: "fadeIn 0.2s ease" }}
            >
              {msg.who === "INTERN" && <div className="who">Brightworks Virtual Assistant</div>}
              {msg.isTyping ? (
                <span
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "10px",
                    letterSpacing: ".25em",
                  }}
                >
                  ···
                </span>
              ) : (
                <>
                  <span 
                    dangerouslySetInnerHTML={{ __html: msg.text }} 
                    ref={(el) => {
                      if (el && voiceEnabled && msg.who === "INTERN" && !msg.isTyping) {
                        // Auto-play bot messages when voice is enabled
                        setTimeout(() => playMessage(el.textContent || ""), 100);
                      }
                    }}
                  />
                  {msg.actions && msg.actions.length > 0 && (
                    <div
                      className="msg-actions"
                      style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}
                    >
                      {msg.actions.map((action: AdvisorAction, idx: number) => (
                        <button
                          key={idx}
                          type="button"
                          className="btn btn-sm"
                          style={{ fontSize: "11px" }}
                          onClick={() => handleAction(action)}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
          
          {showHandoffForm && (
            <div className="msg bot" style={{ animation: "slideUp 0.3s ease" }}>
              <div className="who">Brightworks Virtual Assistant</div>
              {renderHandoffForm()}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-q">
          <button
            type="button"
            onClick={() => askChat("Am I eligible for the Data Analyst Intern?")}
          >
            Am I eligible?
          </button>
          <button
            type="button"
            onClick={() => askChat("What documents do I still need?")}
          >
            What do I need to upload?
          </button>
          <button
            type="button"
            onClick={() => askChat("Which placement fits me best?")}
          >
            Which placement fits me best?
          </button>
          <button
            type="button"
            onClick={() => askChat("What should I learn to get more matches?")}
          >
            What should I learn?
          </button>
        </div>

        <div className="chat-in">
          {isRecording ? (
            <div className="voice-recording" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 12px", background: "var(--brand-bg)", borderRadius: "8px", marginBottom: "8px" }}>
              <div className="recording-indicator" style={{ 
                width: "10px", height: "10px", borderRadius: "50%", background: "var(--danger)", 
                animation: "pulse 1s infinite" 
              }} />
              <span style={{ fontSize: "13px", color: "var(--danger)", fontWeight: 500 }}>Recording... Click to stop</span>
              <button 
                type="button" 
                className="btn btn-sm btn-danger" 
                onClick={stopRecording}
                style={{ marginLeft: "auto" }}
              >
                Stop
              </button>
              <button 
                type="button" 
                className="btn btn-sm btn-secondary" 
                onClick={cancelRecording}
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`voice-btn ${voiceEnabled ? "enabled" : ""}`}
                onClick={startRecording}
                disabled={isRecording}
                aria-label="Voice input"
                style={{
                  background: voiceEnabled ? "var(--brand)" : "transparent",
                  color: voiceEnabled ? "white" : "inherit",
                  border: "none",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
              >
                <Icon name="send" size={18} />
              </button>
              <input
                id="chatText"
                placeholder="Ask about a placement, a requirement or your file"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
              />
              <button type="button" onClick={handleSend} aria-label="Send">
                <Icon name="arrow" size={15} />
              </button>
            </>
          )}
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideUp {
            from { opacity: 0; transform: translateY(16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          .voice-recording {
            animation: slideUp 0.2s ease;
          }
          .handoff-form input, .handoff-form select {
            border: 1px solid var(--rule);
            border-radius: 6px;
            background: var(--bg);
            color: var(--fg);
          }
          .handoff-form input:focus, .handoff-form select:focus {
            outline: none;
            border-color: var(--brand);
            box-shadow: 0 0 0 2px var(--brand-bg);
          }
          .btn-icon.active {
            box-shadow: 0 0 0 2px var(--brand-bg);
          }
          .voice-btn {
            margin-right: 8px;
          }
          .voice-btn.enabled {
            box-shadow: 0 0 0 2px var(--brand-bg);
          }
        `}</style>
      </aside>
    </>
  );
}