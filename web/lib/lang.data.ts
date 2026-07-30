import type { FlagAsset } from "./flags.data";

/**
 * Language marks — SERVER-ONLY, resolved like flags so the table never reaches
 * the browser and the PNG export gains no dependency (no icon library, no
 * external fetch; the chosen mark is inlined into the card face).
 *
 * These carry their BRAND COLOURS, a deliberate and approved exception to the
 * one-accent rule — and the only place on the site where a colour other than
 * crimson is allowed. Colours are baked into the markup rather than inherited,
 * so nothing downstream can tint them by accident.
 *
 * Every mark is a reduction of the language's REAL logo — shape first, then
 * colour — not a generic letter-in-a-box. They render at ~24px in the fan
 * cluster and ~50px on the result card, so gradients and fine detail are
 * flattened to the brand's primary tone. A few brands are genuinely too dark
 * to read on a near-black card (Lua's navy, Elixir's and Haskell's deep
 * purples, C#'s VS purple) and use the brand's own lighter tone instead —
 * noted per entry.
 *
 * Anything not in this table falls back to the short text label. Dart lives
 * there deliberately: its official mark (three overlapping angular planes)
 * has no honest single-colour reduction at this size, and the letter-plate we
 * had before was not the Dart logo.
 */
export type LangMark = FlagAsset;

/** JS/TS/CSS family: a filled plate with the letters tucked into the
 *  bottom-right corner, exactly how those three logos actually draw them.
 *  Full-bleed: the artwork must touch the box edge, because the flag directly
 *  above it does — an inset plate reads as a misaligned column. */
const cornerPlate = (bg: string, fg: string, t: string, size: number, rx: number) =>
  `<rect x="0" y="0" width="24" height="24" rx="${rx}" fill="${bg}"/>` +
  `<text x="21.6" y="21" text-anchor="end" font-family="ui-monospace,Menlo,monospace" ` +
  `font-size="${size}" font-weight="700" fill="${fg}">${t}</text>`;

/** C family: the vertex-top hexagon badge all three logos share. */
const hex = (fill: string, fg: string, t: string, size = 10) =>
  `<polygon points="12,0 22.4,6 22.4,18 12,24 1.6,18 1.6,6" fill="${fill}"/>` +
  `<text x="12" y="${12 + size * 0.36}" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" ` +
  `font-size="${size}" font-weight="700" fill="${fg}">${t}</text>`;

export const LANG_MARKS: Record<string, LangMark> = {
  // Yellow square, black JS bottom-right. The real logo is sharp-cornered;
  // rx=1 is the plate family's minimum softening.
  javascript: { viewBox: "0 0 24 24", name: "JavaScript", inner: cornerPlate("#F7DF1E", "#000", "JS", 9, 1) },
  typescript: { viewBox: "0 0 24 24", name: "TypeScript", inner: cornerPlate("#3178C6", "#fff", "TS", 9, 2.5) },
  // The 2024 community CSS logo: rebeccapurple, CSS bottom-right (replaces the
  // old blue {} plate, which was no logo at all).
  css: { viewBox: "0 0 24 24", name: "CSS", inner: cornerPlate("#663399", "#fff", "CSS", 6.8, 2.5) },
  // The C hexagon's indigo, flattened from its gradient to the readable tone.
  c: { viewBox: "0 0 24 24", name: "C", inner: hex("#5C6BC0", "#fff", "C") },
  "c++": { viewBox: "0 0 24 24", name: "C++", inner: hex("#00599C", "#fff", "C++", 6.8) },
  // C#'s hexagon in the lighter of its two brand purples — the VS #68217A
  // sinks into the card.
  "c#": { viewBox: "0 0 24 24", name: "C#", inner: hex("#9B4F96", "#fff", "C#", 8) },
  // Go's logo IS the wordmark — no plate to hide behind.
  go: {
    viewBox: "0 0 24 24", name: "Go",
    inner: `<text x="12" y="17.8" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" ` +
      `font-size="16" font-weight="700" fill="#00ADD8">Go</text>`,
  },
  // Blue R in front of the grey halo ellipse.
  r: {
    viewBox: "0 0 24 24", name: "R",
    inner:
      '<ellipse cx="10.5" cy="9.5" rx="9.6" ry="6.6" fill="none" stroke="#BFC6CE" stroke-width="2.4"/>' +
      '<text x="7.6" y="22" font-family="ui-monospace,Menlo,monospace" font-size="18" font-weight="800" fill="#276DC3">R</text>',
  },
  // The purple ellipse, dark navy lowercase php — not a square plate.
  php: {
    viewBox: "0 0 24 24", name: "PHP",
    inner:
      '<ellipse cx="12" cy="12" rx="11.8" ry="6.4" fill="#777BB4"/>' +
      '<text x="12" y="14.6" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="6.6" font-weight="700" fill="#1B2033">php</text>',
  },
  // Kotlin's actual mark: the square with the wedge bitten out toward the
  // centre, flattened from its gradient to the primary purple.
  kotlin: { viewBox: "0 0 24 24", name: "Kotlin", inner: '<path fill="#7F52FF" d="M0 0h24L12 12l12 12H0Z"/>' },
  // No brand to be faithful to — "Shell" is GitHub's bucket, and a terminal
  // prompt is the honest generic.
  shell: {
    viewBox: "0 0 24 24", name: "Shell",
    inner: `<rect x="0" y="0" width="24" height="24" rx="5" fill="#2B3137"/>` +
      `<path fill="none" stroke="#4EAA25" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" d="m6.5 8.5 3.5 3.5-3.5 3.5M12.5 16h5"/>`,
  },
  // Two interlocking bodies in Python's blue and yellow.
  python: {
    viewBox: "0.9 0.4 24.56 24.61", name: "Python",
    inner:
      '<path fill="#3776AB" d="M11.8 1.5c-2.6 0-4.4.9-4.4 2.9v2.1h4.6v.8H5.3C3.3 7.3 2 8.8 2 11.5S3.2 15.7 5.3 15.7h1.5v-2.5c0-2.1 1.7-3.6 3.8-3.6h4.3c1.8 0 3.1-1.3 3.1-3V4.4c0-1.7-1.5-2.6-3.4-2.8-.9-.1-1.8-.1-2.8-.1Zm-2.4 2c.5 0 .9.4.9 1s-.4 1-.9 1-.9-.4-.9-1 .4-1 .9-1Z"/>' +
      '<path fill="#FFD343" d="M17.2 8.3v2.4c0 2.2-1.8 3.7-3.8 3.7H9.1c-1.7 0-3.1 1.4-3.1 3v3c0 1.7 1.5 2.7 3.1 3.1 2 .5 3.9.6 6.2 0 1.6-.4 3.1-1.3 3.1-3.1v-2.1h-4.6v-.8h6.9c2 0 2.8-1.4 3.3-3.4.5-2.1.5-4-.1-5.7-.4-1.2-1.3-2.1-2.6-2.1h-4.1Zm-2.6 12.4c.5 0 .9.4.9 1s-.4 1-.9 1-.9-.4-.9-1 .4-1 .9-1Z"/>',
  },
  // Java: blue cup, and the steam is the logo's RED, not the Sun-era orange.
  java: {
    viewBox: "2.9 0.9 17.8 21.2", name: "Java",
    inner:
      '<path fill="none" stroke="#EA2D2E" stroke-width="1.7" stroke-linecap="round" d="M9 3.2c-1.6 1.6 1.4 2.5 0 4.2M13 2c-2 2 1.8 3.1 0 5.4"/>' +
      '<path fill="none" stroke="#5382A1" stroke-width="1.7" d="M5 10.5h11v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z"/>' +
      '<path fill="none" stroke="#5382A1" stroke-width="1.7" d="M16 11.6h1.6a2 2 0 1 1 0 4H16"/>' +
      '<path fill="none" stroke="#5382A1" stroke-width="1.7" stroke-linecap="round" d="M4 21h14"/>',
  },
  // Rust's cog, in the brand's orange-red (the black original vanishes here).
  rust: {
    viewBox: "1.5 1.5 21.0 21.0", name: "Rust",
    inner:
      '<circle cx="12" cy="12" r="6.4" fill="none" stroke="#CE422B" stroke-width="1.7"/>' +
      '<g stroke="#CE422B" stroke-width="1.8" stroke-linecap="round">' +
      '<path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.3 5.3l1.9 1.9M16.8 16.8l1.9 1.9M18.7 5.3l-1.9 1.9M7.2 16.8l-1.9 1.9"/></g>' +
      // A real R — bowl, stem AND the diagonal leg; the old path had no leg
      // and read as a P inside the cog.
      '<path fill="#CE422B" d="M9.4 8.4h4a2.1 2.1 0 0 1 .7 4.08L15.8 15.4h-2.4l-1.5-2.6h-.5v2.6H9.4Zm2 1.7v1.1h1.6a.55.55 0 0 0 0-1.1Z"/>',
  },
  ruby: {
    viewBox: "0.9 2.9 22.2 19.2", name: "Ruby",
    inner:
      '<path fill="none" stroke="#CC342D" stroke-width="1.7" stroke-linejoin="round" d="M6 4h12l4 6-10 11L2 10Z"/>' +
      '<path fill="none" stroke="#CC342D" stroke-width="1.3" d="M2 10h20M6 4l6 6 6-6M12 10v11"/>',
  },
  // Lua's navy (#2C2D72) is unreadable on a near-black card — lightened.
  lua: {
    viewBox: "2.9 0.9 20.6 20.2", name: "Lua",
    inner:
      '<circle cx="11" cy="13" r="7" fill="none" stroke="#4E7EDB" stroke-width="1.8"/>' +
      '<circle cx="14.4" cy="9.6" r="2" fill="#4E7EDB"/>' +
      '<circle cx="20" cy="4.4" r="2.4" fill="none" stroke="#4E7EDB" stroke-width="1.8"/>',
  },
  // Elixir's deep purple lightened for the same reason.
  elixir: { viewBox: "4.4 1.4 15.2 19.7", name: "Elixir", inner: '<path fill="none" stroke="#A98BBE" stroke-width="1.8" stroke-linejoin="round" d="M12 2.5c3.6 4 6.5 7 6.5 11a6.5 6.5 0 0 1-13 0c0-3.2 2.2-5.6 6.5-11Z"/>' },
  // The real mark is ">λ" — chevron then lambda. #5E5086 lightened.
  haskell: {
    viewBox: "0.9 2.4 22.2 19.2", name: "Haskell",
    inner:
      '<path fill="none" stroke="#8F7EB5" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="M2.5 4.5 7 12l-4.5 7.5"/>' +
      '<path fill="none" stroke="#8F7EB5" stroke-width="2.2" stroke-linecap="round" d="M10 3.5 21 20.5M16.1 12 10 20.5"/>',
  },
  // The HTML5 shield, flattened to its orange with the 5 knocked out.
  html: {
    viewBox: "1.4 0.9 21.2 22.2", name: "HTML",
    inner:
      '<path fill="#E34F26" d="M3.2 2h17.6l-1.6 17.6L12 22l-7.2-2.4Z"/>' +
      '<text x="12" y="16.4" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="10" font-weight="700" fill="#fff">5</text>',
  },
  "vim script": { viewBox: "0.9 0.9 22.2 22.2", name: "Vim", inner: '<path fill="none" stroke="#019833" stroke-width="1.8" stroke-linejoin="round" d="M12 2 22 12 12 22 2 12Z"/><path fill="#019833" d="M8.6 8h2l1.6 4.4L13.8 8h2l-2.9 7.6h-1.6Z"/>' },
  swift: { viewBox: "2.9 2.9 18.5 17.3", name: "Swift", inner: '<path fill="#F05138" d="M4 4c4.2 3.4 7.5 6 9.9 7.9C11.6 10.6 8.6 8.6 5 6.2c3.4 4.5 6.8 7.6 10.2 9.2-1.9.9-4.6 1-7.3.1 2.9 2.4 6.6 3.4 9.7 2.6 1.2-.3 2.1.1 2.6 1 .2-2 .1-4-.4-5.9-.9-3.6-3.1-6.6-6.6-9.2Z"/>' },
};

/** Language name (as GitHub reports it) → mark, or null to fall back to text. */
export function markForLanguage(language: string | null): LangMark | null {
  if (!language) return null;
  return LANG_MARKS[language.trim().toLowerCase()] ?? null;
}
