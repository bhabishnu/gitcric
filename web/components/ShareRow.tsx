"use client";

import { useState } from "react";
import { toPng } from "html-to-image";
import { XMark, LinkedInMark, RedditMark } from "./icons";

/**
 * Share row: download the card as a PNG (rendered from the live card node) plus
 * X / LinkedIn / Reddit intents. Buttons scale on :active (pressable).
 *
 * `ovr` and `role` describe the VISITOR's own card, not the active segment — the
 * copy says "I got scouted", so switching to a cricketer twin must not rewrite
 * the boast with the twin's numbers.
 */
export function ShareRow({
  captureId,
  username,
  ovr,
  role,
  shareUrl,
}: {
  captureId: string;
  username: string;
  ovr: number;
  role: string;
  shareUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const text = `I got scouted — ${ovr} OVR ${role} on GitCric 🏏`;

  async function download() {
    const node = document.getElementById(captureId);
    if (!node || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: "#0a0a0b" });
      const a = document.createElement("a");
      a.download = `gitcric-${username}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      /* capture can fail on cross-origin avatars; the share links still work */
    } finally {
      setBusy(false);
    }
  }

  const enc = encodeURIComponent;
  const links = {
    x: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(shareUrl)}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(shareUrl)}`,
    reddit: `https://www.reddit.com/submit?url=${enc(shareUrl)}&title=${enc(text)}`,
  };

  return (
    <div className="flex items-center gap-2">
      <ShareLink href={links.x} label="Share on X">
        <XMark className="h-[13px] w-[13px]" />
      </ShareLink>
      <ShareLink href={links.linkedin} label="Share on LinkedIn">
        <LinkedInMark className="h-[15px] w-[15px]" />
      </ShareLink>
      <ShareLink href={links.reddit} label="Share on Reddit">
        <RedditMark className="h-[15px] w-[15px]" />
      </ShareLink>
      <button
        onClick={download}
        disabled={busy}
        className="pressable ml-auto rounded-md border border-[var(--color-hairline)] bg-[var(--color-panel-2)] px-3 py-2 text-xs font-medium text-[var(--color-text)] disabled:opacity-50"
      >
        {busy ? "Rendering…" : "Download PNG"}
      </button>
    </div>
  );
}

function ShareLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="pressable gc-share"
    >
      {children}
    </a>
  );
}
