"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import {
  createPost,
  createReply,
  getReplies,
  toggleReaction,
  toggleReplyReaction,
} from "@/app/banter/actions";

// ── Push notification hook ─────────────────────────────────────────────────

function usePushNotifications() {
  const [state, setState] = useState<"unsupported" | "default" | "granted" | "denied" | "loading">("unsupported");
  const [sub, setSub] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setState(Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "default");
    navigator.serviceWorker.ready.then((reg) => {
      reg.pushManager.getSubscription().then((s) => {
        setSub(s);
        if (s) setState("granted");
      });
    });
  }, []);

  async function subscribe() {
    if (!("serviceWorker" in navigator)) return;
    setState("loading");
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") { setState("denied"); return; }
      const s = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      setSub(s);
      const json = s.toJSON();
      await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: s.endpoint, keys: json.keys }),
      });
      setState("granted");
    } catch { setState("default"); }
  }

  async function unsubscribe() {
    if (!sub) return;
    setState("loading");
    await fetch("/api/push", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    await sub.unsubscribe();
    setSub(null);
    setState("default");
  }

  return { state, subscribe, unsubscribe };
}

// ── Types ──────────────────────────────────────────────────────────────────

type ReactionData = { id: string; emoji: string; userId: string };

type ReplyData = {
  id: string;
  authorId: string;
  authorName: string | null;
  colorIdx: number;
  text: string;
  createdAt: string;
  reactions: ReactionData[];
};

type PostData = {
  id: string;
  authorId: string;
  authorName: string | null;
  colorIdx: number;
  text: string;
  imageUrl: string | null;
  gifUrl: string | null;
  isSystem: boolean;
  systemType: string | null;
  systemData: Record<string, string> | null;
  createdAt: string;
  reactions: ReactionData[];
  replyCount: number;
  replies: ReplyData[];
};

type DraftInfo = {
  name: string;
  year: number;
  date: string;
  status: string;
} | null;

type OnlineUser = {
  id: string;
  name: string | null;
  lastSeenAt: string;
  colorIdx: number;
  isMe: boolean;
};



const EMOJIS = [
  "🔥","💀","🫡","👑","😭","⚽","🏆","😤","🤣","💸","😬","🎯","🫣","📉","📈","🪦",
  "🧊","🐐","🧢","💪","😮","🤬","😴","🎰","👏","🤑","🫠","😈","🙏","👻","💥","⭐",
  "🏳️","🏴","🤡","🫵","😅","😎","😱","🪄",
];

// ── Helpers ────────────────────────────────────────────────────────────────

function initials(name: string | null): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function fmtRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Suppress hydration mismatch: Date.now() differs between server render and client hydration
function RelTime({ iso, className, style }: { iso: string; className?: string; style?: React.CSSProperties }) {
  return (
    <time dateTime={iso} suppressHydrationWarning className={className} style={style}>
      {fmtRelTime(iso)}
    </time>
  );
}

function groupReactions(reactions: ReactionData[], myId: string) {
  const map = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const entry = map.get(r.emoji) ?? { count: 0, mine: false };
    entry.count++;
    if (r.userId === myId) entry.mine = true;
    map.set(r.emoji, entry);
  }
  return [...map.entries()].map(([emoji, { count, mine }]) => ({ emoji, count, mine }));
}

// ── Avatar ─────────────────────────────────────────────────────────────────

function Avatar({ name, colorIdx, size = "lg", system = false }: {
  name: string | null;
  colorIdx: number;
  size?: "lg" | "sm";
  system?: boolean;
}) {
  const sz = size === "lg" ? 36 : 28;
  const fs = size === "lg" ? 15 : 12;
  if (system) {
    return (
      <div style={{
        width: sz, height: sz, borderRadius: "50%", flexShrink: 0,
        background: "var(--surface-2)", border: "2px solid var(--line)",
        display: "grid", placeItems: "center", fontSize: fs + 4,
      }}>⚽</div>
    );
  }
  return (
    <div
      className={`m${colorIdx}`}
      style={{
        width: sz, height: sz, borderRadius: "50%", flexShrink: 0,
        background: "var(--m)", color: "#fff",
        display: "grid", placeItems: "center",
        fontFamily: "var(--font-archivo), Archivo, sans-serif",
        fontWeight: 800, fontSize: fs,
        boxShadow: size === "lg" ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--m)" : undefined,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ── Emoji Picker ────────────────────────────────────────────────────────────

function EmojiPicker({ onSelect, onClose, anchorRef }: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose, anchorRef]);

  // Position below anchor, clamped to viewport
  const style: React.CSSProperties = { position: "fixed", zIndex: 50, width: 248 };
  if (anchorRef.current) {
    const rect = anchorRef.current.getBoundingClientRect();
    style.top = rect.bottom + 6;
    style.left = Math.min(rect.left, (typeof window !== "undefined" ? window.innerWidth : 400) - 260);
  }

  return (
    <div ref={ref} style={{
      ...style,
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: 14, boxShadow: "var(--shadow-lg)", padding: "10px 12px",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)", marginBottom: 8 }}>
        Football pool vibes
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onSelect(e)}
            style={{ fontSize: 22, cursor: "pointer", padding: 4, borderRadius: 8, border: "none", background: "transparent", transition: ".1s" }}
            onMouseOver={(ev) => (ev.currentTarget.style.background = "var(--surface-2)")}
            onMouseOut={(ev) => (ev.currentTarget.style.background = "transparent")}
          >{e}</button>
        ))}
      </div>
    </div>
  );
}

// ── Reaction Bar ────────────────────────────────────────────────────────────

function ReactionBar({ reactions, myId, onToggle }: {
  reactions: ReactionData[];
  myId: string;
  onToggle: (emoji: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const grouped = groupReactions(reactions, myId);

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, padding: "10px 16px 0" }}>
      {grouped.map(({ emoji, count, mine }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onToggle(emoji)}
          className={`banter-rxn${mine ? " mine" : ""}`}
        >
          <span>{emoji}</span>
          <span className="banter-rxn-ct">{count}</span>
        </button>
      ))}
      <button
        ref={addBtnRef}
        type="button"
        onClick={() => setPickerOpen((p) => !p)}
        className="banter-rxn-add"
        title="Add reaction"
      >＋</button>
      {pickerOpen && (
        <EmojiPicker
          anchorRef={addBtnRef}
          onSelect={(e) => { onToggle(e); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Reply Thread ────────────────────────────────────────────────────────────

function ReplyThread({ postId, initialReplies, replyCount, myId, myName, myColorIdx }: {
  postId: string;
  initialReplies: ReplyData[];
  replyCount: number;
  myId: string;
  myName: string;
  myColorIdx: number;
}) {
  const [replies, setReplies] = useState<ReplyData[]>(initialReplies);
  const [loaded, setLoaded] = useState(initialReplies.length >= replyCount);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function loadAll() {
    const full = await getReplies(postId);
    setReplies(full as unknown as ReplyData[]);
    setLoaded(true);
  }

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    const optimistic: ReplyData = {
      id: `opt-${Date.now()}`,
      authorId: myId,
      authorName: myName,
      colorIdx: myColorIdx,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      reactions: [],
    };
    setReplies((p) => [...p, optimistic]);
    setText("");
    await createReply(postId, optimistic.text);
    setSending(false);
  }

  async function handleReplyReaction(replyId: string, emoji: string) {
    setReplies((prev) =>
      prev.map((r) => {
        if (r.id !== replyId) return r;
        const existing = r.reactions.find((rx) => rx.emoji === emoji && rx.userId === myId);
        const reactions = existing
          ? r.reactions.filter((rx) => !(rx.emoji === emoji && rx.userId === myId))
          : [...r.reactions, { id: `opt-${Date.now()}`, emoji, userId: myId }];
        return { ...r, reactions };
      })
    );
    await toggleReplyReaction(replyId, emoji);
  }

  return (
    <div className="banter-replies">
      {!loaded && replyCount > initialReplies.length && (
        <button type="button" onClick={loadAll} className="banter-load-more">
          Load {replyCount - initialReplies.length} more {replyCount - initialReplies.length === 1 ? "reply" : "replies"}
        </button>
      )}
      {replies.map((r) => {
        const grouped = groupReactions(r.reactions, myId);
        return (
          <div key={r.id} className="banter-reply">
            <Avatar name={r.authorName} colorIdx={r.colorIdx} size="sm" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 800, fontSize: 13.5 }}>{r.authorName ?? "?"}</span>
                <RelTime iso={r.createdAt} style={{ fontSize: 11, color: "var(--ink-faint)" }} />
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.45, marginTop: 3, wordBreak: "break-word" }}>{r.text}</div>
              {grouped.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                  {grouped.map(({ emoji, count, mine }) => (
                    <button key={emoji} type="button"
                      onClick={() => handleReplyReaction(r.id, emoji)}
                      className={`banter-mini-rxn${mine ? " mine" : ""}`}
                    >{emoji}{count > 1 && <span style={{ fontSize: 11, marginLeft: 2, fontFamily: "var(--font-spline)" }}>{count}</span>}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Reply composer */}
      <div className="banter-reply-compose">
        <Avatar name={myName} colorIdx={myColorIdx} size="sm" />
        <input
          className="banter-reply-input"
          placeholder="Reply to the thread…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={sending}
        />
        <button type="button" onClick={send} disabled={sending || !text.trim()} className="banter-reply-send">
          Send
        </button>
      </div>
    </div>
  );
}

// ── Chat Composer ───────────────────────────────────────────────────────────

function ChatComposer({ myId, myName, myColorIdx, onPost, onRefresh }: {
  myId: string;
  myName: string;
  myColorIdx: number;
  onPost: (post: PostData) => void;
  onRefresh: (posts: PostData[]) => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const optimistic: PostData = {
      id: `opt-${Date.now()}`,
      authorId: myId, authorName: myName, colorIdx: myColorIdx,
      text: text.trim(), imageUrl: null, gifUrl: null,
      isSystem: false, systemType: null, systemData: null,
      createdAt: new Date().toISOString(),
      reactions: [], replyCount: 0, replies: [],
    };
    onPost(optimistic);
    setText("");
    if (inputRef.current) { inputRef.current.style.height = "auto"; }
    try {
      await createPost(optimistic.text);
      // Immediately fetch confirmed posts so optimistic gets replaced with real data
      const res = await fetch("/api/banter/posts", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json() as { posts: PostData[] };
        onRefresh(data.posts);
      }
    } catch (err) {
      console.error("Failed to send message:", err);
    } finally {
      setSubmitting(false);
    }
  }

  function autoResize() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  return (
    <div style={{
      borderTop: "1px solid var(--line)", padding: "10px clamp(12px,3vw,24px)",
      display: "flex", gap: 10, alignItems: "flex-end", flexShrink: 0,
      background: "var(--paper)",
    }}>
      <Avatar name={myName} colorIdx={myColorIdx} size="sm" />
      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        onChange={(e) => { setText(e.target.value); autoResize(); }}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
        placeholder="Say something… 🔥"
        style={{
          flex: 1, resize: "none", border: "1px solid var(--line)", borderRadius: 20,
          padding: "9px 14px", background: "var(--surface)", color: "var(--ink)",
          fontSize: 14, fontFamily: "inherit", outline: "none", minHeight: 38,
          lineHeight: 1.4, overflowY: "hidden", minWidth: 0,
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={submitting || !text.trim()}
        style={{
          width: 38, height: 38, borderRadius: "50%", border: "none", flexShrink: 0,
          background: text.trim() ? "var(--grass)" : "var(--surface-2)",
          color: text.trim() ? "#fff" : "var(--ink-faint)",
          cursor: text.trim() ? "pointer" : "default",
          display: "flex", alignItems: "center", justifyContent: "center", transition: ".15s",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
        </svg>
      </button>
    </div>
  );
}

// ── Chat Message ────────────────────────────────────────────────────────────

function ChatMessage({ post, myId, myName, myColorIdx, onReaction }: {
  post: PostData;
  myId: string;
  myName: string;
  myColorIdx: number;
  onReaction: (postId: string, emoji: string) => void;
}) {
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const reactBtnRef = useRef<HTMLButtonElement>(null);
  const isMe = post.authorId === myId;
  const grouped = groupReactions(post.reactions, myId);

  // System messages — compact inline
  if (post.isSystem) {
    const d = post.systemData ?? {};
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
        <span style={{
          fontSize: 12, color: "var(--ink-faint)", background: "var(--surface-2)",
          border: "1px solid var(--line-soft)", borderRadius: 999, padding: "3px 12px",
        }}>
          {post.systemType === "pick"
            ? `⚽ ${post.authorName} drafted ${d.teamCode ?? "a team"}`
            : `🏟️ ${d.homeTeam} ${d.homeScore}–${d.awayScore} ${d.awayTeam}${d.earnerCents && Number(d.earnerCents) > 0 ? ` · $${(Number(d.earnerCents)/100).toFixed(2)} earned` : ""}`
          }
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 1 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, maxWidth: "78%", flexDirection: isMe ? "row-reverse" : "row" }}>
        {!isMe && <Avatar name={post.authorName} colorIdx={post.colorIdx} size="sm" />}
        <div style={{ minWidth: 0 }}>
          {/* Name + time */}
          <div style={{
            display: "flex", gap: 6, alignItems: "baseline", marginBottom: 3,
            justifyContent: isMe ? "flex-end" : "flex-start",
          }}>
            {!isMe && (
              <span style={{ fontFamily: "var(--font-archivo),Archivo,sans-serif", fontWeight: 800, fontSize: 12 }} className={`m${post.colorIdx}`}>
                {post.authorName ?? "?"}
              </span>
            )}
            <RelTime iso={post.createdAt} style={{ fontSize: 10, color: "var(--ink-faint)" }} />
          </div>

          {/* Bubble */}
          <div style={{ position: "relative" }}>
            <div style={{
              background: isMe ? "var(--grass)" : "var(--surface)",
              color: isMe ? "#fff" : "var(--ink)",
              border: isMe ? "none" : "1px solid var(--line)",
              borderRadius: isMe ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              padding: "9px 14px",
              fontSize: 14, lineHeight: 1.5, wordBreak: "break-word", whiteSpace: "pre-wrap",
            }}>
              {post.text}
              {post.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.imageUrl} alt="" style={{ display: "block", marginTop: 8, borderRadius: 10, maxWidth: "100%", maxHeight: 220, objectFit: "cover" }} />
              )}
              {post.gifUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.gifUrl} alt="" style={{ display: "block", marginTop: 8, borderRadius: 10, maxWidth: "100%", maxHeight: 180, objectFit: "cover" }} />
              )}
            </div>
          </div>

          {/* Reaction row + add button */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4, justifyContent: isMe ? "flex-end" : "flex-start", alignItems: "center" }}>
            {grouped.map(({ emoji, count, mine }) => (
              <button key={emoji} type="button" onClick={() => onReaction(post.id, emoji)}
                className={`banter-rxn${mine ? " mine" : ""}`}
                style={{ fontSize: 12, height: 24, padding: "0 7px" }}>
                <span>{emoji}</span>
                <span className="banter-rxn-ct">{count}</span>
              </button>
            ))}
            <button ref={reactBtnRef} type="button" onClick={() => setPickerOpen(p => !p)}
              className="banter-rxn-add" title="React" style={{ height: 24, width: 24, fontSize: 13 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
              </svg>
            </button>
            {pickerOpen && (
              <EmojiPicker anchorRef={reactBtnRef} onSelect={(e) => { onReaction(post.id, e); setPickerOpen(false); }} onClose={() => setPickerOpen(false)} />
            )}
            <button type="button" onClick={() => setRepliesOpen(p => !p)}
              style={{ fontSize: 11, color: "var(--ink-faint)", background: "none", border: "none", cursor: "pointer", padding: "2px 4px" }}>
              {post.replyCount > 0 ? `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}` : "reply"}
            </button>
          </div>

          {/* Thread */}
          {repliesOpen && (
            <div style={{ marginTop: 6, paddingLeft: isMe ? 0 : 4, borderLeft: isMe ? "none" : "2px solid var(--line)", paddingRight: isMe ? 4 : 0, borderRight: isMe ? "2px solid var(--line)" : "none" }}>
              <ReplyThread
                postId={post.id}
                initialReplies={post.replies}
                replyCount={post.replyCount}
                myId={myId}
                myName={myName}
                myColorIdx={myColorIdx}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Post Card ───────────────────────────────────────────────────────────────

function PostCard({ post, myId, myName, myColorIdx, onReaction }: {
  post: PostData;
  myId: string;
  myName: string;
  myColorIdx: number;
  onReaction: (postId: string, emoji: string) => void;
}) {
  const [repliesOpen, setRepliesOpen] = useState(false);

  if (post.isSystem && post.systemType === "pick") {
    const d = post.systemData ?? {};
    return (
      <div className="banter-post banter-post-system">
        <div className="banter-sys-card">
          <span style={{ fontSize: 22, flexShrink: 0 }}>⚽</span>
          <span style={{ flex: 1, color: "var(--ink-soft)", fontSize: 14 }}>
            <b style={{ color: `var(--m)` }} className={`m${post.colorIdx}`}>{post.authorName}</b>
            {" "}drafted <b>{d.teamCode ?? "a team"}</b>
          </span>
          <RelTime iso={post.createdAt} className="tag-soft" style={{ fontSize: 12, flexShrink: 0 }} />
        </div>
      </div>
    );
  }

  if (post.isSystem && post.systemType === "result") {
    const d = post.systemData ?? {};
    return (
      <div className="banter-post banter-post-system">
        <div className="banter-sys-card">
          <span style={{ fontSize: 22, flexShrink: 0 }}>🏟️</span>
          <span style={{ flex: 1, color: "var(--ink-soft)", fontSize: 14 }}>
            <b>{d.homeTeam} {d.homeScore}–{d.awayScore} {d.awayTeam}</b>
            {d.earnerCents && Number(d.earnerCents) > 0 && (
              <span className="muted"> · <span style={{ color: "var(--grass-deep)", fontWeight: 700 }}>${(Number(d.earnerCents) / 100).toFixed(2)} earned</span></span>
            )}
          </span>
          <RelTime iso={post.createdAt} className="tag-soft" style={{ fontSize: 12, flexShrink: 0 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="banter-post">
      <div style={{ padding: "14px 16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <Avatar name={post.authorName} colorIdx={post.colorIdx} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 800, fontSize: 15 }}>
              <span>{post.authorName ?? "?"}</span>
              <span className={`m-chip m${post.colorIdx}`} style={{ height: 22, fontSize: 11.5 }}>
                <span className="mdot"></span>{post.authorName ?? "?"}
              </span>
            </div>
            <RelTime iso={post.createdAt} style={{ fontSize: 12, color: "var(--ink-faint)" }} />
          </div>
        </div>

        {/* Text */}
        <div style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{post.text}</div>

        {/* Image */}
        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.imageUrl} alt="" style={{ marginTop: 10, borderRadius: 11, width: "100%", maxHeight: 300, objectFit: "cover", border: "1px solid var(--line-soft)" }} />
        )}

        {/* GIF */}
        {post.gifUrl && (
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.gifUrl} alt="" style={{ marginTop: 10, borderRadius: 11, width: "100%", maxHeight: 220, objectFit: "cover", border: "1px solid var(--line-soft)" }} />
            <span className="banter-gif-badge">GIF</span>
          </div>
        )}
      </div>

      {/* Reactions */}
      <ReactionBar reactions={post.reactions} myId={myId} onToggle={(e) => onReaction(post.id, e)} />

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "9px 16px 12px" }}>
        <button type="button" onClick={() => setRepliesOpen((p) => !p)} className="banter-reply-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {post.replyCount > 0 ? `${post.replyCount} ${post.replyCount === 1 ? "reply" : "replies"}` : "Reply"}
        </button>
        <RelTime iso={post.createdAt} style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-faint)" }} />
      </div>

      {/* Replies */}
      {repliesOpen && (
        <ReplyThread
          postId={post.id}
          initialReplies={post.replies}
          replyCount={post.replyCount}
          myId={myId}
          myName={myName}
          myColorIdx={myColorIdx}
        />
      )}
    </div>
  );
}

// ── Main Feed ───────────────────────────────────────────────────────────────

export default function BanterFeed({
  initialPosts,
  currentUserId,
  currentUserName,
  draftInfo,
  onlineUsers = [],
}: {

  initialPosts: PostData[];
  currentUserId: string;
  currentUserName: string;
  draftInfo: DraftInfo;
  onlineUsers?: OnlineUser[];
}) {
  const [posts, setPosts] = useState(initialPosts);
  const push = usePushNotifications();

  // Merge fresh server posts while preserving unconfirmed optimistic messages
  function mergePosts(fresh: PostData[]) {
    setPosts(prev => {
      const freshIds = new Set(fresh.map(p => p.id));
      const freshTexts = new Set(fresh.filter(p => !p.isSystem).map(p => p.text?.trim()).filter(Boolean));
      const pendingOptimistic = prev.filter(
        p => p.id.startsWith("opt-") && !freshTexts.has(p.text?.trim()) && !freshIds.has(p.id)
      );
      return [...pendingOptimistic, ...fresh];
    });
  }

  // Sync from initialPosts (first load / server push)
  useEffect(() => {
    mergePosts(initialPosts);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPosts]);

  // Poll /api/banter/posts every 10 seconds — always hits the DB, bypasses RSC cache
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/banter/posts", { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json() as { posts: PostData[] };
        mergePosts(data.posts);
      } catch { /* ignore network errors */ }
    };
    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stable color index for current user
  const myColorIdx = useCallback(() => {
    const sortedIds = [...new Set(posts.map((p) => p.authorId))].sort();
    const i = sortedIds.indexOf(currentUserId);
    if (i >= 0) return i % 8;
    let h = 0;
    for (let j = 0; j < currentUserId.length; j++) h = (h * 31 + currentUserId.charCodeAt(j)) | 0;
    return Math.abs(h) % 8;
  }, [posts, currentUserId])();

  function handleNewPost(post: PostData) {
    setPosts((p) => [post, ...p]);
  }

  async function handleReaction(postId: string, emoji: string) {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const existing = p.reactions.find((r) => r.emoji === emoji && r.userId === currentUserId);
        const reactions = existing
          ? p.reactions.filter((r) => !(r.emoji === emoji && r.userId === currentUserId))
          : [...p.reactions, { id: `opt-${Date.now()}`, emoji, userId: currentUserId }];
        return { ...p, reactions };
      })
    );
    await toggleReaction(postId, emoji);
  }

  const visiblePosts = posts.filter((p) => !p.isSystem);

  // Sidebar: top hot takes (most reacted non-system posts)
  const hotTakes = [...posts]
    .filter((p) => !p.isSystem && p.text)
    .sort((a, b) => b.reactions.length - a.reactions.length)
    .slice(0, 3);

  return (
    <main style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--nav-h))", overflow: "hidden", width: "100%", maxWidth: "100vw" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--line)", padding: "10px clamp(12px,3vw,24px)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--font-archivo),Archivo,sans-serif", fontWeight: 900, fontSize: 20 }}>Banter</span>
            {onlineUsers.length > 0 && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--grass-deep)", fontWeight: 700 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--grass)", display: "inline-block" }} />
                {onlineUsers.map((u) => u.isMe ? "you" : (u.name?.split(" ")[0] ?? "?")).join(", ")}
              </span>
            )}
          </div>
        </div>
        {push.state !== "unsupported" && push.state !== "denied" && (
          <button
            type="button"
            onClick={push.state === "granted" ? push.unsubscribe : push.subscribe}
            disabled={push.state === "loading"}
            title={push.state === "granted" ? "Turn off notifications" : "Get notified of new posts"}
            style={{
              display: "flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px",
              borderRadius: 999, border: "1px solid var(--line)",
              background: push.state === "granted" ? "var(--grass-soft)" : "transparent",
              color: push.state === "granted" ? "var(--grass-deep)" : "var(--ink-faint)",
              fontFamily: "var(--font-archivo),Archivo,sans-serif", fontWeight: 700, fontSize: 11,
              cursor: push.state === "loading" ? "wait" : "pointer",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill={push.state === "granted" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {push.state === "granted" ? "On" : push.state === "loading" ? "…" : "Notify me"}
          </button>
        )}
        {draftInfo && (draftInfo.status === "upcoming" || draftInfo.status === "draft") && (
          <Link href="/draft" className="btn btn-gold btn-sm">Draft →</Link>
        )}
      </div>

      {/* ── Hot takes strip ─────────────────────────────────── */}
      {hotTakes.length > 0 && (
        <div style={{ borderBottom: "1px solid var(--line-soft)", padding: "8px clamp(12px,3vw,24px)", display: "flex", gap: 8, overflowX: "auto", flexShrink: 0, scrollbarWidth: "none" }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--ink-faint)", flexShrink: 0, alignSelf: "center" }}>🔥 Top takes</span>
          {hotTakes.map((p) => (
            <span key={p.id} style={{
              display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
              background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 999,
              padding: "3px 10px 3px 7px", fontSize: 12, maxWidth: 220,
            }}>
              <span>{p.reactions[0]?.emoji ?? "🔥"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink-soft)" }}>
                {p.text.slice(0, 45)}{p.text.length > 45 ? "…" : ""}
              </span>
              <span style={{ color: "var(--ink-faint)", fontSize: 11, flexShrink: 0 }}>{p.reactions.length}</span>
            </span>
          ))}
        </div>
      )}

      {/* ── Messages ─────────────────────────────────────────── */}
      <div className="chat-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "16px clamp(12px,3vw,24px)", display: "flex", flexDirection: "column", gap: 2 }}>
        {visiblePosts.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--ink-faint)", fontSize: 14, marginTop: 40 }}>
            No messages yet. Drop a hot take 🔥
          </div>
        )}
        {[...visiblePosts].reverse().map((p) => (
          <ChatMessage
            key={p.id}
            post={p}
            myId={currentUserId}
            myName={currentUserName}
            myColorIdx={myColorIdx}
            onReaction={handleReaction}
          />
        ))}
      </div>

      {/* ── Composer ─────────────────────────────────────────── */}
      <ChatComposer
        myId={currentUserId}
        myName={currentUserName}
        myColorIdx={myColorIdx}
        onPost={handleNewPost}
        onRefresh={mergePosts}
      />
    </main>
  );
}
