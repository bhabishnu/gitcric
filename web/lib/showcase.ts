/**
 * Landing-page showcase data. Reads the committed gen/showcase.json written by
 * scripts/gen-showcase.ts — a MANUAL step, never part of `next build`. The
 * landing page therefore makes no GitHub call at build or request time.
 *
 * Data only: each entry is a login, a local avatar path, and the card face
 * /[username] paints first. The fan's geometry lives in the .gc-fan CSS block,
 * so tuning the spread never touches this JSON.
 */
import showcaseJson from "../gen/showcase.json";
import type { CardFace } from "./view";

export interface ShowcaseCard {
  /** Canonical GitHub login — also the /[username] href. */
  login: string;
  /** Path under public/, or null → the card's monogram fallback. */
  avatar: string | null;
  face: CardFace;
}
export interface ShowcaseFile {
  generatedAt: string;
  cards: ShowcaseCard[];
}

const FILE = showcaseJson as unknown as ShowcaseFile;

export const SHOWCASE: ShowcaseCard[] = FILE.cards;
export const SHOWCASE_GENERATED_AT = FILE.generatedAt;
