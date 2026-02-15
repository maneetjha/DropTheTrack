"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { getMessages, ChatMessage } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { SendHorizontal } from "lucide-react";

/** Hook to track visual viewport height (shrinks when mobile keyboard opens) */
function useVisualViewportHeight() {
  const [offset, setOffset] = useState(0);
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const update = () => {
      // offset = how much the keyboard is eating from the bottom
      setOffset(window.innerHeight - vv.height);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return offset;
}

interface RoomChatProps {
  roomId: string;
  currentUserId: string | null;
  fullHeight?: boolean;
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

export default function RoomChat({ roomId, currentUserId, fullHeight }: RoomChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const userScrolledUp = useRef(false);
  const keyboardOffset = useVisualViewportHeight();

  useEffect(() => {
    getMessages(roomId).then(setMessages).catch(() => {});
  }, [roomId]);

  useEffect(() => {
    const socket = getSocket();
    const handler = (msg: ChatMessage) => { setMessages((prev) => [...prev, msg]); };
    socket.on("new-message", handler);
    return () => { socket.off("new-message", handler); };
  }, []);

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
  };

  const sendMessage = useCallback(() => {
    const text = input.trim();
    if (!text || !currentUserId) return;
    getSocket().emit("chat-message", { roomId, text });
    setInput("");
    userScrolledUp.current = false;
  }, [input, roomId, currentUserId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const renderMessage = (msg: ChatMessage) => {
    const isMine = msg.userId === currentUserId;

    if (isMine) {
      return (
        <div key={msg.id} className="flex flex-col items-end">
          <div className="max-w-[80%] rounded-xl rounded-br-sm border border-[rgba(124,58,237,0.2)] bg-[rgba(124,58,237,0.15)] px-3.5 py-2.5">
            <p className="text-[14px] leading-relaxed text-[var(--text-primary)] break-words">{msg.text}</p>
          </div>
          <span className="mt-1 text-[11px] text-[var(--text-muted)]">{timeAgo(msg.createdAt)}</span>
        </div>
      );
    }

    return (
      <div key={msg.id} className="flex gap-2.5">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white ${avatarColor(msg.userName)}`}>
          {msg.userName.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-[13px] font-semibold text-[var(--brand)]">{msg.userName}</span>
            <span className="text-[11px] text-[var(--text-muted)]">{timeAgo(msg.createdAt)}</span>
          </div>
          <div className="mt-1 max-w-[85%] rounded-xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
            <p className="text-[14px] leading-relaxed text-[var(--text-primary)] break-words">{msg.text}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col ${fullHeight ? "h-full" : ""}`}>
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b border-[var(--border)] px-4">
        <h3 className="font-display text-[16px] font-semibold text-[var(--text-primary)]">Chat</h3>
        <span className="ml-auto text-[12px] text-[var(--text-muted)]">{messages.length}</span>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="py-12 text-center text-[13px] text-[var(--text-muted)]">No messages yet. Say hi!</p>
        )}
        {messages.map(renderMessage)}
      </div>

      {/* Input — adjusts position when mobile keyboard opens */}
      <div
        className="shrink-0 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-transform duration-100"
        style={keyboardOffset > 0 ? { transform: `translateY(-${keyboardOffset}px)` } : undefined}
      >
        {currentUserId ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              maxLength={500}
              enterKeyHint="send"
              className="h-10 flex-1 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 text-[14px] text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none transition focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-glow)]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-[0.95] ${input.trim() ? "bg-[var(--brand)] text-white glow-button" : "bg-[var(--surface-hover)] text-[var(--text-muted)]"}`}
            >
              <SendHorizontal className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <p className="text-center text-[13px] text-[var(--text-muted)]">Log in to chat</p>
        )}
      </div>
    </div>
  );
}
