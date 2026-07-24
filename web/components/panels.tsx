import type { Segment } from "../lib/view";
import { ovrToPercentile } from "../lib/view";

/* ── shared primitives ─────────────────────────────────────────────────────── */

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="tabular mb-3 text-[10px] uppercase tracking-[0.2em] text-[var(--color-faint)]">
      {children}
    </p>
  );
}

function Bar({ fill }: { fill: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-hairline)]">
      <div
        className="h-full rounded-full bg-[var(--color-muted)]"
        style={{ width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%` }}
      />
    </div>
  );
}

/** Where the OVR sits on the 40..99 scale, one crimson marker. */
function Distribution({ ovr }: { ovr: number }) {
  const pct = ovrToPercentile(ovr);
  return (
    <div>
      <PanelLabel>Distribution</PanelLabel>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-px w-full -translate-y-1/2 bg-[var(--color-hairline)]" />
        <div
          className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 bg-[var(--color-crimson)]"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="tabular mt-1 flex justify-between text-[10px] text-[var(--color-faint)]">
        <span>40</span>
        <span className="text-[var(--color-muted)]">{ordinal(pct)} percentile</span>
        <span>99</span>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/* ── left panel: archetype + traits ────────────────────────────────────────── */

export function TraitPanel({ segment }: { segment: Segment }) {
  return (
    <div>
      <PanelLabel>Archetype</PanelLabel>
      <h2 className="font-[family-name:var(--font-display)] text-2xl font-[700] uppercase leading-none tracking-tight">
        {segment.archetype}
      </h2>
      <div className="mt-5 flex flex-col gap-4">
        {segment.traits.map((t) => (
          <div key={t.label}>
            <p className="text-[13px] font-medium text-[var(--color-text)]">{t.label}</p>
            <p className="mt-0.5 text-xs leading-snug text-[var(--color-faint)]">{t.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── right panel: scout report (YOU) or career (cricketer) ──────────────────── */

export function RightPanel({ segment }: { segment: Segment }) {
  const r = segment.right;
  if (r.kind === "scout") {
    return (
      <div>
        <PanelLabel>Scout report</PanelLabel>
        <div className="flex flex-col gap-3">
          {r.metrics.map((m) => (
            <div key={m.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-[var(--color-text)]">{m.label}</span>
                <span className="tabular text-xs text-[var(--color-muted)]">
                  {m.value}
                  <span className="ml-1.5 text-[var(--color-faint)]">→ {m.axis}</span>
                </span>
              </div>
              <Bar fill={m.fill} />
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-[var(--color-hairline)] pt-5">
          <Distribution ovr={r.percentile} />
        </div>
      </div>
    );
  }
  return (
    <div>
      <PanelLabel>Career record</PanelLabel>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {r.rows.map((row) => (
          <div key={row.label} className="flex flex-col">
            <dt className="text-[11px] uppercase tracking-wide text-[var(--color-faint)]">{row.label}</dt>
            <dd className="tabular mt-0.5 text-lg text-[var(--color-text)]">{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 border-t border-[var(--color-hairline)] pt-5">
        <Distribution ovr={r.distribution} />
      </div>
    </div>
  );
}

/* ── header (swaps with the segment) ───────────────────────────────────────── */

export function CardHeader({ segment }: { segment: Segment }) {
  const c = segment.card;
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="tabular flex h-11 w-11 items-center justify-center rounded-md border border-[var(--color-hairline)] font-[family-name:var(--font-display)] text-2xl font-[800]">
        {c.ovr}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-[700] uppercase leading-none tracking-tight">
            {c.fullName}
          </h1>
          <span className="tabular rounded border border-[var(--color-hairline)] px-1.5 py-0.5 text-[10px] tracking-wide text-[var(--color-muted)]">
            {c.roleLabel}
          </span>
        </div>
        {/* TEST · 168 matches · IMMORTAL — the tier is named here and nowhere on
            the card face. Tier picks up the display family, letterspaced and a
            step down, so it reads as a rank rather than another fact. */}
        <p className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-[var(--color-muted)]">
          {segment.header.handle && <span>{segment.header.handle}</span>}
          {segment.header.handle && segment.header.sub && <span className="text-[var(--color-faint)]">·</span>}
          {segment.header.sub && <span>{segment.header.sub}</span>}
          {(segment.header.handle || segment.header.sub) && (
            <span className="text-[var(--color-faint)]">·</span>
          )}
          <span className="gc-tierline" data-tier={segment.card.tier}>
            {segment.header.tierLabel}
          </span>
        </p>
      </div>
      <p className="w-full text-[13px] italic leading-snug text-[var(--color-muted)] sm:w-auto sm:flex-1 sm:pl-4 sm:text-right sm:not-italic">
        “{segment.header.commentary}”
      </p>
    </div>
  );
}
