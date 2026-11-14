"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useApp } from "../../context/AppContext";
import { Icon, IconName } from "../icons/Icons";
import { voiceService } from "../../lib/voice";

const INTRO_MESSAGE = `Hi! I'm Brightworks Virtual Assistant — your career coach for BrighterWorks. I know your profile, all placements, and can help with eligibility, applications, skill gaps, deadlines, and more. What can I help you with today?`;

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
  is_edited?: boolean;
}

interface DirectChat {
  id: string;
  user1_id: string;
  user2_id: string;
  other_user?: { id: string; name: string; role: string };
  last_message?: ChatMessage;
  unread_count?: number;
}

interface UserChatSettings {
  preferred_language: string;
  auto_translate: boolean;
  show_original: boolean;
}

const GROUP_TYPE_ICONS: Record<string, string> = {
  student: "graduation-cap",
  employer: "briefcase",
  admin: "shield",
  mixed: "users",
  placement: "clipboard",
  organization: "building",
};

export function ChatDrawer() {
  const {
    session,
    role,
    chatMessages,
  } = useApp();

  const [activeTab, setActiveTab] = useState<"groups" | "direct">("groups");
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [directChats, setDirectChats] = useState<DirectChat[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ChatGroup | null>(null);
  const [selectedDirectChat, setSelectedDirectChat] = useState<DirectChat | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [settings, setSettings] = useState<UserChatSettings | null>({
    preferred_language: "en",
    auto_translate: true,
    show_original: true,
  });
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);

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

  const openGroupChat = (group: ChatGroup) => {
    setSelectedGroup(group);
    setSelectedDirectChat(null);
    loadGroupMessages(group.id);
    setIsChatOpen(true);
  };

  const openDirectChat = (chat: DirectChat) => {
    setSelectedDirectChat(chat);
    setSelectedGroup(null);
    const otherUserId = chat.user1_id === session?.id ? chat.user2_id : chat.user1_id;
    loadDirectMessages(otherUserId);
    setIsChatOpen(true);
  };

  const closeChatView = () => {
    setIsChatOpen(false);
    setSelectedGroup(null);
    setSelectedDirectChat(null);
    setMessages([]);
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
        const otherUserId = selectedDirectChat.user1_id === session?.id ? selectedDirectChat.user2_id : selectedDirectChat.user1_id;
        await apiCall("/chat/direct", {
          method: "POST",
          body: JSON.stringify({
            recipient_id: otherUserId,
            content: content || "[Voice message]",
            type: blob ? "voice" : "text",
            file_name: blob ? "voice_message.webm" : undefined,
            file_size: blob ? blob.size : undefined,
            mime_type: blob ? "audio/webm" : undefined,
          }),
        });
        loadDirectMessages(otherUserId);
      }
    } catch (e) {
      console.error("Failed to send message:", e);
    }
  };

  const startRecording = async () => {
    try {
      await voiceService.startRecording();
      setIsRecording(true);
    } catch (e) {
      alert("Could not access microphone");
    }
  };

  const stopRecording = async () => {
    try {
      const blob = await voiceService.stopRecording();
      setRecordingBlob(blob);
      setIsRecording(false);
    } catch (e) {
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    voiceService.cancelRecording();
    setIsRecording(false);
    setRecordingBlob(null);
  };

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 86400000)}h ago`;
    return date.toLocaleDateString();
  };

  const renderGroupIcon = (type: string) => {
    const iconName = (GROUP_TYPE_ICONS[type] || "users") as IconName;
    return <Icon name={iconName} size={20} />;
  };

  const renderDirectAvatar = (chat: DirectChat) => {
    const name = chat.other_user?.name || "User";
    return name.charAt(0).toUpperCase();
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
      <div className="chat-sidebar" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="chat-header" style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "12px 14px",
          borderBottom: "1px solid var(--rule)",
          background: "var(--bg-elevated)",
          flexShrink: 0,
        }}>
          <div className="chat-avatar" style={{
            width: "36px", height: "36px", borderRadius: "8px",
            background: "linear-gradient(135deg, var(--brand), var(--brand-hover))",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontSize: "18px",
          }}>
            <Icon name="user-check" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: "14px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              Messages
            </div>
            <div style={{ fontSize: "12px", color: "var(--muted)" }}>
              {role === "admin" ? "Administration" : "Groups & conversations"}
            </div>
          </div>
        </div>

        <div className="chat-list" style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "0 8px 8px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {activeTab === "groups" ? "Groups" : "Direct Messages"}
            </span>
          </div>

          {activeTab === "groups" ? (
            <>
              {groups.map(group => (
                <button
                  key={group.id}
                  onClick={() => openGroupChat(group)}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    border: "none",
                    background: selectedGroup?.id === group.id ? "var(--brand-bg)" : "transparent",
                    color: "var(--fg)",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: "10px",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "10px",
                    background: "linear-gradient(135deg, var(--brand), var(--brand-hover))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", flexShrink: 0,
                  }}>
                    {renderGroupIcon(group.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {group.name}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {group.description || `${group.type} group`}
                    </div>
                  </div>
                  {(group.unread_count || 0) > 0 && (
                    <span style={{
                      background: "var(--brand)", color: "white",
                      fontSize: "11px", fontWeight: 600,
                      padding: "2px 8px", borderRadius: "12px",
                      minWidth: "22px", textAlign: "center",
                    }}>
                      {group.unread_count}
                    </span>
                  )}
                </button>
              ))}
              {groups.length === 0 && (
                <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                  <span style={{ marginBottom: "8px", opacity: 0.4, display: "inline-block" }}><Icon name="user-check" size={24} /></span>
                  <div>No groups yet</div>
                </div>
              )}
            </>
          ) : (
            <>
              {directChats.map(chat => (
                <button
                  key={chat.id}
                  onClick={() => openDirectChat(chat)}
                  style={{
                    width: "100%",
                    padding: "12px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    border: "none",
                    background: "transparent",
                    color: "var(--fg)",
                    textAlign: "left",
                    cursor: "pointer",
                    borderRadius: "10px",
                    marginBottom: "6px",
                  }}
                >
                  <div style={{
                    width: "42px", height: "42px", borderRadius: "50%",
                    background: "linear-gradient(135deg, var(--brand), var(--brand-hover))",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: "16px", fontWeight: 600, flexShrink: 0,
                  }}>
                    {renderDirectAvatar(chat)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {chat.other_user?.name || "Unknown"}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {chat.last_message?.content ? (chat.last_message.sender_id === session?.id ? "You: " : "") + chat.last_message.content.substring(0, 50) : "No messages yet"}
                    </div>
                  </div>
                  {(chat.unread_count || 0) > 0 && (
                    <span style={{
                      background: "var(--brand)", color: "white",
                      fontSize: "11px", fontWeight: 600,
                      padding: "2px 8px", borderRadius: "12px",
                      minWidth: "22px", textAlign: "center",
                    }}>
                      {chat.unread_count}
                    </span>
                  )}
                </button>
              ))}
              {directChats.length === 0 && (
                <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--muted)", fontSize: "13px" }}>
                  <span style={{ marginBottom: "8px", opacity: 0.4, display: "inline-block" }}><Icon name="user" size={24} /></span>
                  <div>No direct conversations</div>
                </div>
              )}
            </>
          )}
          <div style={{ padding: "8px 8px 4px" }}>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "groups" ? "direct" : "groups")}
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: "8px",
                border: "1px solid var(--rule)",
                background: "transparent",
                color: "var(--muted)",
                fontSize: "13px",
                fontWeight: 500,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ marginRight: "8px", display: "inline-block" }}><Icon name={activeTab === "groups" ? "brief" : "user-check"} size={14} /></span>
              {activeTab === "groups" ? "Switch to Direct Messages" : "Switch to Groups"}
            </button>
          </div>
        </div>

        {selectedGroup || selectedDirectChat ? (
          <>
          <div className="chat-messages" style={{
            flex: 1, overflowY: "auto", padding: "12px",
            display: "flex", flexDirection: "column", gap: "8px",
          }}>
            {messages.length === 0 && (
              <div style={{ textAlign: "center", color: "var(--muted)", fontSize: "12px", paddingTop: "40px" }}>
                <div style={{ fontSize: "56px", marginBottom: "16px", opacity: 0.3 }}>💬</div>
                <div style={{ fontSize: "16px", fontWeight: 500, marginBottom: "6px" }}>No messages yet</div>
                <div style={{ fontSize: "14px" }}>Send the first message</div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`msg ${msg.sender_id === session?.id ? "me" : "bot"}`}>
                {msg.sender_id === session?.id ? (
                  <div style={{ display: "flex", flexDirection: "row-reverse", alignItems: "flex-end", gap: "10px", maxWidth: "80%" }}>
                    <div className="msg-content" style={{
                      background: "var(--brand)", color: "white",
                      borderRadius: "20px 20px 4px 20px",
                      padding: "12px 16px",
                    }}>
                      <span dangerouslySetInnerHTML={{ __html: renderMarkdown(getDisplayContent(msg)) }} />
                      {msg.is_edited && (
                        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", marginTop: "6px" }}>Edited</div>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", marginTop: "2px" }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", maxWidth: "80%" }}>
                    <div style={{
                      width: "38px", height: "38px", borderRadius: "50%",
                      background: "linear-gradient(135deg, var(--brand), var(--brand-hover))",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "white", fontSize: "16px", fontWeight: 600, flexShrink: 0,
                    }}>
                      {msg.sender_name?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="msg-content" style={{
                      background: "var(--bg-elevated)", color: "var(--fg)",
                      borderRadius: "20px 20px 20px 4px",
                      padding: "12px 16px",
                    }}>
                      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--muted)", marginBottom: "4px" }}>
                        {msg.sender_name || "Assistant"}
                      </div>
                      <span dangerouslySetInnerHTML={{ __html: renderMarkdown(getDisplayContent(msg)) }} />
                      {msg.is_edited && (
                        <div style={{ fontSize: "10px", color: "var(--muted)", marginTop: "6px", opacity: 0.7 }}>Edited</div>
                      )}
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--muted)", marginTop: "2px" }}>{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-area" style={{
            padding: "16px 22px",
            borderTop: "1px solid var(--rule)",
            background: "var(--bg-elevated)",
            flexShrink: 0,
          }}>
            {isRecording && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", background: "var(--danger-bg)", border: "1px solid var(--danger-border)", borderRadius: "10px", color: "var(--danger)", fontSize: "13px", fontWeight: 500, marginBottom: "12px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--danger)", animation: "pulse 0.8s infinite" }} />
                <span>Recording voice message...</span>
                <button type="button" onClick={stopRecording} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--danger)", background: "transparent", color: "var(--danger)", cursor: "pointer", fontSize: "12px" }}>Stop</button>
                <button type="button" onClick={cancelRecording} style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--rule)", background: "transparent", color: "var(--muted)", cursor: "pointer", fontSize: "12px" }}>Cancel</button>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className={`voice-btn ${isRecording ? "recording" : ""}`}
                onClick={isRecording ? cancelRecording : startRecording}
                disabled={isRecording}
                style={{ width: "48px", height: "48px", borderRadius: "14px", border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--fg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
              >
                <Icon name={isRecording ? "x" : "send"} size={20} />
              </button>
              <input ref={fileInputRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt" onChange={() => {}} style={{ display: "none" }} />
              <textarea value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (inputText.trim()) sendMessage(); } }} placeholder="Type a message..." disabled={isRecording} rows={1} style={{ flex: 1, minHeight: "48px", maxHeight: "180px", padding: "14px 18px", border: "1px solid var(--rule)", borderRadius: "var(--r-md)", background: "var(--bg)", color: "var(--fg)", fontSize: "14px", outline: "none", resize: "none" }} />
              <button type="button" onClick={sendMessage} disabled={!inputText.trim() && !recordingBlob} style={{ width: "48px", height: "48px", borderRadius: "14px", border: "none", background: "var(--brand)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                <Icon name="arrow" size={20} />
              </button>
            </div>
          </div>
          </>
        ) : null}
      </div>
    </>
  );
}
