"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { AdvisorAction } from "../../types";
import { voiceService, VoiceOptions } from "../../lib/voice";

const INTRO_MESSAGE = `Hi! I'm **Brightworks Virtual Assistant** — your career coach for BrighterWorks. I know your profile, all the placements, and can help with eligibility, applications, skill gaps, deadlines, and more. What can I help you with today?`;

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
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "speaking" | "ready">("idle");
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
      default:
        break;
    }
  }, [sendChat]);

  const startRecording = useCallback(async () => {
    try {
      await voiceService.startRecording();
      setIsRecording(true);
      setVoiceState("listening");
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not access microphone. Please check permissions.");
    }
  }, []);

  const stopRecording = useCallback(async () => {
    try {
      const audioBlob = await voiceService.stopRecording();
      setIsRecording(false);
      setVoiceState("ready");
      
      // Convert speech to text
      const text = await voiceService.speechToText(audioBlob);
      if (text.trim()) {
        setInputText(text);
        handleSend();
      }
    } catch (error) {
      console.error("Recording failed:", error);
      setIsRecording(false);
      setVoiceState("idle");
    }
  }, [handleSend]);

  const cancelRecording = useCallback(() => {
    voiceService.cancelRecording();
    setIsRecording(false);
    setVoiceState("idle");
  }, []);

  const playMessage = useCallback(async (text: string) => {
    if (isPlaying && currentAudio) {
      voiceService.stopAudio(currentAudio);
      setIsPlaying(false);
      setVoiceState(voiceEnabled ? "ready" : "idle");
      return;
    }

    try {
      setVoiceState("speaking");
      const audio = await voiceService.textToSpeech(text, { lang: "EN-US" });
      if (audio) {
        setCurrentAudio(audio);
        setIsPlaying(true);
        await voiceService.playAudio(audio);
        setIsPlaying(false);
        setCurrentAudio(null);
        setVoiceState(voiceEnabled ? "ready" : "idle");
      }
    } catch (error) {
      console.error("TTS failed:", error);
      setIsPlaying(false);
      setVoiceState(voiceEnabled ? "ready" : "idle");
    }
  }, [isPlaying, currentAudio, voiceEnabled]);

  const handleVoiceToggle = useCallback(() => {
    setVoiceEnabled(!voiceEnabled);
    if (!voiceEnabled) {
      // Play introduction when voice is first enabled
      playMessage(INTRO_MESSAGE);
      setVoiceState("ready");
    } else {
      setVoiceState("idle");
      if (isPlaying && currentAudio) {
        voiceService.stopAudio(currentAudio);
        setIsPlaying(false);
      }
    }
  }, [voiceEnabled, playMessage, isPlaying, currentAudio]);

  // Auto-play bot messages when voice is enabled
  useEffect(() => {
    if (voiceEnabled && chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.who === "INTERN" && !lastMsg.isTyping && lastMsg.text !== INTRO_MESSAGE) {
        const timer = setTimeout(() => playMessage(lastMsg.text), 500);
        return () => clearTimeout(timer);
      }
    }
  }, [chatMessages, voiceEnabled, playMessage]);

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
          <div className="chat-header-left">
            <div className="assistant-avatar" aria-hidden="true">
              <Icon name="user" size={20} />
            </div>
            <div className="assistant-info">
              <b>Brightworks Virtual Assistant</b>
              <span className="assistant-status">
                {voiceEnabled && (
                  <>
                    <span className={`voice-indicator ${voiceState}`} aria-hidden="true"></span>
                    {voiceState === "listening" && "Listening..."}
                    {voiceState === "speaking" && "Speaking..."}
                    {voiceState === "ready" && "Voice ready"}
                    {voiceState === "idle" && "Voice on"}
                  </>
                )}
                {!voiceEnabled && "Your career coach"}
              </span>
            </div>
          </div>
          <div className="chat-header-right">
            <button 
              type="button" 
              className={`voice-toggle ${voiceEnabled ? "active" : ""} ${voiceState !== "idle" ? "pulse" : ""}`}
              onClick={handleVoiceToggle}
              aria-label={voiceEnabled ? "Disable voice" : "Enable voice"}
              aria-pressed={voiceEnabled}
            >
              <Icon name={voiceEnabled ? "bell" : "send"} size={20} />
              <span className="voice-tooltip">{voiceEnabled ? "Voice on" : "Voice off"}</span>
            </button>
            <button type="button" onClick={closeChat} aria-label="Close chat" className="close-btn">
              <Icon name="x" size={18} />
            </button>
          </div>
        </div>

        <div className="chat-b" id="chatLog" ref={chatLogRef}>
          {chatMessages.length === 0 && (
            <div className="msg bot welcome-message" style={{ animation: "fadeIn 0.3s ease" }}>
              <div className="msg-avatar"><Icon name="user" size={16} /></div>
              <div className="msg-content">
                <span dangerouslySetInnerHTML={{ __html: INTRO_MESSAGE }} />
              </div>
            </div>
          )}
          
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`msg ${msg.who === "INTERN" ? "bot" : "user"}`}
              style={{ animation: "fadeIn 0.2s ease" }}
            >
              {msg.who === "INTERN" && (
                <div className="msg-avatar"><Icon name="user" size={16} /></div>
              )}
              <div className="msg-content">
                {msg.isTyping ? (
                  <span className="typing-indicator" aria-label="Assistant is typing">
                    <span></span><span></span><span></span>
                  </span>
                ) : (
                  <>
                    <span dangerouslySetInnerHTML={{ __html: msg.text }} />
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="msg-actions">
                        {msg.actions.map((action: AdvisorAction, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            className="action-btn"
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
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-suggestions" role="list" aria-label="Suggested questions">
          <button type="button" role="listitem" onClick={() => askChat("Am I eligible for the Data Analyst Intern?")}>
            Am I eligible?
          </button>
          <button type="button" role="listitem" onClick={() => askChat("What documents do I still need?")}>
            What do I need to upload?
          </button>
          <button type="button" role="listitem" onClick={() => askChat("Which placement fits me best?")}>
            Which placement fits me?
          </button>
          <button type="button" role="listitem" onClick={() => askChat("What should I learn to get more matches?")}>
            What should I learn?
          </button>
        </div>

        <div className="chat-in">
          <div className="input-wrapper">
            {isRecording && (
              <div className="recording-bar" role="status" aria-live="polite">
                <span className="recording-dot" aria-hidden="true"></span>
                <span>Listening... tap to stop</span>
                <button type="button" className="btn-icon-sm" onClick={stopRecording} aria-label="Stop recording">
                  <Icon name="x" size={14} />
                </button>
              </div>
            )}
            <div className="input-row">
              <button
                type="button"
                className={`voice-btn ${voiceEnabled ? "active" : ""} ${voiceState === "listening" ? "recording" : ""} ${voiceState === "speaking" ? "speaking" : ""}`}
                onClick={isRecording ? cancelRecording : startRecording}
                disabled={isRecording}
                aria-label={isRecording ? "Cancel voice input" : voiceEnabled ? "Voice input (enabled)" : "Voice input"}
                aria-pressed={isRecording}
              >
                <Icon name={isRecording ? "x" : "send"} size={20} />
                {isRecording && <span className="recording-pulse" aria-hidden="true"></span>}
              </button>
              <input
                id="chatText"
                placeholder="Ask about a placement, a requirement or your file"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                aria-label="Chat message"
              />
              <button type="button" onClick={handleSend} aria-label="Send message" className="send-btn">
                <Icon name="arrow" size={18} />
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          .chat {
            display: flex;
            flex-direction: column;
            height: 100%;
            max-height: 600px;
            width: 380px;
            max-width: 100vw;
            background: var(--bg);
            border: 1px solid var(--rule);
            border-radius: 12px 12px 0 0;
            box-shadow: 0 -4px 24px rgba(0,0,0,0.15);
            overflow: hidden;
          }
          
          .chat-h {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            border-bottom: 1px solid var(--rule);
            background: var(--bg-elevated);
          }
          
          .chat-header-left {
            display: flex;
            align-items: center;
            gap: 10px;
            flex: 1;
            min-width: 0;
          }
          
          .assistant-avatar {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--brand), var(--brand-hover));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
          }
          
          .assistant-info {
            display: flex;
            flex-direction: column;
            min-width: 0;
          }
          
          .assistant-info b {
            font-size: 14px;
            color: var(--fg);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .assistant-status {
            font-size: 11px;
            color: var(--muted);
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .voice-indicator {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--muted);
            flex-shrink: 0;
          }
          .voice-indicator.listening { background: var(--brand); animation: pulse 1s infinite; }
          .voice-indicator.speaking { background: var(--success); animation: pulse 0.8s infinite; }
          .voice-indicator.ready { background: var(--success); }
          
          .chat-header-right {
            display: flex;
            align-items: center;
            gap: 6px;
          }
          
          .voice-toggle {
            position: relative;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: var(--fg);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .voice-toggle:hover { background: var(--brand-bg); }
          .voice-toggle.active { background: var(--brand); color: white; }
          .voice-toggle.pulse::after {
            content: "";
            position: absolute;
            inset: -4px;
            border-radius: 50%;
            border: 2px solid var(--brand);
            animation: pulse-ring 1.5s infinite;
          }
          .voice-tooltip {
            position: absolute;
            bottom: -28px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 10px;
            background: var(--fg);
            color: var(--bg);
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
          }
          .voice-toggle:hover .voice-tooltip { opacity: 1; }
          
          .close-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: var(--muted);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .close-btn:hover { background: var(--brand-bg); color: var(--brand); }
          
          .chat-b {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          
          .msg {
            display: flex;
            gap: 10px;
            max-width: 85%;
          }
          .msg.bot { align-self: flex-start; }
          .msg.user { align-self: flex-end; flex-direction: row-reverse; }
          
          .msg-avatar {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--brand), var(--brand-hover));
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            flex-shrink: 0;
            margin-top: 2px;
          }
          .msg.user .msg-avatar {
            background: var(--brand-bg);
            color: var(--brand);
          }
          
          .msg-content {
            background: var(--bg-elevated);
            border-radius: 16px;
            padding: 10px 14px;
            font-size: 13.5px;
            line-height: 1.5;
            color: var(--fg);
            box-shadow: 0 1px 3px rgba(0,0,0,0.08);
          }
          .msg.user .msg-content {
            background: var(--brand);
            color: white;
            border-bottom-right-radius: 4px;
          }
          .msg.bot .msg-content {
            border-bottom-left-radius: 4px;
          }
          
          .welcome-message .msg-content {
            background: var(--brand-bg);
            border: 1px solid var(--brand-border);
          }
          
          .typing-indicator {
            display: flex;
            gap: 3px;
            padding: 4px 0;
          }
          .typing-indicator span {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: var(--muted);
            animation: typing 1.4s infinite ease-in-out both;
          }
          .typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
          .typing-indicator span:nth-child(2) { animation-delay: -0.16s; }
          
          .msg-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-top: 8px;
          }
          
          .action-btn {
            font-size: 11px;
            padding: 6px 12px;
            border-radius: 20px;
            border: 1px solid var(--brand-border);
            background: var(--brand-bg);
            color: var(--brand);
            cursor: pointer;
            transition: all 0.2s ease;
          }
          .action-btn:hover {
            background: var(--brand);
            color: white;
            border-color: var(--brand);
          }
          
          .chat-suggestions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 0 16px 12px;
            border-bottom: 1px solid var(--rule);
          }
          .chat-suggestions button {
            font-size: 11.5px;
            padding: 7px 12px;
            border-radius: 20px;
            border: 1px solid var(--rule);
            background: var(--bg);
            color: var(--fg);
            cursor: pointer;
            transition: all 0.2s ease;
            white-space: nowrap;
          }
          .chat-suggestions button:hover {
            border-color: var(--brand);
            color: var(--brand);
            background: var(--brand-bg);
          }
          
          .chat-in {
            padding: 12px 16px;
            background: var(--bg-elevated);
          }
          
          .input-wrapper {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }
          
          .recording-bar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: var(--danger-bg);
            border: 1px solid var(--danger-border);
            border-radius: 10px;
            color: var(--danger);
            font-size: 12px;
            font-weight: 500;
            animation: slideDown 0.2s ease;
          }
          .recording-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--danger);
            animation: pulse 0.8s infinite;
          }
          .recording-bar .btn-icon-sm {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            margin-left: auto;
          }
          
          .input-row {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          
          .voice-btn {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            border: 1px solid var(--rule);
            background: var(--bg);
            color: var(--fg);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
            position: relative;
          }
          .voice-btn:hover:not(:disabled) { border-color: var(--brand); color: var(--brand); }
          .voice-btn.active { border-color: var(--brand); background: var(--brand-bg); color: var(--brand); }
          .voice-btn.recording { border-color: var(--danger); background: var(--danger-bg); color: var(--danger); animation: pulse-bg 1s infinite; }
          .voice-btn.speaking { border-color: var(--success); background: var(--success-bg); color: var(--success); }
          .voice-btn:disabled { opacity: 0.5; cursor: not-allowed; }
          .recording-pulse {
            position: absolute;
            inset: -4px;
            border-radius: 16px;
            border: 2px solid var(--danger);
            animation: pulse-ring 1s infinite;
          }
          
          .input-row input {
            flex: 1;
            height: 44px;
            padding: 0 16px;
            border: 1px solid var(--rule);
            border-radius: 12px;
            background: var(--bg);
            color: var(--fg);
            font-size: 14px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
          }
          .input-row input:focus {
            border-color: var(--brand);
            box-shadow: 0 0 0 3px var(--brand-bg);
          }
          
          .send-btn {
            width: 44px;
            height: 44px;
            border-radius: 12px;
            border: none;
            background: var(--brand);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            flex-shrink: 0;
          }
          .send-btn:hover { background: var(--brand-hover); transform: scale(1.02); }
          .send-btn:active { transform: scale(0.98); }
          
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          @keyframes pulse-bg {
            0%, 100% { background: var(--danger-bg); }
            50% { background: var(--danger-border); }
          }
          @keyframes pulse-ring {
            0% { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(1.5); opacity: 0; }
          }
          @keyframes typing {
            0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
            40% { transform: scale(1); opacity: 1; }
          }
          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          .btn-icon-sm {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: inherit;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }
          .btn-icon-sm:hover { background: rgba(0,0,0,0.08); }
        `}</style>
      </aside>
    </>
  );
}