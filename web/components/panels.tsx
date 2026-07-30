import type { Segment } from "../lib/view";
import { ovrToPercentile } from "../lib/scale";

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
    <div className="gc-bar">
      <i style={{ width: `${Math.round(Math.max(0, Math.min(1, fill)) * 100)}%` }} />
    </div>
  );
}

/**
 * DISTRIBUTION — the real shape of the cricketer population, not a bare axis.
 *
 * The area is the actual OVR density of every cricketer in the database
 * (computed server-side and handed over as ~28 normalised numbers, so the
 * player index itself never reaches the browser). The reader's own position is
 * a crimson marker with the percentile labelled AT it rather than floating in
 * the middle, and the 40/99 endpoints drop back to hairline captions.
 */
function Distribution({
  ovr, percentile, density,
}: { ovr: number; percentile?: number; density: number[] }) {
  const pos = ovrToPercentile(ovr);
  const pct = percentile ?? pos;

  // Area path across a 100x40 box. Midpoint quadratics smooth the histogram
  // into a curve without pretending to more resolution than 28 bins carry.
  const H = 40, TOP = 6;
  const pts = density.map((d, i) => [
    (i / (density.length - 1)) * 100,
    H - d * (H - TOP),
  ] as const);
  let curve = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    curve += ` Q ${px} ${py} ${(px + cx) / 2} ${(py + cy) / 2}`;
  }
  curve += ` L ${pts[pts.length - 1][0]} ${pts[pts.length - 1][1]}`;
  const area = `${curve} L 100 ${H} L 0 ${H} Z`;

  // Anchor the label on the marker but never let it leave the panel.
  const anchor = pos < 12 ? "0" : pos > 88 ? "-100%" : "-50%";

  return (
    <div>
      <PanelLabel>Distribution</PanelLabel>
      <div className="gc-dist">
        <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden className="gc-dist-svg">
          <defs>
            <linearGradient id="gc-dist-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--color-muted)" stopOpacity="0.55" />
              <stop offset="1" stopColor="var(--color-muted)" stopOpacity="0.07" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#gc-dist-fill)" />
          <path d={curve} fill="none" stroke="var(--color-muted)" strokeWidth="1.25"
                strokeOpacity="0.75" vectorEffect="non-scaling-stroke" />
        </svg>
        {/* the reader's position */}
        <span className="gc-dist-marker" style={{ left: `${pos}%` }} aria-hidden />
        <span className="gc-dist-tag tabular" style={{ left: `${pos}%`, transform: `translateX(${anchor})` }}>
          {ordinal(pct)}
        </span>
      </div>
      <div className="gc-dist-axis tabular">
        <span>40</span>
        <span>99</span>
      </div>
      <p className="sr-only">
        {ordinal(pct)} percentile of all cricketers in the database.
      </p>
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
        {/* gap-4 (was gap-3): the thinner 2px track needs the row to breathe or
            the panel reads as one grey mass. */}
        <div className="flex flex-col gap-4">
          {r.metrics.map((m) => (
            <div key={m.label}>
              <div className="gc-metric">
                <span className="text-[13px] text-[var(--color-text)]">{m.label}</span>
                <span className="gc-metric-val tabular text-xs text-[var(--color-muted)]">
                  {m.value}
                  <span className="text-[var(--color-faint)]">→ {m.axis}</span>
                </span>
              </div>
              <Bar fill={m.fill} />
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-[var(--color-hairline)] pt-5">
          <Distribution ovr={r.ovr} percentile={r.percentile} density={segment.density} />
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
        <Distribution ovr={r.distribution} density={segment.density} />
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
          {/* The handle is only ever set on the YOU segment (cricketers carry
              null), so it is always a real GitHub login and safe to link. This
              is the header text, NOT the card face — the card face must stay
              plain for the html-to-image capture. */}
          {segment.header.handle && (
            <a
              href={`https://github.com/${encodeURIComponent(segment.header.handle.replace(/^@/, ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="gc-handle"
            >
              {segment.header.handle}
            </a>
          )}
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
