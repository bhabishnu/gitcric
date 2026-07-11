"use client";

import { useRef } from "react";
import type { Segment } from "../lib/view";

/**
 * Five-segment switch (YOU | TEST | ODI | T20I | IPL) using Emil's duplicated-
 * list clip-path pattern: an "active" copy of the whole strip sits on top,
 * styled crimson, and is clipped to reveal only the active segment. Animating
 * the clip gives a seamless colour transition timing can't match. Keyboard-
 * initiated changes are instant (never animate a keyboard action).
 */
export function FormatSwitch({
  segments,
  active,
  onChange,
}: {
  segments: Segment[];
  active: number;
  onChange: (i: number) => void;
}) {
  const n = segments.length;
  const instant = useRef(false);
  // reveal only segment `active`: eat everything left of it and right of it
  const clip = `inset(0 ${((n - active - 1) / n) * 100}% 0 ${(active / n) * 100}%)`;

  const move = (i: number, viaKey: boolean) => {
    instant.current = viaKey;
    onChange((i + n) % n);
  };

  return (
    <div
      role="tablist"
      aria-label="Format"
      className="gc-switch"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
          e.preventDefault();
          move(active + (e.key === "ArrowRight" ? 1 : -1), true);
        }
      }}
    >
      {/* base row */}
      {segments.map((s, i) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={i === active}
          tabIndex={i === active ? 0 : -1}
          className="gc-seg pressable"
          onClick={() => move(i, false)}
        >
          {s.tabLabel}
        </button>
      ))}
      {/* active overlay, clipped to the selected segment */}
      <div
        className="gc-switch-active"
        aria-hidden
        data-instant={instant.current ? "" : undefined}
        style={{ clipPath: clip, WebkitClipPath: clip }}
      >
        {segments.map((s) => (
          <span key={s.id} className="gc-seg gc-seg-on">
            {s.tabLabel}
          </span>
        ))}
      </div>
    </div>
  );
}
