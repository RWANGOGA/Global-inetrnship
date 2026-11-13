"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { Icon } from "../icons/Icons";
import { voiceService, VoiceOptions } from "../../lib/voice";
import { AdvisorAction } from "../../types";

const INTRO_MESSAGE = `Hi! I'm Brightworks Virtual Assistant — your career coach for BrighterWorks. I know your profile, all the placements, and can help with eligibility, applications, skill gaps, deadlines, and more. What can I help you with today?`;

// Simple markdown to HTML renderer
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

interface ChatGroup {
  id: string;
  name: string;
  type: string;
  description: string;
  unread_count?: number;
}

interface ChatMessage {
  id: string;
  group_id: string | null;
  sender_id: string;
  recipient_id: string | null;
  type: "text" | "voice" | "image" | "file" | "system";
  content: string;
  original_language: string;
  duration_seconds: number | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  translations: Record<string, string>;
  sender_name?: string;
  translated_content?: string;
}

interface DirectChat {
  id: string;
  user1_id: string;
  user2_id: string;
  other_user?: { id: string; name: string; role: string };
  last_message?: ChatMessage;
}

interface UserChatSettings {
  preferred_language: string;
  auto_translate: boolean;
  show_original: boolean;
}

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "sw", name: "Swahili" },
  { code: "ar", name: "Arabic" },
];

const GROUP_TYPE_ICONS: Record<string, string> = {
  student: "🎓",
  employer: "💼",
  admin: "🛡️",
  mixed: "💬",
  placement: "📋",
  organization: "🏢",
};

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
    session,
  } = useApp();

  // WhatsApp-like chat state
  const [activeTab, setActiveTab] = useState<"groups" | "direct">("groups");
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [selectedDirectChat, setSelectedDirectChat] = useState<DirectChat | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<UserChatSettings | null>({
    preferred_language: "en",
    auto_translate: true,
    show_original: true,
  });
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null);
  const [voiceState, setVoiceState] = useState<"idle" | "listening" | "speaking" | "ready">("idle");
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateDirect, setShowCreateDirect] = useState(false);
  const [newGroupData, setNewGroupData] = useState({ name: "", type: "mixed", description: "", member_ids: [] as string[] });
  const [newDirectUserId, setNewDirectUserId] = useState("");

  const chatLogRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const apiCall = async (path: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("intern:token");
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(err.detail || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const loadGroups = async () => {
    try {
      const data = await apiCall("/chat/groups");
      setGroups(data.groups || []);
    } catch (e) {
      console.error("Failed to load groups:", e);
    }
  };

  const loadDirectChats = async () => {
    try {
      const data = await apiCall("/chat/direct");
      setDirectChats(data.chats || []);
    } catch (e) {
      console.error("Failed to load direct chats:", e);
    }
  };

  const loadGroupMessages = async (groupId: string) => {
    try {
      const data = await apiCall(`/chat/groups/${groupId}/messages?limit=50`);
      setMessages(data.messages || []);
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  };

  const loadDirectMessages = async (otherUserId: string) => {
    try {
      const data = await apiCall(`/chat/direct/${otherUserId}?limit=50`);
      setMessages(data.messages || []);
    } catch (e) {
      console.error("Failed to load direct messages:", e);
    }
  };

  const handleGroupSelect = (group: ChatGroup) => {
    setSelectedGroup(group);
    setSelectedDirectChat(null);
    loadGroupMessages(group.id);
  };

  const handleDirectSelect = (chat: DirectChat) => {
    setSelectedDirectChat(chat);
    setSelectedGroup(null);
    const otherId = chat.user1_id === session?.id ? chat.user2_id : chat.user1_id;
    loadDirectMessages(otherId);
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !recordingBlob) return;
    const content = inputText.trim();
    setInputText("");
    const blob = recordingBlob;
    setRecordingBlob(null);

    try {
      if (selectedGroup) {
        await apiCall(`/chat/groups/${selectedGroup.id}/messages`, {
          method: "POST",
          body: JSON.stringify({
            content: content || "[Voice message]",
            type: blob ? "voice" : "text",
            file_name: blob ? "voice_message.webm" : undefined,
            file_size: blob ? blob.size : undefined,
            mime_type: blob ? "audio/webm" : undefined,
          }),
        });
        loadGroupMessages(selectedGroup.id);
      } else if (selectedDirectChat) {
        const otherId = selectedDirectChat.user1_id === session?.id ? selectedDirectChat.user2_id : selectedDirectChat.user1_id;
        await apiCall("/chat/direct", {
          method: "POST",
          body: JSON.stringify({
            recipient_id: otherId,
            content: content || "[Voice message]",
            type: blob ? "voice" : "text",
            file_name: blob ? "voice_message.webm" : undefined,
            file_size: blob ? blob.size : undefined,
            mime_type: blob ? "audio/webm" : undefined,
          }),
        });
        loadDirectMessages(otherId);
      }
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  };

  const startRecording = async () => {
    try {
      await voiceService.startRecording();
      setIsRecording(true);
      setVoiceState("listening");
    } catch (e) {
      alert("Could not access microphone");
    }
  };

  const stopRecording = async () => {
    try {
      const blob = await voiceService.stopRecording();
      setRecordingBlob(blob);
      setIsRecording(false);
      setVoiceState("ready");
    } catch (e) {
      setIsRecording(false);
      setVoiceState("idle");
    }
  };

  const cancelRecording = () => {
    voiceService.cancelRecording();
    setIsRecording(false);
    setVoiceState("idle");
    setRecordingBlob(null);
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const createGroup = async () => {
    if (!newGroupData.name.trim()) return;
    try {
      await apiCall("/chat/groups", {
        method: "POST",
        body: JSON.stringify(newGroupData),
      });
      setShowCreateGroup(false);
      setNewGroupData({ name: "", type: "mixed", description: "", member_ids: [] });
      loadGroups();
    } catch (e) {
      console.error("Failed to create group:", e);
    }
  };

  const getDisplayContent = (msg: ChatMessage) => {
    const preferredLang = settings?.preferred_language || "en";
    if (msg.translations && msg.translations[preferredLang] && settings?.auto_translate) {
      return settings.show_original
        ? `${msg.translations[preferredLang]}\n\n— Original: ${msg.content}`
        : msg.translations[preferredLang];
    }
    return msg.content;
  };

  return (
    <>
      {/* Chat FAB - always visible */}
      <button type="button" className="chat-fab" onClick={openChat}>
        <span className="dot"></span> Messages
      </button>

      {/* Drawer veil */}
      <div
        className={`drawer-veil ${isChatOpen ? "on" : ""}`}
        id="chatVeil"
        onClick={closeChat}
      ></div>

      {/* Chat Drawer */}
      <aside className={`chat ${isChatOpen ? "on" : ""}`} id="chat">
        <div className="chat-h">
          <div>
            <b>Brightworks Virtual Assistant</b>
            <div className="st"><i></i> WhatsApp-style chat • Groups • Direct messages</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button type="button" onClick={closeChat} aria-label="Close">
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>

        <div className="chat-b" id="chatLog" ref={chatLogRef}>
          {chatMessages.length === 0 && (
            <div className="msg bot welcome-message">
              <div className="msg-avatar"><Icon name="user" size={16} /></div>
              <div className="msg-content">
                <span dangerouslySetInnerHTML={{ __html: renderMarkdown(INTRO_MESSAGE) }} />
              </div>
            </div>
          )}
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`msg ${msg.who === "INTERN" ? "bot" : "me"}`}>
              {msg.who === "INTERN" && <div className="msg-avatar"><Icon name="user" size={16} /></div>}
              <div className="msg-content">
                {msg.isTyping ? (
                  <span style={{ fontFamily: "var(--mono)", fontSize: "10px", letterSpacing: ".25em" }}>···</span>
                ) : (
                  <>
                    <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="msg-actions" style={{ marginTop: "8px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {msg.actions.map((action: AdvisorAction, idx: number) => (
                          <button key={idx} type="button" className="btn btn-sm" onClick={() => { closeChat(); handleAdvisorAction(action); }}>
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

        <div className="chat-q">
          <button type="button" onClick={() => askChat("Am I eligible for the Data Analyst Intern?")}>Am I eligible?</button>
          <button type="button" onClick={() => askChat("What documents do I still need?")}>What documents?</button>
          <button type="button" onClick={() => askChat("Which placement fits me best?")}>Best placement?</button>
          <button type="button" onClick={() => askChat("What should I learn?")}>What to learn?</button>
        </div>

        <div className="chat-in">
          <div className="input-wrapper">
            {isRecording && (
              <div className="voice-recording">
                <div className="recording-indicator" style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--danger)", animation: "pulse 1s infinite" }} />
                <span style={{ fontSize: "13px", color: "var(--danger)", fontWeight: 500 }}>Recording... tap to stop</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={stopRecording}>Stop</button>
                <button type="button" className="btn btn-sm btn-secondary" onClick={cancelRecording}>Cancel</button>
              </div>
            )}
            <div className="input-row">
              <button
                type="button"
                className={`voice-btn ${role === "admin" ? "admin-badge" : ""}`}
                onClick={isRecording ? cancelRecording : startRecording}
                disabled={isRecording}
              >
                <Icon name="send" size={18} />
              </button>
              <input
                id="chatText"
                placeholder="Ask about a placement, a requirement or your file"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
              />
              <button type="button" onClick={sendMessage} aria-label="Send">
                <Icon name="arrow" size={15} />
              </button>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
          .chat-fab {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 1000;
            background: var(--brand);
            color: white;
            border: none;
            border-radius: 50px;
            padding: 12px 20px;
            font-weight: 600;
            font-size: 14px;
            cursor: pointer;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .chat-fab .dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #10b981;
            animation: pulse 1.5s infinite;
          }
          .drawer-veil {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.4);
            z-index: 990;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
          }
          .drawer-veil.on {
            opacity: 1;
            pointer-events: auto;
          }
          .chat {
            position: fixed;
            inset: 0 auto 0 100%;
            z-index: 1000;
            width: 380px;
            max-width: 90vw;
            background: var(--bg);
            border-left: 1px solid var(--rule);
            box-shadow: -4px 0 24px rgba(0,0,0,0.15);
            transform: translateX(100%);
            transition: transform 0.3s ease;
            display: flex;
            flex-direction: column;
            height: 100vh;
          }
          .chat.on {
            transform: translateX(0);
          }
          .chat-h {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 14px 16px;
            border-bottom: 1px solid var(--rule);
            background: var(--bg-elevated);
          }
          .chat-b {
            flex: 1;
            overflow-y: auto;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .chat-q {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 0 16px 12px;
            border-bottom: 1px solid var(--rule);
          }
          .chat-q button {
            font-size: 11.5px;
            padding: 7px 12px;
            border-radius: 20px;
            border: 1px solid var(--rule);
            background: var(--bg);
            color: var(--fg);
            cursor: pointer;
          }
          .chat-q button:hover {
            border-color: var(--brand);
            color: var(--brand);
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
          .voice-recording {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 14px;
            background: var(--danger-bg);
            border: 1px solid var(--danger-border);
            border-radius: 10px;
            color: var(--danger);
            font-size: 12px;
            font-weight: 500;
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
            transition: all 0.2s;
            flex-shrink: 0;
          }
          .voice-btn:hover:not(:disabled) { border-color: var(--brand); color: var(--brand); }
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
          }
          .msg {
            display: flex;
            gap: 10px;
            max-width: 85%;
            animation: fadeIn 0.2s ease;
          }
          .msg.bot { align-self: flex-start; }
          .msg.me { align-self: flex-end; flex-direction: row-reverse; }
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
          }
          .msg.me .msg-avatar { background: var(--brand-bg); color: var(--brand); }
          .msg-content {
            background: var(--bg-elevated);
            border-radius: 16px;
            padding: 10px 14px;
            font-size: 13.5px;
            line-height: 1.5;
            color: var(--fg);
          }
          .msg.me .msg-content { background: var(--brand); color: white; border-bottom-right-radius: 4px; }
          .msg.bot .msg-content { border-bottom-left-radius: 4px; }
          .welcome-message .msg-content { background: var(--brand-bg); border: 1px solid var(--brand-border); }
          .msg-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
          .action-btn {
            font-size: 11px;
            padding: 6px 12px;
            border-radius: 20px;
            border: 1px solid var(--brand-border);
            background: var(--brand-bg);
            color: var(--brand);
            cursor: pointer;
          }
          .btn { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--rule); background: var(--bg); color: var(--fg); cursor: pointer; font-size: 13px; }
          .btn.btn-sm { padding: 6px 12px; font-size: 11px; }
          .btn.btn-danger { background: var(--danger); color: white; border-color: var(--danger); }
          .btn.btn-secondary { background: transparent; color: var(--muted); }
          .admin-badge { position: relative; }
          .admin-badge::after { content: "ADMIN"; position: absolute; top: -8px; right: -8px; font-size: 8px; background: var(--danger); color: white; padding: 2px 4px; border-radius: 6px; }
          .btn-icon-sm { width: 28px; height: 28px; border-radius: 50%; border: none; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer; }
        `}</style>
      </aside>
    </>
  );
}

function handleAdvisorAction(action: AdvisorAction) {
  switch (action.type) {
    case "apply":
      break;
    case "check_eligibility":
      break;
    case "open_placement":
      break;
    case "human_handoff":
      break;
    default:
      break;
  }
}