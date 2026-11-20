"use client";

// Full-screen messaging workspace.
//
// This replaces the chat widget that lived at the bottom of the dashboard
// sidebar: a list you could not scan and a modal that hid the page behind it.
// The layout follows the messaging app everyone already knows - threads on the
// left, the conversation on the right, group info sliding in from the side - so
// the behaviour is learned in seconds instead of explained.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../../context/AppContext";
import { Icon } from "../../icons/Icons";
import {
  ChatMessage,
  type ChatSettings,
  ChatPerson,
  ChatThread,
  GROUP_TYPES,
  GroupMember,
  addMember,
  chatAvailable,
  createGroup,
  getChatSettings,
  updateChatSettings,
  dayLabel,
  deleteGroup,
  leaveGroup,
  listContacts,
  listMembers,
  listMessages,
  listThreads,
  markThreadRead,
  messageBody,
  previewText,
  removeMember,
  sendToThread,
  senderTint,
  threadStamp,
  timeOf,
} from "../../../lib/chat";

type Filter = "all" | "groups" | "direct" | "unread";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "groups", label: "Groups" },
  { id: "direct", label: "Direct" },
  { id: "unread", label: "Unread" },
];

function GroupIcon({ type }: { type: string }) {
  if (type === "placement") return <Icon name="file-text" size={17} />;
  if (type === "student") return <Icon name="uni" size={17} />;
  if (type === "employer") return <Icon name="brief" size={17} />;
  if (type === "organization") return <Icon name="bldg" size={17} />;
  if (type === "admin") return <Icon name="shield-check" size={17} />;
  return <Icon name="user-check" size={17} />;
}

function Avatar({ thread, size = 44 }: { thread: ChatThread; size?: number }) {
  return (
    <span
      className={`wa-av ${thread.kind === "direct" ? "is-round" : ""}`}
      style={{ width: size, height: size, fontSize: Math.round(size / 2.9) }}
      aria-hidden="true"
    >
      {thread.kind === "group" ? <GroupIcon type={thread.type} /> : thread.initials}
    </span>
  );
}

export function MessagesView() {
  const { session, role, toast } = useApp();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [chatSettings, setChatSettings] = useState<ChatSettings | null>(null);
  const [draftThread, setDraftThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [contacts, setContacts] = useState<ChatPerson[]>([]);
  const [pickerMode, setPickerMode] = useState<null | "group" | "direct" | "member">(null);
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const activeRef = useRef<ChatThread | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const readRef = useRef<Set<string>>(new Set());
  const canChat = typeof window !== "undefined" ? chatAvailable() : false;

  const active: ChatThread | null = useMemo(() => {
    if (draftThread) return draftThread;
    return threads.find((t) => t.id === activeId) || null;
  }, [draftThread, threads, activeId]);

  // The pollers below read these refs so they never need `active`/`threads` in
  // their dependency list - otherwise every 20s refresh would restart the 5s
  // poller and re-send the read receipt.
  activeRef.current = active;
  activeIdRef.current = active?.id ?? null;

  const totalUnread = threads.reduce((sum, t) => sum + (t.unread_count || 0), 0);

  useEffect(() => {
    if (!canChat) return;
    let cancelled = false;
    getChatSettings()
      .then((s) => { if (!cancelled) setChatSettings(s); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [canChat]);

  // ---- data loading --------------------------------------------------------

  const refreshThreads = useCallback(async () => {
    try {
      const list = await listThreads();
      const current = activeIdRef.current;
      const open = current ? list.find((t) => t.id === current) : undefined;
      if (open && open.kind === "group" && open.unread_count > 0) {
        // The thread is on screen, so its badge is already stale.
        setThreads(list.map((t) => (t.id === current ? { ...t, unread_count: 0 } : t)));
        void markThreadRead(open.id).catch(() => undefined);
      } else {
        setThreads(list);
      }
      setError(null);
      return list;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load conversations");
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canChat) {
      setLoading(false);
      setError(
        "Messaging needs the API. Set NEXT_PUBLIC_API_BASE_URL to the backend and reload."
      );
      return;
    }
    refreshThreads().then((list) => {
      if (!list.length) return;
      // Desktop: open the newest conversation so the pane is never a dead end.
      if (window.matchMedia("(min-width: 961px)").matches) {
        setActiveId((current) => current || list[0].id);
      }
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshThreads();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [canChat, refreshThreads]);

  const loadMessages = useCallback(
    async (thread: ChatThread, quiet = false) => {
      if (!quiet) setMessagesLoading(true);
      try {
        const list = await listMessages(thread);
        setMessages(list);
      } catch (e) {
        if (!quiet) toast(e instanceof Error ? e.message : "Could not load messages");
      } finally {
        if (!quiet) setMessagesLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    const thread = activeRef.current;
    if (!thread) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    void loadMessages(thread);
    if (thread.kind === "group" && !thread.id.startsWith("draft:") && !readRef.current.has(thread.id)) {
      readRef.current.add(thread.id);
      void markThreadRead(thread.id)
        .then(() => {
          setThreads((list) =>
            list.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t))
          );
        })
        .catch(() => readRef.current.delete(thread.id));
    }
    const timer = window.setInterval(() => {
      const current = activeRef.current;
      if (document.visibilityState === "visible" && !cancelled && current) {
        void loadMessages(current, true);
      }
    }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeId, draftThread, loadMessages]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, messagesLoading]);

  useEffect(() => {
    if (!infoOpen || !active || active.kind !== "group") return;
    listMembers(active.id)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [infoOpen, active]);

  // ---- actions -------------------------------------------------------------

  const openThread = (thread: ChatThread) => {
    setDraftThread(null);
    setActiveId(thread.id);
    setInfoOpen(false);
    setMobilePane("chat");
    // Mark read locally straight away; the request below confirms it.
    setThreads((list) =>
      list.map((t) => (t.id === thread.id ? { ...t, unread_count: 0 } : t))
    );
  };

  const startDirect = (person: ChatPerson) => {
    const draft: ChatThread = {
      id: `draft:${person.id}`,
      kind: "direct",
      title: person.name,
      type: person.role,
      description: "",
      initials: person.initials,
      subtitle: person.role ? person.role.charAt(0).toUpperCase() + person.role.slice(1) : "Direct message",
      member_count: 2,
      my_role: "member",
      unread_count: 0,
      other_user: { id: person.id, name: person.name, role: person.role },
      last_message: null,
      last_activity: "",
    };
    setPickerMode(null);
    setDraftThread(draft);
    setActiveId(draft.id);
    setMessages([]);
    setMobilePane("chat");
    window.setTimeout(() => composerRef.current?.focus(), 60);
  };

  const openPicker = async (mode: "group" | "direct" | "member") => {
    setPickerMode(mode);
    if (!contacts.length) {
      try {
        setContacts(await listContacts());
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not load people");
      }
    }
  };

  const onCreatedGroup = async (thread: ChatThread) => {
    setPickerMode(null);
    await refreshThreads();
    setDraftThread(null);
    setActiveId(thread.id);
    setMobilePane("chat");
    toast("Group created");
  };

  const send = async () => {
    const body = text.trim();
    if (!body || !active || sending) return;
    const target = active;
    setText("");
    setSending(true);
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      group_id: target.kind === "group" ? target.id : null,
      sender_id: session?.id || "me",
      recipient_id: target.other_user?.id || null,
      type: "text",
      content: body,
      original_language: "en",
      duration_seconds: null,
      file_name: null,
      file_size: null,
      mime_type: null,
      created_at: new Date().toISOString(),
      updated_at: null,
      deleted_at: null,
      is_edited: false,
      reply_to_id: null,
      translations: {},
      translated_content: null,
      sender_name: session?.name || "You",
    };
    setMessages((list) => [...list, optimistic]);
    try {
      await sendToThread(target, body);
      const fresh = await refreshThreads();
      if (target.id.startsWith("draft:")) {
        const otherId = target.other_user?.id;
        const real = fresh.find((t) => t.kind === "direct" && t.other_user?.id === otherId);
        if (real) {
          setDraftThread(null);
          setActiveId(real.id);
          setMessages(await listMessages(real));
          return;
        }
      }
      setMessages(await listMessages(target));
    } catch (e) {
      setMessages((list) => list.filter((m) => m.id !== optimistic.id));
      setText(body);
      toast(e instanceof Error ? e.message : "Message did not send");
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  };

  const onLeaveGroup = async () => {
    if (!active || active.kind !== "group") return;
    if (!window.confirm(`Leave "${active.title}"? You will stop receiving its messages.`)) return;
    try {
      await leaveGroup(active.id);
      setInfoOpen(false);
      setActiveId(null);
      setDraftThread(null);
      setMobilePane("list");
      await refreshThreads();
      toast("You left the group");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not leave the group");
    }
  };

  // ---- derived lists -------------------------------------------------------

  const visibleThreads = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === "groups" && t.kind !== "group") return false;
      if (filter === "direct" && t.kind !== "direct") return false;
      if (filter === "unread" && !t.unread_count) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        (t.last_message?.content || "").toLowerCase().includes(needle)
      );
    });
  }, [threads, filter, query]);

  return (
    <div className={`wa ${mobilePane === "chat" ? "wa-show-chat" : ""}`}>
      {/* ---------------- thread list ---------------- */}
      <aside className="wa-list" id="wa-thread-list">
        <header className="wa-list-top">
          <div>
            <h2>
              Messages
              {totalUnread > 0 && <span className="wa-count">{totalUnread}</span>}
            </h2>
            <p>
              {role === "admin" ? "Placement office channels" : "Groups and direct conversations"}
            </p>
          </div>
          <div className="wa-list-actions">
            <button
              type="button"
              className="wa-icon-btn"
              title="New conversation"
              aria-label="New conversation"
              onClick={() => void openPicker("direct")}
            >
              <Icon name="user" size={15} />
            </button>
            {role === "admin" && (
              <button
                type="button"
                className="wa-icon-btn"
                title="New group (admin only)"
                aria-label="New group"
                onClick={() => void openPicker("group")}
              >
                <Icon name="plus" size={15} />
              </button>
            )}
          </div>
        </header>

        <div className="wa-search">
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Clear search">
              <Icon name="x" size={12} />
            </button>
          )}
        </div>

        <div className="wa-filters" role="tablist" aria-label="Filter conversations">
          {FILTERS.map((f) => {
            const count =
              f.id === "groups"
                ? threads.filter((t) => t.kind === "group").length
                : f.id === "direct"
                ? threads.filter((t) => t.kind === "direct").length
                : f.id === "unread"
                ? threads.filter((t) => t.unread_count > 0).length
                : threads.length;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                className={`wa-filter ${filter === f.id ? "on" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="wa-threads">
          {loading && (
            <div className="wa-placeholder">
              <Icon name="spinner" size={18} />
              <span>Loading conversations</span>
            </div>
          )}

          {!loading && error && (
            <div className="wa-placeholder wa-error">
              <Icon name="alert-triangle" size={18} />
              <span>{error}</span>
              <button type="button" className="wa-btn ghost" onClick={() => void refreshThreads()}>
                Try again
              </button>
            </div>
          )}

          {!loading &&
            !error &&
            visibleThreads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`wa-thread ${active?.id === thread.id ? "on" : ""} ${
                  thread.unread_count ? "unread" : ""
                }`}
                onClick={() => openThread(thread)}
              >
                <Avatar thread={thread} />
                <span className="wa-thread-main">
                  <span className="wa-thread-line">
                    <b>{thread.title}</b>
                    <em>{threadStamp(thread.last_activity)}</em>
                  </span>
                  <span className="wa-thread-line">
                    <span className="wa-thread-preview">{previewText(thread)}</span>
                    {thread.unread_count > 0 && (
                      <span className="wa-badge">{thread.unread_count > 99 ? "99+" : thread.unread_count}</span>
                    )}
                  </span>
                </span>
              </button>
            ))}

          {!loading && !error && visibleThreads.length === 0 && (
            <div className="wa-placeholder">
              <Icon name="inbox" size={20} />
              <span>
                {threads.length === 0
                  ? "No conversations yet. Start a group for a placement cohort."
                  : "Nothing matches this filter."}
              </span>
              {threads.length === 0 && role === "admin" && (
                <button type="button" className="wa-btn" onClick={() => void openPicker("group")}>
                  <Icon name="plus" size={13} /> New group
                </button>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ---------------- conversation ---------------- */}
      <section className="wa-conv" aria-label={active ? `Conversation ${active.title}` : "Conversation"}>
        {!active && (
          <div className="wa-blank">
            <span className="wa-blank-mark">
              <Icon name="inbox" size={26} />
            </span>
            <h3>Your messages</h3>
            <p>
              Placement groups, cohort channels and direct conversations live here. Pick a thread
              on the left, or start a new group.
            </p>
            <div className="wa-blank-actions">
              {role === "admin" && (
                <button type="button" className="wa-btn" onClick={() => void openPicker("group")}>
                  <Icon name="plus" size={13} /> New group
                </button>
              )}
              <button
                type="button"
                className="wa-btn ghost"
                onClick={() => void openPicker("direct")}
              >
                <Icon name="user" size={13} /> New conversation
              </button>
            </div>
          </div>
        )}

        {active && (
          <>
            <header className="wa-conv-top">
              <button
                type="button"
                className="wa-icon-btn wa-back"
                aria-label="Back to conversations"
                onClick={() => setMobilePane("list")}
              >
                <Icon name="chevron-left" size={16} />
              </button>
              <Avatar thread={active} size={38} />
              <div className="wa-conv-id">
                <b>{active.title}</b>
                <span>
                  {active.kind === "group"
                    ? `${active.subtitle}${active.my_role !== "member" ? ` · you are ${active.my_role}` : ""}`
                    : active.other_user?.role || "Direct message"}
                </span>
              </div>
              {active.kind === "group" && !active.id.startsWith("draft:") && (
                <button
                  type="button"
                  className={`wa-icon-btn ${infoOpen ? "on" : ""}`}
                  aria-label="Group info"
                  title="Group info"
                  onClick={() => setInfoOpen((v) => !v)}
                >
                  <Icon name="menu" size={16} />
                </button>
              )}
            </header>

            <div className="wa-msgs" ref={scrollRef} role="log" aria-live="polite">
              {messagesLoading && (
                <div className="wa-placeholder">
                  <Icon name="spinner" size={16} />
                  <span>Loading messages</span>
                </div>
              )}

              {!messagesLoading && messages.length === 0 && (
                <div className="wa-day">
                  <span>
                    {active.kind === "group"
                      ? active.description || "No messages yet. Say hello to the group."
                      : "No messages yet. Say hello."}
                  </span>
                </div>
              )}

              {messages.map((message, index) => {
                const mine = message.sender_id === session?.id || message.id.startsWith("local-");
                const previous = messages[index - 1];
                const newDay =
                  !previous || dayLabel(previous.created_at) !== dayLabel(message.created_at);
                const continued =
                  !newDay &&
                  previous &&
                  previous.sender_id === message.sender_id &&
                  new Date(message.created_at).getTime() -
                    new Date(previous.created_at).getTime() <
                    5 * 60 * 1000;

                if (message.type === "system") {
                  return (
                    <div key={message.id} className="wa-system">
                      {message.content}
                    </div>
                  );
                }

                return (
                  <React.Fragment key={message.id}>
                    {newDay && (
                      <div className="wa-day">
                        <span>{dayLabel(message.created_at)}</span>
                      </div>
                    )}
                    <div className={`wa-row ${mine ? "mine" : ""} ${continued ? "cont" : ""}`}>
                      {!mine && active.kind === "group" && (
                        <span
                          className="wa-row-av"
                          style={{ background: senderTint(message.sender_id) }}
                          aria-hidden="true"
                        >
                          {(message.sender_name || "M").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="wa-bubble-wrap">
                        {!mine && active.kind === "group" && !continued && (
                          <span className="wa-sender" style={{ color: senderTint(message.sender_id) }}>
                            {message.sender_name || "Member"}
                          </span>
                        )}
                        <div className={`wa-bubble ${mine ? "mine" : ""}`}>
                          <p>{messageBody(message)}</p>
                          {message.translated_content &&
                            message.translated_content !== message.content && (
                              <p className="wa-translated">{message.translated_content}</p>
                            )}
                          <span className="wa-meta">
                            {message.is_edited && <em>edited</em>}
                            {message.id.startsWith("local-") ? (
                              <span className="wa-pending">sending</span>
                            ) : (
                              <>
                                <time>{timeOf(message.created_at)}</time>
                                {mine && (
                                  <span
                                    className={`wa-ticks ${message.read ? "read" : ""}`}
                                    aria-label={message.read ? "Read" : "Delivered"}
                                    style={message.read ? { color: "var(--blue)" } : undefined}
                                  >
                                    <Icon name="check" size={11} />
                                    <Icon name="check" size={11} />
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>

            <div className="wa-composer">
              <textarea
                ref={composerRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder={active.kind === "group" ? `Message ${active.title}` : "Type a message"}
                rows={1}
                aria-label="Message"
              />
              <button
                type="button"
                className="wa-send"
                onClick={() => void send()}
                disabled={!text.trim() || sending}
                aria-label="Send message"
              >
                <Icon name={sending ? "spinner" : "send"} size={16} />
              </button>
            </div>
          </>
        )}
      </section>

      {/* ---------------- group info ---------------- */}
      {infoOpen && active && active.kind === "group" && (
        <aside className="wa-info" aria-label="Group information">
          <header className="wa-info-top">
            <h3>Group info</h3>
            <button
              type="button"
              className="wa-icon-btn"
              aria-label="Close group info"
              onClick={() => setInfoOpen(false)}
            >
              <Icon name="x" size={15} />
            </button>
          </header>

          <div className="wa-info-hero">
            <Avatar thread={active} size={62} />
            <b>{active.title}</b>
            <span>
              {GROUP_TYPES.find((t) => t.value === active.type)?.label || active.type} ·{" "}
              {active.subtitle}
            </span>
          </div>

          {active.description && <p className="wa-info-about">{active.description}</p>}

          <div className="wa-info-block">
            <div className="wa-info-head">
              <span>Language</span>
            </div>
            <select
              value={chatSettings?.preferred_language || "en"}
              onChange={(e) => {
                const next = e.target.value;
                setChatSettings((s) => (s ? { ...s, preferred_language: next } : s));
                updateChatSettings({ preferred_language: next }).catch(() => undefined);
              }}
              style={{ width: "100%", height: "32px", borderRadius: "var(--r-sm)", border: "1px solid var(--rule-2)", padding: "0 8px", fontSize: "12px" }}
            >
              <option value="en">English</option>
              <option value="sw">Swahili</option>
              <option value="fr">French</option>
              <option value="es">Spanish</option>
              <option value="ar">Arabic</option>
              <option value="pt">Portuguese</option>
              <option value="de">German</option>
              <option value="zh">Chinese</option>
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "11px", color: "var(--muted)" }}>
              <input
                type="checkbox"
                checked={chatSettings?.auto_translate ?? true}
                onChange={(e) => {
                  const next = e.target.checked;
                  setChatSettings((s) => (s ? { ...s, auto_translate: next } : s));
                  updateChatSettings({ auto_translate: next }).catch(() => undefined);
                }}
              />
              Auto-translate incoming messages
            </label>
          </div>

          <div className="wa-info-block">
            <div className="wa-info-head">
              <span>Members</span>
              <button
                type="button"
                className="wa-link"
                onClick={() => void openPicker("member")}
              >
                Add
              </button>
            </div>
            <ul className="wa-members">
              {members.map((member) => (
                <li key={member.id}>
                  <span className="wa-row-av" aria-hidden="true">
                    {member.initials}
                  </span>
                  <span>
                    <b>{member.name}</b>
                    <em>{member.role}</em>
                  </span>
                  {role === "admin" && member.user_id !== session?.id && member.role !== "owner" && (
                    <button
                      type="button"
                      className="wa-link"
                      style={{ marginLeft: "auto", color: "var(--red)" }}
                      onClick={() => void (async () => {
                        try {
                          await removeMember(active.id, member.user_id);
                          setMembers(await listMembers(active.id));
                          toast(`${member.name} removed`);
                        } catch (e) {
                          toast(e instanceof Error ? e.message : "Could not remove member");
                        }
                      })()}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
              {members.length === 0 && (
                <li className="wa-muted">Only group admins can see the member list.</li>
              )}
            </ul>
          </div>

          {role === "admin" && (
            <button
              type="button"
              className="wa-btn danger"
              onClick={() => void (async () => {
                if (!active) return;
                if (!window.confirm(`Delete channel "${active.title}"? This cannot be undone.`)) return;
                try {
                  await deleteGroup(active.id);
                  toast("Channel deleted");
                  await refreshThreads();
                  setActiveId(null);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Could not delete channel");
                }
              })()}
            >
              <Icon name="trash" size={13} /> Delete channel
            </button>
          )}
          <button type="button" className="wa-btn danger" onClick={() => void onLeaveGroup()}>
            <Icon name="x" size={13} /> Leave group
          </button>
        </aside>
      )}

      {/* ---------------- people picker ---------------- */}
      {pickerMode && (
        <PeoplePicker
          mode={pickerMode}
          contacts={contacts}
          onClose={() => setPickerMode(null)}
          onPick={(person) => {
            if (pickerMode === "member" && active) {
              void (async () => {
                try {
                  await addMember(active.id, person.id);
                  setMembers(await listMembers(active.id));
                  toast(`${person.name} added to ${active.title}`);
                  setPickerMode(null);
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Could not add member");
                }
              })();
              return;
            }
            startDirect(person);
          }}
          onCreated={onCreatedGroup}
        />
      )}
    </div>
  );
}

// ---- new group / new conversation ------------------------------------------

function PeoplePicker({
  mode,
  contacts,
  onClose,
  onPick,
  onCreated,
}: {
  mode: "group" | "direct" | "member";
  contacts: ChatPerson[];
  onClose: () => void;
  onPick: (person: ChatPerson) => void;
  onCreated: (thread: ChatThread) => void;
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("placement");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = contacts.filter((c) => {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return c.name.toLowerCase().includes(needle) || c.role.toLowerCase().includes(needle);
  });

  const toggle = (id: string) =>
    setSelected((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  const create = async () => {
    if (!name.trim()) {
      setError("Give the group a name");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const thread = await createGroup({
        name: name.trim(),
        type,
        description: description.trim(),
        member_ids: selected,
      });
      onCreated(thread);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the group");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="wa-modal-veil" onClick={onClose} role="presentation">
      <div
        className="wa-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={mode === "group" ? "New group" : mode === "member" ? "Add member" : "New conversation"}
      >
        <header>
          <h3>
            {mode === "group" ? "New group" : mode === "member" ? "Add to group" : "New conversation"}
          </h3>
          <button type="button" className="wa-icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </header>

        {mode === "group" && (
          <div className="wa-modal-fields">
            <label>
              <span>Group name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Nairobi Summer Placement 2026"
                autoFocus
              />
            </label>
            <label>
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {GROUP_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Description</span>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this channel for?"
              />
            </label>
          </div>
        )}

        <div className="wa-search">
          <Icon name="search" size={14} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
          />
        </div>

        <ul className="wa-people">
          {shown.map((person) => {
            const checked = selected.includes(person.id);
            return (
              <li key={person.id}>
                <button
                  type="button"
                  className={checked ? "on" : ""}
                  onClick={() => (mode === "group" ? toggle(person.id) : onPick(person))}
                >
                  <span className="wa-row-av" aria-hidden="true">
                    {person.initials}
                  </span>
                  <span>
                    <b>{person.name}</b>
                    <em>{person.role}</em>
                  </span>
                  {mode === "group" && (
                    <span className={`wa-tick ${checked ? "on" : ""}`}>
                      {checked && <Icon name="check" size={12} />}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="wa-muted">No people match that search.</li>}
        </ul>

        {error && <p className="wa-modal-error">{error}</p>}

        {mode === "group" && (
          <footer>
            <span className="wa-muted">{selected.length} selected</span>
            <button type="button" className="wa-btn" onClick={() => void create()} disabled={busy}>
              {busy ? "Creating" : "Create group"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
