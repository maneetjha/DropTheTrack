"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getMessages, ChatMessage, resolveAssetUrl } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { SendHorizontal, X, Reply } from "lucide-react";

interface RoomChatProps {
  roomId: string;
  currentUserId: string | null;
  fullHeight?: boolean;
  /** When set, shows a close control in the header (e.g. desktop chat column). */
  onClose?: () => void;
  /** Hide the Clubhouse header bar entirely (mobile tab — room header already visible above). */
  hideHeader?: boolean;
}

function timeAgo(dateStr: string): string {
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// Simple deterministic color for avatar based on name
function avatarColor(name: string): string {
  const colors = ["bg-violet-600", "bg-rose-600", "bg-sky-600", "bg-emerald-600", "bg-amber-600", "bg-pink-600", "bg-teal-600"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function getTsMs(s: string): number {
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : 0;
}

function timeHHMM(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function RoomChat({ roomId, currentUserId, fullHeight, onClose, hideHeader }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [replyingTo, setReplyingTo] = useState<null | { id: string; userName: string; text: string }>(null);
  const [hasUnreadBelow, setHasUnreadBelow] = useState(false);
  const [msgMenu, setMsgMenu] = useState<null | { x: number; y: number; msg: { id: string; userName: string; text: string } }>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userScrolledUp = useRef(false);
  const swipeStart = useRef<null | { x: number; y: number; msg: { id: string; userName: string; text: string } }>(null);
  const swipeTriggered = useRef(false);
  const swipeEl = useRef<HTMLElement | null>(null);

  useEffect(() => {
    getMessages(roomId)
      .then((m) => setMessages(m.slice(-100)))
      .catch(() => {});
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        return next.length > 100 ? next.slice(-100) : next;
      });
      if (userScrolledUp.current) setHasUnreadBelow(true);
    };
    socket.on("new-message", handler);
    return () => { socket.off("new-message", handler); };
  }, []);

  // Keep composer above on-screen keyboard (iOS / mobile browsers)
  useEffect(() => {
    if (!fullHeight || typeof window === "undefined" || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardInset(inset);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [fullHeight]);

  // Auto-scroll unless user scrolled up
  useEffect(() => {
    if (scrollRef.current && !userScrolledUp.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    userScrolledUp.current = scrollHeight - scrollTop - clientHeight > 60;
    if (!userScrolledUp.current) setHasUnreadBelow(false);
  };

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (!msgMenu) return;
      const el = e.target;
      if (el instanceof Element && el.closest('[data-chat-msg-menu="true"]')) return;
      setMsgMenu(null);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [msgMenu]);

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !currentUserId) return;
    getSocket().emit("chat-message", { roomId, text, replyToId: replyingTo?.id });
    setInput("");
    setReplyingTo(null);
    userScrolledUp.current = false;
    // Keep typing flow uninterrupted after sending.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [input, roomId, currentUserId, replyingTo?.id]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const renderMessage = (msg: ChatMessage) => {
    const isMine = msg.userId === currentUserId;
    const avatarSrc = resolveAssetUrl(msg.userAvatarUrl || null);
    const isSystemSongAdded = msg.meta && msg.meta.kind === "song_added";

    if (isSystemSongAdded) {
      const thumb = resolveAssetUrl(msg.meta.thumbnail || null);
      const addedByName = msg.meta.addedBy?.name || msg.userName || "someone";
      return (
        <div key={msg.id} id={`chat-msg-${msg.id}`} className="flex justify-center">
          <div className="w-full max-w-[92%] rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 shadow-[0_10px_26px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-3">
              {thumb ? (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                  <img src={thumb} alt={msg.meta.title || "Song"} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
                  <Reply className="h-4 w-4 text-[var(--brand)]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary)]">
                  {msg.meta.title || "Song added"}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
                  Added by <span className="font-semibold text-[var(--text-primary)]">{addedByName}</span>
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-[var(--text-muted)]">{timeAgo(msg.createdAt)}</span>
            </div>
          </div>
        </div>
      );
    }

    // WhatsApp-like grouping (same sender, close in time)
    const idx = messages.findIndex((m) => m.id === msg.id);
    const prev = idx > 0 ? messages[idx - 1] : null;
    const next = idx >= 0 && idx < messages.length - 1 ? messages[idx + 1] : null;
    const gapMs = 3 * 60 * 1000; // 3 minutes
    const samePrev =
      !!prev &&
      !prev.meta &&
      !msg.meta &&
      prev.userId === msg.userId &&
      Math.abs(getTsMs(msg.createdAt) - getTsMs(prev.createdAt)) <= gapMs;
    const sameNext =
      !!next &&
      !next.meta &&
      !msg.meta &&
      next.userId === msg.userId &&
      Math.abs(getTsMs(next.createdAt) - getTsMs(msg.createdAt)) <= gapMs;
    const isFirstInGroup = !samePrev;
    const isLastInGroup = !sameNext;

    const openMenu = (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const pt =
        "touches" in e && e.touches && e.touches.length > 0
          ? e.touches[0]
          : "clientX" in e
            ? e
            : null;
      const x = pt ? ("clientX" in pt ? pt.clientX : 0) : 0;
      const y = pt ? ("clientY" in pt ? pt.clientY : 0) : 0;
      setMsgMenu({ x, y, msg: { id: msg.id, userName: msg.userName, text: msg.text } });
    };

    const onTouchStart = (e: React.TouchEvent) => {
      if (!e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      swipeTriggered.current = false;
      swipeEl.current = e.currentTarget as unknown as HTMLElement;
      if (swipeEl.current) {
        swipeEl.current.style.transition = "none";
        swipeEl.current.style.transform = "translateX(0px)";
        swipeEl.current.style.willChange = "transform";
      }
      swipeStart.current = { x: t.clientX, y: t.clientY, msg: { id: msg.id, userName: msg.userName, text: msg.text } };
    };
    const onTouchMove = (e: React.TouchEvent) => {
      if (swipeTriggered.current) return;
      if (!swipeStart.current || !e.touches || e.touches.length === 0) return;
      const t = e.touches[0];
      const dx = t.clientX - swipeStart.current.x;
      const dy = t.clientY - swipeStart.current.y;
      // WhatsApp-like swipe-to-reply: horizontal swipe dominates vertical scroll.
      if (dx > 8 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        e.preventDefault();
        const clamped = Math.max(0, Math.min(72, dx));
        if (swipeEl.current) swipeEl.current.style.transform = `translateX(${clamped}px)`;
      }
      if (dx > 44 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        swipeTriggered.current = true;
        const m = swipeStart.current.msg;
        setReplyingTo(m);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    };
    const onTouchEnd = () => {
      swipeStart.current = null;
      swipeTriggered.current = false;
      if (swipeEl.current) {
        const el = swipeEl.current;
        el.style.transition = "transform 140ms ease-out";
        el.style.transform = "translateX(0px)";
        window.setTimeout(() => {
          el.style.willChange = "";
          el.style.transition = "";
        }, 170);
      }
      swipeEl.current = null;
    };

    if (isMine) {
      return (
        <div key={msg.id} id={`chat-msg-${msg.id}`} className="group flex flex-col items-end">
          <div className={`flex max-w-[78%] flex-col items-end ${isLastInGroup ? "gap-1.5" : "gap-0.5"}`}>
            {/* Bubble — touch handlers here so the whole bubble slides, not just inner text */}
            <div
              onContextMenu={openMenu}
              onDoubleClick={(e) => { e.preventDefault(); setReplyingTo({ id: msg.id, userName: msg.userName, text: msg.text }); inputRef.current?.focus(); }}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className={[
                "select-text border border-[#f46c52]/25 bg-[linear-gradient(135deg,rgba(46,26,20,0.96),rgba(32,18,14,0.92))] px-4 py-2.5 shadow-[0_10px_26px_rgba(0,0,0,0.20)]",
                isFirstInGroup ? "rounded-[18px] rounded-tr-[8px]" : "rounded-[18px] rounded-tr-[8px]",
                isLastInGroup ? "rounded-br-[10px]" : "rounded-br-[18px]",
              ].join(" ")}
            >
              {msg.replyTo ? (
                <button
                  type="button"
                  onClick={() => {
                    const target = document.getElementById(`chat-msg-${msg.replyTo?.id}`);
                    target?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                  className="mb-1.5 block rounded-xl border border-black/20 bg-black/20 px-3 py-1.5 text-left"
                  title="Jump to message"
                >
                  <div className="flex items-stretch gap-2">
                    <div className="w-[3px] shrink-0 rounded-full bg-[#25D366]" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-[#25D366]">{msg.replyTo.userName}</p>
                      <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">{msg.replyTo.text}</p>
                    </div>
                  </div>
                </button>
              ) : null}
              <div className="flex items-end gap-2">
                <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-white/95">{msg.text}</p>
                {isLastInGroup ? (
                  <span className="shrink-0 text-[11px] text-white/45">{timeHHMM(msg.createdAt)}</span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div key={msg.id} id={`chat-msg-${msg.id}`} className={`group flex gap-3 ${isLastInGroup ? "mt-2" : "mt-0.5"}`}>
        {/* WhatsApp grouping: show avatar only on last message in group */}
        <div className="w-9 shrink-0">
          {isLastInGroup ? (
            avatarSrc ? (
              <div className="relative mt-0.5 h-8 w-8 overflow-hidden rounded-full ring-1 ring-white/10">
                <img src={avatarSrc} alt={msg.userName} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white ${avatarColor(msg.userName)}`}>
                {msg.userName.charAt(0).toUpperCase()}
              </div>
            )
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          {/* Name only once per group */}
          {isFirstInGroup ? (
            <div className="mb-1 flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[var(--brand)]">{msg.userName}</span>
            </div>
          ) : null}

          <div className="flex items-start gap-2">
            <div className="max-w-[78%]">
              {/* Bubble — touch handlers on the bubble so the whole bubble slides */}
              <div
                onContextMenu={openMenu}
                onDoubleClick={(e) => { e.preventDefault(); setReplyingTo({ id: msg.id, userName: msg.userName, text: msg.text }); inputRef.current?.focus(); }}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                className={[
                  "mt-0.5 select-text border border-white/10 bg-[#0f1013]/70 px-4 py-2.5 shadow-[0_10px_26px_rgba(0,0,0,0.20)]",
                  isFirstInGroup ? "rounded-[18px] rounded-tl-[8px]" : "rounded-[18px] rounded-tl-[18px]",
                  isLastInGroup ? "rounded-bl-[10px]" : "rounded-bl-[18px]",
                ].join(" ")}
              >
                {msg.replyTo ? (
                  <button
                    type="button"
                    onClick={() => {
                      const target = document.getElementById(`chat-msg-${msg.replyTo?.id}`);
                      target?.scrollIntoView({ behavior: "smooth", block: "center" });
                    }}
                    className="mb-1.5 block rounded-xl border border-black/20 bg-black/20 px-3 py-1.5 text-left"
                    title="Jump to message"
                  >
                    <div className="flex items-stretch gap-2">
                      <div className="w-[3px] shrink-0 rounded-full bg-[#25D366]" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-[#25D366]">{msg.replyTo.userName}</p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">{msg.replyTo.text}</p>
                      </div>
                    </div>
                  </button>
                ) : null}
                <div className="flex items-end gap-2">
                  <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.45] text-white/90">{msg.text}</p>
                  {isLastInGroup ? (
                    <span className="shrink-0 text-[11px] text-white/35">{timeHHMM(msg.createdAt)}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const onInputFocus = () => {
    // Avoid scrolling the whole panel/body on mobile; keep the header + composer locked,
    // and only scroll the message list if needed.
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  return (
    <div
      className={`flex flex-col ${fullHeight ? "h-full min-h-0" : ""}`}
    >
      {/* Header — hidden in mobile tab layout (room header is already visible above) */}
      {!hideHeader && <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-4">
        <h3
          className="flex h-8 items-center font-display text-[17px] font-semibold tracking-tight leading-none"
          style={{ background: "linear-gradient(135deg,#f46c52,#8cc6e8)", WebkitBackgroundClip: "text", color: "transparent" }}
        >
          Clubhouse
        </h3>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-auto inline-flex h-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] px-3 text-[12px] font-semibold leading-none text-[var(--text-primary)] transition hover:border-white/15 hover:bg-white/[0.06]"
            title="Close chat"
            aria-label="Close chat"
          >
            Close
          </button>
        ) : null}
      </div>}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-y-contain px-4 py-4"
      >
        {messages.length === 0 && (
          <p className="py-12 text-center text-[13px] text-[var(--text-muted)]">No messages yet. Say hi!</p>
        )}
        {messages.map(renderMessage)}

        {hasUnreadBelow ? (
          <div className="pointer-events-none sticky bottom-0 flex justify-center pb-2">
            <button
              type="button"
              onClick={() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
                setHasUnreadBelow(false);
                userScrolledUp.current = false;
              }}
              className="pointer-events-auto rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-[var(--text-primary)] shadow-[0_18px_44px_rgba(0,0,0,0.35)] backdrop-blur"
            >
              New messages
            </button>
          </div>
        ) : null}
      </div>

      {/* Input — shrink-0 keeps it anchored at the bottom; flex layout handles the rest */}
      <div
        className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-3 pt-3"
        style={{
          paddingBottom: fullHeight
            ? keyboardInset > 0
              ? `calc(0.75rem + ${keyboardInset}px)`
              : "0.75rem"
            : "0.75rem",
        }}
      >
        {currentUserId ? (
          <div className="flex w-full flex-col gap-2 overflow-hidden">
            {replyingTo ? (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <div className="flex min-w-0 items-stretch gap-2">
                  <div className="w-[3px] shrink-0 rounded-full bg-[#25D366]" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#25D366]">Replying to {replyingTo.userName}</p>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-[var(--text-secondary)]">{replyingTo.text}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyingTo(null)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
                  aria-label="Cancel reply"
                  title="Cancel reply"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}
            <div className="flex w-full items-center gap-2 overflow-hidden">
            <div className="flex h-10 min-w-0 flex-1 items-center rounded-full border border-[var(--border)] bg-[var(--background)] transition focus-within:border-[var(--brand)]">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={onInputFocus}
              placeholder="Type a message..."
              maxLength={500}
              enterKeyHint="send"
              className="chat-composer-input h-full min-w-0 flex-1 appearance-none bg-transparent px-4 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus:shadow-none"
            />
            </div>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={sendMessage}
              disabled={!input.trim()}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-[0.95] focus:outline-none focus-visible:outline-none focus-visible:ring-0 ${input.trim() ? "bg-[#e15a43] text-white hover:brightness-110" : "bg-[var(--surface-hover)] text-[var(--text-muted)]"}`}
            >
              <SendHorizontal className="h-[18px] w-[18px]" />
            </button>
            </div>
          </div>
        ) : (
          <p className="text-center text-[13px] text-[var(--text-muted)]">Log in to chat</p>
        )}
      </div>

      {/* WhatsApp-like message action (context menu / long-press) */}
      {msgMenu ? (
        <div className="fixed inset-0 z-[300]">
          <button type="button" className="absolute inset-0" onClick={() => setMsgMenu(null)} aria-label="Close menu" />
          <div
            data-chat-msg-menu="true"
            className="absolute rounded-xl border border-white/10 bg-[#15161a] px-2 py-2 shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
            style={{ left: Math.min(msgMenu.x, window.innerWidth - 160), top: Math.min(msgMenu.y, window.innerHeight - 120) }}
          >
            <button
              type="button"
              onClick={() => {
                setReplyingTo(msgMenu.msg);
                setMsgMenu(null);
                inputRef.current?.focus();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold text-white/90 hover:bg-white/[0.06]"
            >
              <Reply className="h-4 w-4" />
              Reply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
