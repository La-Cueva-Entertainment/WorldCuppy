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

type Filter = "all" | "takes" | "media" | "picks";

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
                <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>{fmtRelTime(r.createdAt)}</span>
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

// ── Post Composer ───────────────────────────────────────────────────────────

function PostComposer({ myId, myName, myColorIdx, onPost }: {
  myId: string;
  myName: string;
  myColorIdx: number;
  onPost: (post: PostData) => void;
}) {
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }

  async function submit() {
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    const optimistic: PostData = {
      id: `opt-${Date.now()}`,
      authorId: myId,
      authorName: myName,
      colorIdx: myColorIdx,
      text: text.trim(),
      imageUrl: null,
      gifUrl: null,
      isSystem: false,
      systemType: null,
      systemData: null,
      createdAt: new Date().toISOString(),
      reactions: [],
      replyCount: 0,
      replies: [],
    };
    onPost(optimistic);
    setText("");
    if (taRef.current) { taRef.current.style.height = "auto"; }
    setExpanded(false);
    await createPost(optimistic.text);
    setSubmitting(false);
  }

  return (
    <div className="banter-composer">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar name={myName} colorIdx={myColorIdx} size="lg" />
        <textarea
          ref={taRef}
          className="banter-comp-ta"
          placeholder="Drop a hot take… 🔥"
          rows={2}
          value={text}
          onChange={(e) => { setText(e.target.value); autoResize(); }}
          onFocus={() => setExpanded(true)}
        />
      </div>
      {expanded && (
        <div className="banter-comp-actions">
          <button type="button" onClick={() => { setText((t) => t + "😂"); taRef.current?.focus(); }} className="banter-comp-btn">
            😂 Emoji
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={submit} disabled={submitting || !text.trim()} className="btn btn-primary btn-sm">
            Post it
          </button>
        </div>
      )}
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
          <span className="tag-soft" style={{ fontSize: 12, flexShrink: 0 }}>{fmtRelTime(post.createdAt)}</span>
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
          <span className="tag-soft" style={{ fontSize: 12, flexShrink: 0 }}>{fmtRelTime(post.createdAt)}</span>
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
            <div style={{ fontSize: 12, color: "var(--ink-faint)" }}>{fmtRelTime(post.createdAt)}</div>
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
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-faint)" }}>{fmtRelTime(post.createdAt)}</span>
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
}: {
  initialPosts: PostData[];
  currentUserId: string;
  currentUserName: string;
  draftInfo: DraftInfo;
}) {
  const [posts, setPosts] = useState(initialPosts);
  const [filter, setFilter] = useState<Filter>("all");

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

  const visiblePosts = posts.filter((p) => {
    if (filter === "takes") return !p.isSystem && !p.imageUrl && !p.gifUrl;
    if (filter === "media") return !p.isSystem && (!!p.imageUrl || !!p.gifUrl);
    if (filter === "picks") return p.isSystem;
    return true;
  });

  // Sidebar: top hot takes (most reacted non-system posts)
  const hotTakes = [...posts]
    .filter((p) => !p.isSystem && p.text)
    .sort((a, b) => b.reactions.length - a.reactions.length)
    .slice(0, 3);

  // Sidebar: active users (most recent post per user)
  const seenUsers = new Set<string>();
  const activeUsers = posts
    .filter((p) => !p.isSystem && !seenUsers.has(p.authorId) && seenUsers.add(p.authorId) !== undefined)
    .slice(0, 4);

  const TABS: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "takes", label: "🔥 Hot takes" },
    { value: "media", label: "📸 Media" },
    { value: "picks", label: "⚽ Picks" },
  ];

  return (
    <main className="page">
      <div className="wrap">
        {/* Header */}
        <div className="between" style={{ marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="kicker grass">The group chat, but better</div>
            <h1 style={{ fontSize: "clamp(28px,4vw,38px)", marginTop: 4 }}>Banter</h1>
          </div>
          {activeUsers.length > 0 && (
            <span className="badge hot" style={{ height: 28, fontSize: 13 }}>
              <span className="live-dot" />{" "}{activeUsers.length} manager{activeUsers.length !== 1 ? "s" : ""} active
            </span>
          )}
        </div>

        <div className="banter-grid">
          {/* ── Feed column ── */}
          <div>
            {/* Composer */}
            <PostComposer
              myId={currentUserId}
              myName={currentUserName}
              myColorIdx={myColorIdx}
              onPost={handleNewPost}
            />

            {/* Filter tabs */}
            <div className="banter-tabs">
              {TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFilter(t.value)}
                  className={`banter-tab${filter === t.value ? " on" : ""}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Feed */}
            {visiblePosts.length === 0 ? (
              <div className="card card-pad" style={{ textAlign: "center", color: "var(--ink-faint)", fontSize: 14 }}>
                No posts yet.{filter === "all" ? " Be the first to drop a hot take 🔥" : ""}
              </div>
            ) : (
              visiblePosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  myId={currentUserId}
                  myName={currentUserName}
                  myColorIdx={myColorIdx}
                  onReaction={handleReaction}
                />
              ))
            )}
          </div>

          {/* ── Sidebar ── */}
          <aside style={{ display: "grid", gap: 18, position: "sticky", top: 80, alignSelf: "start" }}>
            {/* Top hot takes */}
            <section className="card">
              <div className="card-pad" style={{ paddingBottom: 6 }}>
                <h2 style={{ fontSize: 18, marginBottom: 2 }}>🏆 Top hot takes</h2>
                <div className="tag-soft">Most reacted this week</div>
              </div>
              {hotTakes.length === 0 ? (
                <div style={{ padding: "14px 18px", fontSize: 13, color: "var(--ink-faint)" }}>No takes yet. Start talking.</div>
              ) : (
                hotTakes.map((p) => (
                  <div key={p.id} className="banter-hot-take">
                    <span style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
                      {p.reactions[0]?.emoji ?? "🔥"}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, lineHeight: 1.4 }}>&ldquo;{p.text.slice(0, 90)}{p.text.length > 90 ? "…" : ""}&rdquo;</div>
                      <div style={{ fontSize: 12, color: "var(--ink-faint)", marginTop: 3 }}>
                        {p.authorName} · {p.reactions.length} reaction{p.reactions.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Active now */}
            {activeUsers.length > 0 && (
              <section className="card card-pad">
                <h2 style={{ fontSize: 17, marginBottom: 10 }}>Active now</h2>
                <div>
                  {activeUsers.map((p) => (
                    <div key={p.authorId} className="banter-active-row">
                      <Avatar name={p.authorName} colorIdx={p.colorIdx} size="sm" />
                      <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>
                        {p.authorName ?? "?"}
                        {p.authorId === currentUserId && <span style={{ fontWeight: 400, color: "var(--ink-faint)", fontSize: 12 }}> (you)</span>}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--ink-faint)" }}>{fmtRelTime(p.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Draft night card */}
            {draftInfo && (draftInfo.status === "upcoming" || draftInfo.status === "draft") && (
              <section className="card card-pad" style={{ background: "var(--gold-soft)", borderColor: "var(--gold)" }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>📢</span>
                  <div>
                    <div style={{ fontFamily: "var(--font-archivo), Archivo, sans-serif", fontWeight: 800, fontSize: 15 }}>
                      {draftInfo.name} {draftInfo.year}
                    </div>
                    <div className="tag-soft">
                      {draftInfo.status === "draft" ? "Draft is open now!" : `Draft ${new Date(draftInfo.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </div>
                  </div>
                </div>
                <Link href="/draft" className="btn btn-gold btn-sm btn-block" style={{ marginTop: 4 }}>
                  Open the draft →
                </Link>
              </section>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
