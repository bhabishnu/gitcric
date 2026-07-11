"use client";

import { useState } from "react";
import type { Segment } from "../lib/view";
import { PlayerCard } from "./PlayerCard";
import { FormatSwitch } from "./FormatSwitch";
import { CardHeader, RightPanel, TraitPanel } from "./panels";
import { ShareRow } from "./ShareRow";

/**
 * The card experience. Holds the active segment (YOU is index 0 and the first
 * render, always). Toggling swaps the card AND both side panels AND the header
 * to the selected segment. Card swap = blur+scale crossfade; panels stagger; the
 * switch animates via clip-path. All keyed remounts so CSS replays on change.
 */
const CAPTURE_ID = "gc-capture-card";

export function CardExperience({
  segments,
  avatarUrl,
  shareUrl,
}: {
  segments: Segment[];
  avatarUrl: string | null;
  shareUrl: string;
}) {
  const [active, setActive] = useState(0);
  const seg = segments[active];
  const you = segments[0];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-14">
      {/* header swaps (gentle fade) */}
      <header key={`h-${seg.id}`} className="gc-swap mb-8">
        <CardHeader segment={seg} />
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-10">
        {/* left panel — order last on mobile (card-first) */}
        <aside key={`l-${seg.id}`} className="gc-swap stagger order-2 lg:order-1 lg:pt-2">
          <TraitPanel segment={seg} />
        </aside>

        {/* center: card → share → switch */}
        <div className="order-1 flex flex-col items-center gap-5 lg:order-2 lg:min-w-[500px]">
          <div key={`c-${seg.id}`} className="gc-swap flex w-full max-w-[500px] justify-center">
            <PlayerCard
              face={seg.card}
              avatarUrl={seg.id === "you" ? avatarUrl : null}
              captureId={CAPTURE_ID}
            />
          </div>
          <div className="w-full max-w-[500px]">
            <ShareRow
              captureId={CAPTURE_ID}
              username={you.card.surname.toLowerCase()}
              ovr={seg.card.ovr}
              shareUrl={shareUrl}
            />
          </div>
          <div className="w-full max-w-[500px] pt-1">
            <FormatSwitch segments={segments} active={active} onChange={setActive} />
          </div>
        </div>

        {/* right panel */}
        <aside key={`r-${seg.id}`} className="gc-swap stagger order-3 lg:pt-2">
          <RightPanel segment={seg} />
        </aside>
      </div>
    </div>
  );
}
