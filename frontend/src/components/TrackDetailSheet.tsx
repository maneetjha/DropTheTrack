"use client";

import { X, ExternalLink, Copy, Check, Bookmark } from "lucide-react";
import Image from "next/image";
import { useState, useCallback } from "react";
import { saveToLibrary } from "@/lib/api";

export interface TrackDetailPayload {
  title: string;
  url?: string | null;
  thumbnail?: string | null;
  subtitle?: string;
}

interface TrackDetailSheetProps {
  open: boolean;
  onClose: () => void;
  track: TrackDetailPayload | null;
  /** e.g. "Add to queue" when previewing a search result */
  primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
  /** Styling tone for the sheet (defaults to theme variables) */
  tone?: "auto" | "dark";
  /**
   * Optional override for the save button.
   * When provided, the sheet will call this instead of saving directly.
   * Useful in-room to open the playlist picker.
   */
  onSave?: () => void;
  saveLabel?: string;
}

export default function TrackDetailSheet({
  open,
  onClose,
  track,
  primaryAction,
  tone = "auto",
  onSave: onSaveOverride,
  saveLabel,
}: TrackDetailSheetProps) {
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const copyTitle = useCallback(() => {
    if (!track?.title) return;
    void navigator.clipboard.writeText(track.title);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [track]);

  if (!open || !track) return null;

  const ytUrl = track.url || undefined;
  const isDark = tone === "dark";

  const onSave = async () => {
    if (!track?.title || !track.url) return;
    if (onSaveOverride) {
      onSaveOverride();
      return;
    }
    try {
      setSaving(true);
      await saveToLibrary({ title: track.title, url: track.url, thumbnail: track.thumbnail || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch {
      // keep silent; parent UI already nudges login elsewhere
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center px-3 py-4 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="track-detail-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/35 backdrop-blur-[6px] transition-colors hover:bg-black/40"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className={[
          "relative z-10 flex w-full flex-col rounded-3xl",
          "max-h-[82vh] sm:max-h-[min(90vh,520px)]",
          // slightly smaller than before
          "max-w-sm sm:max-w-md",
          isDark
            ? "border border-white/[0.10] bg-[#07070a] shadow-[0_32px_80px_rgba(0,0,0,0.85),0_0_0_1px_rgba(244,108,82,0.12)] ring-1 ring-white/10"
            : "border border-[var(--border)] bg-[var(--surface)]/92 shadow-[0_24px_64px_rgba(0,0,0,0.55),0_0_0_1px_rgba(244,108,82,0.08)] ring-1 ring-[var(--border-glow)]/35",
        ].join(" ")}
      >
        <div className={`flex shrink-0 items-center justify-between px-5 py-3.5 ${isDark ? "border-b border-white/10" : "border-b border-white/10"}`}>
          <h2 id="track-detail-title" className="text-[15px] font-semibold tracking-tight text-[var(--text-primary)]">
            Track details
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] transition hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
          {track.thumbnail ? (
            <div className="relative mx-auto mb-4 aspect-video w-full max-w-sm overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
              <Image src={track.thumbnail} alt={track.title} fill className="object-cover" unoptimized sizes="(max-width: 640px) 100vw, 400px" />
            </div>
          ) : null}
          <p className="text-[16px] font-semibold leading-snug text-[var(--text-primary)]">{track.title}</p>
          {track.subtitle ? (
            <p className="mt-2 text-[13px] text-[var(--text-secondary)]">{track.subtitle}</p>
          ) : null}
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {primaryAction ? (
              <button
                type="button"
                disabled={primaryAction.disabled}
                onClick={primaryAction.onClick}
                className="duotone-cta flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-white transition hover:brightness-105 disabled:opacity-50 sm:col-span-2"
              >
                {primaryAction.label}
              </button>
            ) : null}
            {track.url ? (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-glow)] hover:bg-white/[0.06] disabled:opacity-50"
              >
                <Bookmark className="h-4 w-4 text-[#d84b36]" />
                {onSaveOverride
                  ? saveLabel || "Save to playlist"
                  : saving
                    ? "Saving…"
                    : saved
                      ? "Saved"
                      : "Save to Library"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={copyTitle}
              className="flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-[13px] font-semibold text-[var(--text-primary)] transition hover:border-[var(--border-glow)] hover:bg-white/[0.06]"
            >
              {copied ? <Check className="h-4 w-4 text-[var(--success)]" /> : <Copy className="h-4 w-4 text-[var(--text-muted)]" />}
              {copied ? "Copied" : "Copy title"}
            </button>
            {ytUrl ? (
              <a
                href={ytUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="duotone-cta flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-white transition hover:brightness-105 sm:col-span-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open on YouTube
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
