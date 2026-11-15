// Chat / messaging client.
//
// The dashboard "Messages" screen is a real workspace (inbox + conversation),
// not a sidebar widget, so it needs contracts the old widget never had: titles,
// previews, unread counts and sender names. Those come from GET /chat/threads
// and from the sender_name the messages endpoints now attach. Everything here
// translates snake_case from the API at the edge, like lib/api.ts does.
import { API_BASE, ApiError, getToken } from "./api";

export type ChatMessageType = "text" | "voice" | "image" | "file" | "system";

export interface ChatPerson {
  id: string;
  name: string;
  role: string;
  initials: string;
}

export interface ChatPreview {
  id: string;
  content: string;
  type: ChatMessageType;
  sender_id: string;
  sender_name: string;
  created_at: string;
  is_mine: boolean;
}

export interface ChatThread {
  id: string;
  kind: "group" | "direct";
  title: string;
  type: string;
  description: string;
  initials: string;
  subtitle: string;
  member_count: number;
  my_role: string;
  unread_count: number;
  other_user?: { id: string; name: string; role: string };
  last_message: ChatPreview | null;
  last_activity: string;
}

export interface ChatMessage {
  id: string;
  group_id: string | null;
  sender_id: string;
  recipient_id: string | null;
  type: ChatMessageType;
  content: string;
  original_language: string;
  duration_seconds: number | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  is_edited: boolean;
  reply_to_id: string | null;
  translations: Record<string, string>;
  translated_content: string | null;
  sender_name: string;
}

export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  is_muted: boolean;
  name: string;
  initials: string;
}

export const GROUP_TYPES = [
  { value: "placement", label: "Placement cohort" },
  { value: "student", label: "Students" },
  { value: "employer", label: "Employers" },
  { value: "organization", label: "Organisation" },
  { value: "mixed", label: "Mixed" },
  { value: "admin", label: "Placement office" },
] as const;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(res.status, payload?.detail ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

export function chatAvailable(): boolean {
  return API_BASE.length > 0 && Boolean(getToken());
}

export async function listThreads(): Promise<ChatThread[]> {
  const data = await request<{ threads: ChatThread[] }>("/chat/threads");
  return data.threads || [];
}

export async function listMessages(thread: ChatThread, limit = 60): Promise<ChatMessage[]> {
  if (thread.kind === "direct") {
    const otherId = thread.other_user?.id;
    if (!otherId) return [];
    const data = await request<{ messages: ChatMessage[] }>(
      `/chat/direct/${otherId}?limit=${limit}`
    );
    return data.messages || [];
  }
  const data = await request<{ messages: ChatMessage[] }>(
    `/chat/groups/${thread.id}/messages?limit=${limit}`
  );
  return data.messages || [];
}

export async function sendToThread(thread: ChatThread, content: string): Promise<void> {
  if (thread.kind === "direct") {
    const otherId = thread.other_user?.id;
    if (!otherId) throw new Error("This conversation has no recipient");
    await request("/chat/direct", {
      method: "POST",
      body: JSON.stringify({ recipient_id: otherId, content, type: "text" }),
    });
    return;
  }
  await request(`/chat/groups/${thread.id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, type: "text" }),
  });
}

export async function markThreadRead(threadId: string): Promise<void> {
  await request(`/chat/threads/${threadId}/read`, { method: "POST" });
}

export async function listContacts(): Promise<ChatPerson[]> {
  const data = await request<{ contacts: ChatPerson[] }>("/chat/contacts");
  return data.contacts || [];
}

export async function listMembers(groupId: string): Promise<GroupMember[]> {
  const data = await request<{ participants: GroupMember[] }>(
    `/chat/groups/${groupId}/members`
  );
  return data.participants || [];
}

export async function createGroup(input: {
  name: string;
  type: string;
  description: string;
  member_ids: string[];
}): Promise<ChatThread> {
  const data = await request<{ group: ChatThread }>("/chat/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.group;
}

export async function addMember(groupId: string, userId: string): Promise<void> {
  await request(`/chat/groups/${groupId}/members`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId, role: "member" }),
  });
}

export async function leaveGroup(groupId: string): Promise<void> {
  await request(`/chat/groups/${groupId}/leave`, { method: "POST" });
}

// ---- Presentation helpers --------------------------------------------------

export function timeOf(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/** Inbox timestamps: today shows the clock, yesterday the weekday, older a date. */
export function threadStamp(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t = d.getTime();
  if (t >= startOfToday) return timeOf(iso);
  if (t >= startOfToday - 86400000) return "Yesterday";
  return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((start(now) - start(d)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
}

/** A stable colour per sender so group members stay recognisable. */
export function senderTint(id: string): string {
  const palette = ["#BC2132", "#0F766E", "#7C3AED", "#B45309", "#1D4ED8", "#BE185D", "#065F46"];
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) % 997;
  return palette[hash % palette.length];
}

export function messageBody(message: ChatMessage): string {
  if (message.type === "voice") return "Voice message";
  if (message.type === "image") return message.file_name || "Photo";
  if (message.type === "file") return message.file_name || "Attachment";
  return message.content;
}

export function previewText(thread: ChatThread): string {
  const last = thread.last_message;
  if (!last) return thread.kind === "group" ? "No messages yet" : "Say hello";
  const prefix = last.is_mine ? "You: " : thread.kind === "group" ? `${last.sender_name}: ` : "";
  return prefix + (last.content || "").replace(/\s+/g, " ").slice(0, 90);
}
