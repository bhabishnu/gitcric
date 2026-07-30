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
const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

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

  /**
   * The card node, once nothing on it is still animating.
   *
   * A format switch REMOUNTS the card (it is keyed on the segment), so the node
   * has to be re-read after waiting — awaiting on the old reference and then
   * capturing it produced an empty "data:," image, because React had already
   * swapped the element out from under it. Loop, because settling one animation
   * can reveal the next.
   */
  async function settledCard(): Promise<HTMLElement | null> {
    // Two frames first: a format switch schedules a React re-render, and
    // without this we sample the OUTGOING node — which has no animations yet,
    // looks settled, and is detached moments later, yielding an empty capture.
    await raf();
    await raf();
    for (let i = 0; i < 4; i++) {
      const node = document.getElementById(captureId);
      if (!node) return null;
      const running = node.getAnimations({ subtree: true });
      if (running.length === 0 && node.isConnected) return node;
      await Promise.all(running.map((a) => a.finished.catch(() => undefined)));
      await raf();
    }
    return document.getElementById(captureId);
  }

  async function download() {
    if (busy) return;
    setBusy(true);
    try {
      let dataUrl = "";
      // Two attempts: if the first lands in the seam of a swap it comes back as
      // an empty "data:," and the retry, a frame later, gets the settled card.
      for (let attempt = 0; attempt < 2 && !dataUrl.startsWith("data:image/png"); attempt++) {
        const node = await settledCard();
        if (!node) return;
        dataUrl = await toPng(node, { pixelRatio: 3, cacheBust: true, backgroundColor: "#0a0a0b" });
      }
      // Never hand the user a broken download.
      if (!dataUrl.startsWith("data:image/png")) return;
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
    // one action row: share marks and the download button share a height and a
    // single gap rhythm, so the bar reads as one control group
    <div className="flex items-center gap-2.5">
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
        className="pressable ml-auto inline-flex h-9 items-center rounded-md border border-[var(--color-hairline)] bg-[var(--color-panel-2)] px-4 text-xs font-medium text-[var(--color-text)] transition-colors duration-150 hover:border-[color-mix(in_srgb,var(--color-crimson)_55%,transparent)] disabled:opacity-50"
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
